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

// Combined monthly cash summary, Super Admin, cross-store. End to end through
// real login + method security: the Super Admin-only gate, Combined = exact sum
// of the stores that have data, and a store with no entries listed as "no data"
// (null amounts, 0 days) rather than zeros.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SuperAdminCombinedCashSummaryControllerTest {

    private static final String PASSWORD = "correct-horse-battery-staple";
    private static final String URL = "/api/super-admin/cash/monthly-summary";
    // A closed past month, so the result never depends on today's date.
    private static final String MONTH = "2026-10";

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

    private void superAdmin(String email) {
        SuperAdmin sa = new SuperAdmin();
        sa.setName("Combined Super Admin");
        sa.setEmail(email);
        sa.setPasswordHash(passwordEncoder.encode(PASSWORD));
        superAdminRepository.save(sa);
    }

    // opening, sales, removed, remaining, expenses, deposits, adjustments
    private void entry(Store store, String date, String opening, String sales, String removed,
                       String remaining, String expenses, String deposits, String adjust) {
        DailyCashEntry e = new DailyCashEntry();
        e.setStore(store);
        e.setBusinessDate(LocalDate.parse(date));
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

    private record LoginPayload(String email, String password) {}

    // ---- access control (AC4) -----------------------------------------------

    @Test
    void unauthenticatedIsRejected() throws Exception {
        mockMvc.perform(get(URL).param("month", MONTH)).andExpect(status().is4xxClientError());
    }

    @Test
    @Transactional
    void ownerAdminIsForbidden() throws Exception {
        User owner = user("combined-owner@nforce.test", "OWNER_ADMIN");
        link(owner, store("Combined Owner Store", 9301L));
        String token = login("combined-owner@nforce.test");

        mockMvc.perform(get(URL).param("month", MONTH).header("Authorization", "Bearer " + token))
            .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void employeeIsForbidden() throws Exception {
        user("combined-employee@nforce.test", "EMPLOYEE");
        String token = login("combined-employee@nforce.test");

        mockMvc.perform(get(URL).param("month", MONTH).header("Authorization", "Bearer " + token))
            .andExpect(status().isForbidden());
    }

    // ---- Combined totals (AC1, AC2) -----------------------------------------

    @Test
    @Transactional
    void combinedIsTheExactSumOfStoresWithData_andEmptyStoreIsListedAsNoData() throws Exception {
        superAdmin("combined-sa@nforce.test");
        Store a = store("Combined Store A", 9302L);
        Store b = store("Combined Store B", 9303L);
        Store empty = store("Combined Store Empty", 9304L);

        // Store A, two days. Expected = opening + sales - removed - deposits - expenses + adj.
        // Day 1: 100 + 500 - 50 - 0 - 10 + 0 = 540, counted 540 -> variance 0
        entry(a, "2026-10-10", "100.00", "500.00", "50.00", "540.00", "10.00", "0.00", "0.00");
        // Day 2: 540 + 300 - 0 - 100 - 20 + 5 = 725, counted 800 -> variance +75 (month end)
        entry(a, "2026-10-20", "540.00", "300.00", "0.00", "800.00", "20.00", "100.00", "5.00");
        // Store B, one day: 200 + 1000 - 100 - 500 - 50 - 10 = 540, counted 530 -> variance -10
        entry(b, "2026-10-15", "200.00", "1000.00", "100.00", "530.00", "50.00", "500.00", "-10.00");
        String token = login("combined-sa@nforce.test");

        mockMvc.perform(get(URL)
                .param("month", MONTH)
                .param("storeIds", a.getId().toString(), b.getId().toString(), empty.getId().toString())
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.month").value(MONTH))
            .andExpect(jsonPath("$.stores.length()").value(3))
            // Per-store columns are untouched by the combine step.
            .andExpect(jsonPath("$.stores[?(@.storeId == " + a.getId() + ")].totalCashSales").value(800.00))
            .andExpect(jsonPath("$.stores[?(@.storeId == " + a.getId() + ")].expectedCashOnHand").value(725.00))
            .andExpect(jsonPath("$.stores[?(@.storeId == " + b.getId() + ")].variance").value(-10.00))
            // The store with no entries is listed, as "no data", not as zeros.
            .andExpect(jsonPath("$.stores[?(@.storeId == " + empty.getId() + ")].daysRecorded").value(0))
            .andExpect(jsonPath("$.stores[?(@.storeId == " + empty.getId() + ")].totalCashSales").value((Object) null))
            .andExpect(jsonPath("$.stores[?(@.storeId == " + empty.getId() + ")].expectedCashOnHand").value((Object) null))
            // Combined = A + B only.
            .andExpect(jsonPath("$.combined.storeId").value((Object) null))
            .andExpect(jsonPath("$.combined.daysRecorded").value(3))
            .andExpect(jsonPath("$.combined.totalCashSales").value(1800.00))
            .andExpect(jsonPath("$.combined.totalCashRemoved").value(150.00))
            .andExpect(jsonPath("$.combined.bankDeposits").value(600.00))
            .andExpect(jsonPath("$.combined.cashExpenses").value(80.00))
            .andExpect(jsonPath("$.combined.adjustments").value(-5.00))
            .andExpect(jsonPath("$.combined.expectedCashOnHand").value(1265.00))
            .andExpect(jsonPath("$.combined.actualCashCount").value(1330.00))
            .andExpect(jsonPath("$.combined.variance").value(65.00));
    }

    @Test
    @Transactional
    void storeWithNoDataInTheMonthIsStillListedWhenNoStoresAreNamed() throws Exception {
        superAdmin("combined-sa2@nforce.test");
        Store empty = store("Combined Store Quiet", 9305L);
        String token = login("combined-sa2@nforce.test");

        mockMvc.perform(get(URL).param("month", MONTH).header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.stores[?(@.storeId == " + empty.getId() + ")].daysRecorded").value(0))
            .andExpect(jsonPath("$.stores[?(@.storeId == " + empty.getId() + ")].variance").value((Object) null));
    }
}
