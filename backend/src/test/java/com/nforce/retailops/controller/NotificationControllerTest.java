package com.nforce.retailops.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nforce.retailops.dto.RaiseIssueRequest;
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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class NotificationControllerTest {

    private static final String PASSWORD = "notif-test-secret";
    private static final AtomicLong STORE_CODE = new AtomicLong(88000);

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

    private Store store() {
        Store s = new Store();
        s.setName("Notif Store " + STORE_CODE.get());
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
        se.setPhone("555-0200");
        se.setShift("Evening");
        se.setEmployeeType("Part-time");
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
    void raisingIssueCreatesNotificationForOwner() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role empRole = role("EMPLOYEE");
        User owner = user("notif-owner-a@nforce.test", ownerRole);
        User employee = user("notif-emp-a@nforce.test", empRole);
        Store store = store();
        linkOwner(owner, store);
        linkEmployee(employee, store);

        String empToken = login("notif-emp-a@nforce.test");
        mockMvc.perform(post("/api/me/issues")
                .header("Authorization", "Bearer " + empToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new RaiseIssueRequest(store.getId(), "Leak in the roof"))))
            .andExpect(status().isCreated());

        String ownerToken = login("notif-owner-a@nforce.test");
        mockMvc.perform(get("/api/notifications")
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].category").value("ISSUE_RAISED"))
            .andExpect(jsonPath("$[0].read").value(false))
            .andExpect(jsonPath("$[0].relatedIssueNote").value("Leak in the roof"));
    }

    @Test
    @Transactional
    void unreadCountReflectsNewNotifications() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role empRole = role("EMPLOYEE");
        User owner = user("notif-owner-b@nforce.test", ownerRole);
        User employee = user("notif-emp-b@nforce.test", empRole);
        Store store = store();
        linkOwner(owner, store);
        linkEmployee(employee, store);

        String empToken = login("notif-emp-b@nforce.test");
        // Raise two issues
        for (String note : new String[]{"Light out", "Floor slippery"}) {
            mockMvc.perform(post("/api/me/issues")
                    .header("Authorization", "Bearer " + empToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(new RaiseIssueRequest(store.getId(), note))))
                .andExpect(status().isCreated());
        }

        String ownerToken = login("notif-owner-b@nforce.test");
        mockMvc.perform(get("/api/notifications/unread-count")
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.count").value(2));
    }

    @Test
    @Transactional
    void markingOneReadDecreasesUnreadCount() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role empRole = role("EMPLOYEE");
        User owner = user("notif-owner-c@nforce.test", ownerRole);
        User employee = user("notif-emp-c@nforce.test", empRole);
        Store store = store();
        linkOwner(owner, store);
        linkEmployee(employee, store);

        String empToken = login("notif-emp-c@nforce.test");
        mockMvc.perform(post("/api/me/issues")
                .header("Authorization", "Bearer " + empToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new RaiseIssueRequest(store.getId(), "Broken shelf"))))
            .andExpect(status().isCreated());

        String ownerToken = login("notif-owner-c@nforce.test");
        // Get notification id
        String listJson = mockMvc.perform(get("/api/notifications")
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        long notifId = objectMapper.readTree(listJson).get(0).get("id").asLong();

        // Mark it read
        mockMvc.perform(patch("/api/notifications/{id}/read", notifId)
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.read").value(true));

        // Unread count should now be 0
        mockMvc.perform(get("/api/notifications/unread-count")
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.count").value(0));
    }

    @Test
    @Transactional
    void markAllReadClearsAllUnread() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role empRole = role("EMPLOYEE");
        User owner = user("notif-owner-d@nforce.test", ownerRole);
        User employee = user("notif-emp-d@nforce.test", empRole);
        Store store = store();
        linkOwner(owner, store);
        linkEmployee(employee, store);

        String empToken = login("notif-emp-d@nforce.test");
        for (String note : new String[]{"Note A", "Note B", "Note C"}) {
            mockMvc.perform(post("/api/me/issues")
                    .header("Authorization", "Bearer " + empToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(new RaiseIssueRequest(store.getId(), note))))
                .andExpect(status().isCreated());
        }

        String ownerToken = login("notif-owner-d@nforce.test");
        mockMvc.perform(patch("/api/notifications/mark-all-read")
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/notifications/unread-count")
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.count").value(0));
    }

    @Test
    @Transactional
    void ownerCannotReadAnotherOwnerNotification() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role empRole = role("EMPLOYEE");
        User ownerA = user("notif-owner-e@nforce.test", ownerRole);
        User ownerB = user("notif-owner-f@nforce.test", ownerRole);
        User employee = user("notif-emp-e@nforce.test", empRole);
        Store store = store();
        linkOwner(ownerA, store);
        linkEmployee(employee, store);

        // Employee raises issue → notification goes to ownerA
        String empToken = login("notif-emp-e@nforce.test");
        mockMvc.perform(post("/api/me/issues")
                .header("Authorization", "Bearer " + empToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new RaiseIssueRequest(store.getId(), "Overflow"))))
            .andExpect(status().isCreated());

        // Get the notification id as ownerA
        String tokenA = login("notif-owner-e@nforce.test");
        String listJson = mockMvc.perform(get("/api/notifications")
                .header("Authorization", "Bearer " + tokenA))
            .andReturn().getResponse().getContentAsString();
        long notifId = objectMapper.readTree(listJson).get(0).get("id").asLong();

        // ownerB should NOT be able to mark ownerA's notification as read
        String tokenB = login("notif-owner-f@nforce.test");
        mockMvc.perform(patch("/api/notifications/{id}/read", notifId)
                .header("Authorization", "Bearer " + tokenB))
            .andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void employeeCanAccessTheirNotifications() throws Exception {
        Role empRole = role("EMPLOYEE");
        User employee = user("notif-emp-only@nforce.test", empRole);

        String token = login("notif-emp-only@nforce.test");
        mockMvc.perform(get("/api/notifications")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    @Transactional
    void ownerCanDeleteTheirOwnNotification() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role empRole = role("EMPLOYEE");
        User owner = user("notif-owner-del-a@nforce.test", ownerRole);
        User employee = user("notif-emp-del-a@nforce.test", empRole);
        Store store = store();
        linkOwner(owner, store);
        linkEmployee(employee, store);

        String empToken = login("notif-emp-del-a@nforce.test");
        mockMvc.perform(post("/api/me/issues")
                .header("Authorization", "Bearer " + empToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new RaiseIssueRequest(store.getId(), "Delete me"))))
            .andExpect(status().isCreated());

        String ownerToken = login("notif-owner-del-a@nforce.test");
        String listJson = mockMvc.perform(get("/api/notifications")
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        long notifId = objectMapper.readTree(listJson).get(0).get("id").asLong();

        mockMvc.perform(delete("/api/notifications/{id}", notifId)
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isNoContent());

        // Notification gone from list
        mockMvc.perform(get("/api/notifications")
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    @Transactional
    void ownerCannotDeleteAnotherOwnerNotification() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role empRole = role("EMPLOYEE");
        User ownerA = user("notif-owner-del-b@nforce.test", ownerRole);
        User ownerB = user("notif-owner-del-c@nforce.test", ownerRole);
        User employee = user("notif-emp-del-b@nforce.test", empRole);
        Store store = store();
        linkOwner(ownerA, store);
        linkEmployee(employee, store);

        String empToken = login("notif-emp-del-b@nforce.test");
        mockMvc.perform(post("/api/me/issues")
                .header("Authorization", "Bearer " + empToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new RaiseIssueRequest(store.getId(), "Belongs to A"))))
            .andExpect(status().isCreated());

        String tokenA = login("notif-owner-del-b@nforce.test");
        String listJson = mockMvc.perform(get("/api/notifications")
                .header("Authorization", "Bearer " + tokenA))
            .andReturn().getResponse().getContentAsString();
        long notifId = objectMapper.readTree(listJson).get(0).get("id").asLong();

        // ownerB must not be able to delete ownerA's notification
        String tokenB = login("notif-owner-del-c@nforce.test");
        mockMvc.perform(delete("/api/notifications/{id}", notifId)
                .header("Authorization", "Bearer " + tokenB))
            .andExpect(status().isNotFound());

        // Notification still exists for ownerA
        mockMvc.perform(get("/api/notifications")
                .header("Authorization", "Bearer " + tokenA))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1));
    }

    private record LoginPayload(String email, String password) {}
}
