package com.nforce.retailops.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nforce.retailops.dto.RaiseIssueRequest;
import com.nforce.retailops.dto.UpdateIssueStatusRequest;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreEmployee;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
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

import java.util.concurrent.atomic.AtomicLong;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RaisedIssueControllerTest {

    private static final String PASSWORD = "horse-battery-staple-correct";
    private static final AtomicLong STORE_CODE = new AtomicLong(99000);

    @Autowired private MockMvc mockMvc;
    @Autowired private RoleRepository roleRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private StoreRepository storeRepository;
    @Autowired private StoreOwnerRepository storeOwnerRepository;
    @Autowired private StoreEmployeeRepository storeEmployeeRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private Role role(String name) {
        return roleRepository.findByName(name).orElseGet(() -> {
            Role r = new Role();
            r.setName(name);
            r.setDescription(name);
            return roleRepository.save(r);
        });
    }

    private User user(String email, Role role) {
        User u = new User();
        u.setEmail(email);
        u.setPasswordHash(passwordEncoder.encode(PASSWORD));
        u.setFullName("Test User");
        u.getRoles().add(role);
        return userRepository.save(u);
    }

    private Store store(String name) {
        Store s = new Store();
        s.setName(name);
        s.setStoreCode(STORE_CODE.getAndIncrement());
        s.setActive(true);
        return storeRepository.save(s);
    }

    private void linkOwner(User owner, Store store) {
        StoreOwner so = new StoreOwner();
        so.setOwner(owner);
        so.setStore(store);
        storeOwnerRepository.save(so);
    }

    private void linkEmployee(User employee, Store store) {
        StoreEmployee se = new StoreEmployee();
        se.setEmployee(employee);
        se.setPhone("555-0100");
        se.setShift("Morning");
        se.setEmployeeType("Full-time");
        se.setGender("Other");
        se.getStores().add(store);
        storeEmployeeRepository.save(se);
    }

    private String login(String email) throws Exception {
        String body = objectMapper.writeValueAsString(new LoginPayload(email, PASSWORD));
        String json = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(json).get("token").asText();
    }

    @Test
    @Transactional
    void employeeCanRaiseIssue() throws Exception {
        Role empRole = role("EMPLOYEE");
        User employee = user("issue-emp-a@nforce.test", empRole);
        Store store = store("Issue Store A");
        linkEmployee(employee, store);

        String token = login("issue-emp-a@nforce.test");
        RaiseIssueRequest req = new RaiseIssueRequest(store.getId(), "Fridge is broken");

        mockMvc.perform(post("/api/me/issues")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.status").value("OPEN"))
            .andExpect(jsonPath("$.note").value("Fridge is broken"))
            .andExpect(jsonPath("$.employeeFullName").value("Test User"));
    }

    @Test
    @Transactional
    void ownerCanListIssuesForOwnStore() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role empRole = role("EMPLOYEE");
        User owner = user("issue-owner-b@nforce.test", ownerRole);
        User employee = user("issue-emp-b@nforce.test", empRole);
        Store store = store("Issue Store B");
        linkOwner(owner, store);
        linkEmployee(employee, store);

        // Employee raises issue
        String empToken = login("issue-emp-b@nforce.test");
        RaiseIssueRequest req = new RaiseIssueRequest(store.getId(), "Door lock broken");
        mockMvc.perform(post("/api/me/issues")
                .header("Authorization", "Bearer " + empToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isCreated());

        // Owner lists issues
        String ownerToken = login("issue-owner-b@nforce.test");
        mockMvc.perform(get("/api/issues")
                .header("Authorization", "Bearer " + ownerToken)
                .param("storeId", String.valueOf(store.getId())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].note").value("Door lock broken"))
            .andExpect(jsonPath("$[0].status").value("OPEN"));
    }

    @Test
    @Transactional
    void ownerCannotListIssuesForDifferentStore() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        User ownerA = user("issue-owner-c@nforce.test", ownerRole);
        User ownerB = user("issue-owner-d@nforce.test", ownerRole);
        Store storeA = store("Issue Store C");
        Store storeB = store("Issue Store D");
        linkOwner(ownerA, storeA);
        linkOwner(ownerB, storeB);

        String tokenA = login("issue-owner-c@nforce.test");
        mockMvc.perform(get("/api/issues")
                .header("Authorization", "Bearer " + tokenA)
                .param("storeId", String.valueOf(storeB.getId())))
            .andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void ownerCanResolveIssue() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role empRole = role("EMPLOYEE");
        User owner = user("issue-owner-e@nforce.test", ownerRole);
        User employee = user("issue-emp-e@nforce.test", empRole);
        Store store = store("Issue Store E");
        linkOwner(owner, store);
        linkEmployee(employee, store);

        String empToken = login("issue-emp-e@nforce.test");
        String createJson = mockMvc.perform(post("/api/me/issues")
                .header("Authorization", "Bearer " + empToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new RaiseIssueRequest(store.getId(), "AC not working"))))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        long issueId = objectMapper.readTree(createJson).get("id").asLong();

        String ownerToken = login("issue-owner-e@nforce.test");
        UpdateIssueStatusRequest update = new UpdateIssueStatusRequest("RESOLVED", "Called the AC technician");
        mockMvc.perform(patch("/api/issues/{id}/status", issueId)
                .header("Authorization", "Bearer " + ownerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(update)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("RESOLVED"))
            .andExpect(jsonPath("$.responseText").value("Called the AC technician"))
            .andExpect(jsonPath("$.respondedByFullName").value("Test User"));
    }

    @Test
    @Transactional
    void employeeCannotUpdateIssueStatus() throws Exception {
        Role empRole = role("EMPLOYEE");
        User employee = user("issue-emp-f@nforce.test", empRole);
        Store store = store("Issue Store F");
        linkEmployee(employee, store);

        String token = login("issue-emp-f@nforce.test");
        UpdateIssueStatusRequest update = new UpdateIssueStatusRequest("RESOLVED", null);
        mockMvc.perform(patch("/api/issues/1/status")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(update)))
            .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void employeeCannotRaiseIssueForUnassignedStore() throws Exception {
        Role empRole = role("EMPLOYEE");
        User employee = user("issue-emp-g@nforce.test", empRole);
        Store otherStore = store("Issue Store G");
        // Employee NOT linked to otherStore

        String token = login("issue-emp-g@nforce.test");
        RaiseIssueRequest req = new RaiseIssueRequest(otherStore.getId(), "Hack attempt");
        mockMvc.perform(post("/api/me/issues")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isNotFound());
    }

    private record LoginPayload(String email, String password) {}
}
