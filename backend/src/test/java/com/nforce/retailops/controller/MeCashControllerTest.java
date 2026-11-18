package com.nforce.retailops.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreEmployee;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreRepository;
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

import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** An employee's daily cash entry: PUT/GET /api/me/cash?storeId=. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class MeCashControllerTest {

    private static final String PASSWORD = "correct-horse-battery-staple";
    private static final String URL = "/api/me/cash";

    @Autowired private MockMvc mockMvc;
    @Autowired private RoleRepository roleRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private StoreRepository storeRepository;
    @Autowired private StoreEmployeeRepository storeEmployeeRepository;
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

    private User user(String email, String fullName, String roleName) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(PASSWORD));
        user.setFullName(fullName);
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

    private User employeeAt(String email, String fullName, Store store) {
        User employee = user(email, fullName, "EMPLOYEE");
        StoreEmployee se = new StoreEmployee();
        se.setEmployee(employee);
        se.setPhone("555-0100");
        se.setEmployeeType("Full-time");
        se.setGender("Other");
        se.setStores(new HashSet<>(Set.of(store)));
        storeEmployeeRepository.save(se);
        return employee;
    }

    private String login(String email) throws Exception {
        String body = objectMapper.writeValueAsString(new LoginPayload(email, PASSWORD));
        String json = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(json).get("token").asText();
    }

    // Distinct values so a swapped field shows up: opening 100, expenses 5, removed N, remaining 90.
    private static String body(LocalDate date, String removed, String adjustments) {
        return "{" + (date == null ? "" : "\"businessDate\":\"" + date + "\",")
            + "\"openingDrawerCash\":100.00,\"cashExpenses\":5.00,\"cashRemoved\":" + removed
            + ",\"cashRemaining\":90.00,\"otherAdjustments\":" + adjustments + "}";
    }

    @Test
    void employeePutsTodayThenGetsTheFiveFieldsBack() throws Exception {
        Store s = store("Me Cash Store A", 9501L);
        employeeAt("me-cash-a@nforce.test", "Erin Employee", s);
        String token = login("me-cash-a@nforce.test");

        mockMvc.perform(put(URL).param("storeId", s.getId().toString())
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(body(LocalDate.now(), "10.00", "-3.50")))
            .andExpect(status().isOk());

        mockMvc.perform(get(URL).param("storeId", s.getId().toString())
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.businessDate").value(LocalDate.now().toString()))
            .andExpect(jsonPath("$.openingDrawerCash").value(100.00))
            .andExpect(jsonPath("$.cashExpenses").value(5.00))
            .andExpect(jsonPath("$.cashRemoved").value(10.00))
            .andExpect(jsonPath("$.cashRemaining").value(90.00))
            .andExpect(jsonPath("$.otherAdjustments").value(-3.50))
            .andExpect(jsonPath("$.enteredByName").value("Erin Employee"))
            .andExpect(jsonPath("$.history.length()").value(0));
    }

    @Test
    void anotherEmployeeOfTheSameStoreEditingShowsOneHistoryRow() throws Exception {
        Store s = store("Me Cash Store B", 9502L);
        employeeAt("me-cash-b1@nforce.test", "First Employee", s);
        employeeAt("me-cash-b2@nforce.test", "Second Employee", s);
        String t1 = login("me-cash-b1@nforce.test");
        String t2 = login("me-cash-b2@nforce.test");

        mockMvc.perform(put(URL).param("storeId", s.getId().toString())
                .header("Authorization", "Bearer " + t1)
                .contentType(MediaType.APPLICATION_JSON).content(body(null, "10.00", "0")))
            .andExpect(status().isOk());
        mockMvc.perform(put(URL).param("storeId", s.getId().toString())
                .header("Authorization", "Bearer " + t2)
                .contentType(MediaType.APPLICATION_JSON).content(body(null, "20.00", "0")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.enteredByName").value("First Employee"))
            .andExpect(jsonPath("$.updatedByName").value("Second Employee"))
            .andExpect(jsonPath("$.cashRemoved").value(20.00))
            .andExpect(jsonPath("$.history.length()").value(1))
            .andExpect(jsonPath("$.history[0].previousCashRemoved").value(10.00))
            .andExpect(jsonPath("$.history[0].previousCashExpenses").value(5.00))
            .andExpect(jsonPath("$.history[0].correctedByName").value("Second Employee"));
    }

    @Test
    void putWithAPastDateIsForbidden() throws Exception {
        Store s = store("Me Cash Store C", 9503L);
        employeeAt("me-cash-c@nforce.test", "Erin Employee", s);
        String token = login("me-cash-c@nforce.test");

        mockMvc.perform(put(URL).param("storeId", s.getId().toString())
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(LocalDate.now().minusDays(1), "10.00", "0")))
            .andExpect(status().isForbidden());
    }

    @Test
    void employeeOfAnotherStoreGetsNotFound() throws Exception {
        Store mine = store("Me Cash Store D", 9504L);
        Store other = store("Me Cash Store E", 9505L);
        employeeAt("me-cash-d@nforce.test", "Erin Employee", mine);
        String token = login("me-cash-d@nforce.test");

        mockMvc.perform(put(URL).param("storeId", other.getId().toString())
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(body(null, "10.00", "0")))
            .andExpect(status().isNotFound());
        mockMvc.perform(get(URL).param("storeId", other.getId().toString())
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isNotFound());
    }

    @Test
    void ownerAdminIsForbidden() throws Exception {
        Store s = store("Me Cash Store F", 9506L);
        user("me-cash-owner@nforce.test", "Owner", "OWNER_ADMIN");
        String token = login("me-cash-owner@nforce.test");

        mockMvc.perform(get(URL).param("storeId", s.getId().toString())
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isForbidden());
        mockMvc.perform(put(URL).param("storeId", s.getId().toString())
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(body(null, "10.00", "0")))
            .andExpect(status().isForbidden());
    }

    @Test
    void negativeCashRemovedIsRejectedButNegativeAdjustmentsAreAccepted() throws Exception {
        Store s = store("Me Cash Store G", 9507L);
        employeeAt("me-cash-g@nforce.test", "Erin Employee", s);
        String token = login("me-cash-g@nforce.test");

        mockMvc.perform(put(URL).param("storeId", s.getId().toString())
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(body(null, "-1.00", "0")))
            .andExpect(status().isBadRequest());
        mockMvc.perform(put(URL).param("storeId", s.getId().toString())
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(body(null, "10.00", "-25.00")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.otherAdjustments").value(-25.00));
    }

    private record LoginPayload(String email, String password) {
    }
}
