package com.nforce.retailops.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nforce.retailops.entity.DailyCashEntry;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.DailyCashEntryRepository;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.SuperAdminRepository;
import com.nforce.retailops.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// End-to-end through real login + method security: role gates, store
// isolation (404 mask), the Super Admin principal branch, the "latest entry"
// rule, variance, and the "not available" contract.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ExpectedCashControllerTest {

    private static final String PASSWORD = "correct-horse-battery-staple";
    private static final String OWNER_URL = "/api/stores/cash/expected";

    @Autowired private MockMvc mockMvc;
    @Autowired private RoleRepository roleRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private SuperAdminRepository superAdminRepository;
    @Autowired private StoreRepository storeRepository;
    @Autowired private StoreOwnerRepository storeOwnerRepository;
    @Autowired private DailyCashEntryRepository cashEntryRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private Role role(String name) {
        return roleRepository.findByName(name).orElseGet(() -> {
            Role role = new Role();
            role.setName(name);
            role.setDescription(name);
            return roleRepository.save(role);
        });
    }

    private User user(String email, String roleName) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(PASSWORD));
        user.setFullName("Test User");
        user.getRoles().add(role(roleName));
        return userRepository.save(user);
    }

    private Store store(String name, long code) {
        Store store = new Store();
        store.setName(name);
        store.setStoreCode(code);
        store.setActive(true);
        return storeRepository.save(store);
    }

    private void link(User owner, Store store) {
        StoreOwner so = new StoreOwner();
        so.setOwner(owner);
        so.setStore(store);
        storeOwnerRepository.save(so);
    }

    private SuperAdmin superAdmin(String email) {
        SuperAdmin sa = new SuperAdmin();
        sa.setName("Cash Super Admin");
        sa.setEmail(email);
        sa.setPasswordHash(passwordEncoder.encode(PASSWORD));
        return superAdminRepository.save(sa);
    }

    // opening, sales, removed, remaining, expenses, deposits, adjustments
    private void entry(Store store, LocalDate date, String opening, String sales, String removed,
                       String remaining, String expenses, String deposits, String adjust) {
        DailyCashEntry e = new DailyCashEntry();
        e.setStore(store);
        e.setBusinessDate(date);
        e.setOpeningDrawerCash(new BigDecimal(opening));
        e.setTotalCashSales(new BigDecimal(sales));
        e.setCashRemoved(new BigDecimal(removed));
        e.setCashRemaining(new BigDecimal(remaining));
        e.setCashExpenses(new BigDecimal(expenses));
        e.setBankDeposits(new BigDecimal(deposits));
        e.setOtherAdjustments(new BigDecimal(adjust));
        e.setEnteredAt(OffsetDateTime.now());
        e.setUpdatedAt(OffsetDateTime.now());
        cashEntryRepository.save(e);
    }

    private String login(String email) throws Exception {
        String body = objectMapper.writeValueAsString(new LoginPayload(email, PASSWORD));
        String json = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(json).get("token").asText();
    }

    private static String superUrl(Store s) {
        return "/api/super-admin/stores/" + s.getId() + "/cash/expected";
    }

    // ---- access control -----------------------------------------------------

    @Test
    void unauthenticatedIsRejected() throws Exception {
        mockMvc.perform(get(OWNER_URL)).andExpect(status().is4xxClientError());
        mockMvc.perform(get("/api/super-admin/stores/1/cash/expected")).andExpect(status().is4xxClientError());
    }

    @Test
    @Transactional
    void employeeIsForbidden() throws Exception {
        user("cash-employee@nforce.test", "EMPLOYEE");
        String token = login("cash-employee@nforce.test");

        mockMvc.perform(get(OWNER_URL).header("Authorization", "Bearer " + token))
            .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void ownerCannotUseTheSuperAdminEndpoint() throws Exception {
        User owner = user("cash-owner-x@nforce.test", "OWNER_ADMIN");
        Store s = store("Cash Store X", 9120L);
        link(owner, s);
        String token = login("cash-owner-x@nforce.test");

        mockMvc.perform(get(superUrl(s)).header("Authorization", "Bearer " + token))
            .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void ownerWithNoStoreGets404() throws Exception {
        user("cash-owner-nostore@nforce.test", "OWNER_ADMIN");
        String token = login("cash-owner-nostore@nforce.test");

        mockMvc.perform(get(OWNER_URL).header("Authorization", "Bearer " + token))
            .andExpect(status().isNotFound());
    }

    // ---- not available ------------------------------------------------------

    @Test
    @Transactional
    void ownerWithNoEntriesGetsNotAvailable_neverZero() throws Exception {
        User owner = user("cash-owner-a@nforce.test", "OWNER_ADMIN");
        Store s = store("Cash Store A", 9102L);
        link(owner, s);
        String token = login("cash-owner-a@nforce.test");

        mockMvc.perform(get(OWNER_URL).header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.available").value(false))
            .andExpect(jsonPath("$.storeId").value(s.getId()))
            .andExpect(jsonPath("$.message").isNotEmpty())
            .andExpect(jsonPath("$.expectedCashOnHand").doesNotExist())
            .andExpect(jsonPath("$.variance").doesNotExist())
            .andExpect(jsonPath("$.asOfDate").doesNotExist());
    }

    // ---- calculation --------------------------------------------------------

    @Test
    @Transactional
    void ownerGetsFigureAndVarianceForTheirLatestEntry() throws Exception {
        User owner = user("cash-owner-b@nforce.test", "OWNER_ADMIN");
        Store s = store("Cash Store B", 9103L);
        link(owner, s);
        // Older day must be ignored: the figure is the latest entry only.
        entry(s, LocalDate.of(2026, 11, 8), "100.00", "900.00", "0.00", "1.00", "0.00", "0.00", "0.00");
        // 200 + 1000 - 100 - 500 - 50 + (-10) = 540 ; counted 530 -> variance -10
        entry(s, LocalDate.of(2026, 11, 9), "200.00", "1000.00", "100.00", "530.00", "50.00", "500.00", "-10.00");
        String token = login("cash-owner-b@nforce.test");

        mockMvc.perform(get(OWNER_URL).header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.available").value(true))
            .andExpect(jsonPath("$.asOfDate").value("2026-11-09"))
            .andExpect(jsonPath("$.expectedCashOnHand").value(540.00))
            .andExpect(jsonPath("$.cashRemaining").value(530.00))
            .andExpect(jsonPath("$.variance").value(-10.00))
            .andExpect(jsonPath("$.otherAdjustments").value(-10.00));
    }

    @Test
    @Transactional
    void otherStoresEntriesNeverLeakIntoTheFigure() throws Exception {
        User owner = user("cash-owner-g@nforce.test", "OWNER_ADMIN");
        Store mine = store("Cash Store I", 9109L);
        Store other = store("Cash Store J", 9110L);
        link(owner, mine);
        entry(mine, LocalDate.of(2026, 11, 9), "100.00", "10.00", "0.00", "110.00", "0.00", "0.00", "0.00");
        entry(other, LocalDate.of(2026, 11, 9), "5000.00", "5000.00", "0.00", "0.00", "0.00", "0.00", "0.00");
        String token = login("cash-owner-g@nforce.test");

        mockMvc.perform(get(OWNER_URL).header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.storeId").value(mine.getId()))
            .andExpect(jsonPath("$.expectedCashOnHand").value(110.00))
            .andExpect(jsonPath("$.variance").value(0.00));
    }

    // ---- super admin --------------------------------------------------------

    @Test
    @Transactional
    void superAdminCanReadAnyStore() throws Exception {
        superAdmin("cash-superadmin@nforce.test");
        Store s = store("Cash Store F", 9106L);
        entry(s, LocalDate.of(2026, 11, 9), "100.00", "25.00", "0.00", "130.00", "0.00", "0.00", "0.00");
        String token = login("cash-superadmin@nforce.test");

        mockMvc.perform(get(superUrl(s)).header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.expectedCashOnHand").value(125.00))
            .andExpect(jsonPath("$.variance").value(5.00));
    }

    @Test
    @Transactional
    void superAdminStoreWithNoEntriesIsNotAvailable() throws Exception {
        superAdmin("cash-superadmin3@nforce.test");
        Store s = store("Cash Store L", 9112L);
        String token = login("cash-superadmin3@nforce.test");

        mockMvc.perform(get(superUrl(s)).header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.available").value(false));
    }

    @Test
    @Transactional
    void superAdminUnknownStoreIs404() throws Exception {
        superAdmin("cash-superadmin2@nforce.test");
        String token = login("cash-superadmin2@nforce.test");

        mockMvc.perform(get("/api/super-admin/stores/999999/cash/expected")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isNotFound());
    }

    private record LoginPayload(String email, String password) {
    }
}
