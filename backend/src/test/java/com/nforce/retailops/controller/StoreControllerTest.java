package com.nforce.retailops.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.RoleRepository;
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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class StoreControllerTest {

    private static final String PASSWORD = "correct-horse-battery-staple";

    @Autowired private MockMvc mockMvc;
    @Autowired private RoleRepository roleRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private StoreRepository storeRepository;
    @Autowired private StoreOwnerRepository storeOwnerRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @Transactional
    void ownerAdminCanListTheirActiveStore() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        User owner = user("store-list-owner@nforce.test", ownerRole);
        Store store = store("List Test Store", 8001L);
        linkOwnerToStore(owner, store);

        String token = login("store-list-owner@nforce.test");

        mockMvc.perform(get("/api/stores")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk());
    }

    @Test
    @Transactional
    void ownerAdminCannotRenameStore() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        User owner = user("store-rename-denied@nforce.test", ownerRole);
        Store store = store("Rename Denied Store", 8002L);
        linkOwnerToStore(owner, store);

        String token = login("store-rename-denied@nforce.test");

        mockMvc.perform(put("/api/stores/" + store.getId())
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Attempted Rename\"}"))
            .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void ownerAdminCannotDeleteStore() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        User owner = user("store-delete-denied@nforce.test", ownerRole);
        Store store = store("Delete Denied Store", 8003L);
        linkOwnerToStore(owner, store);

        String token = login("store-delete-denied@nforce.test");

        mockMvc.perform(delete("/api/stores/" + store.getId())
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void superAdminCanRenameStore() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role superRole = role("SUPER_ADMIN");
        User owner = user("store-rename-owner@nforce.test", ownerRole);
        user("store-rename-super@nforce.test", superRole);
        Store store = store("Original Name", 8004L);
        linkOwnerToStore(owner, store);

        String token = login("store-rename-super@nforce.test");

        mockMvc.perform(put("/api/stores/" + store.getId())
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Renamed By Super\"}"))
            .andExpect(status().isOk());
    }

    @Test
    @Transactional
    void superAdminCanDeleteStore() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role superRole = role("SUPER_ADMIN");
        User owner = user("store-delete-owner@nforce.test", ownerRole);
        user("store-delete-super@nforce.test", superRole);
        Store store = store("Store To Delete", 8005L);
        linkOwnerToStore(owner, store);

        String token = login("store-delete-super@nforce.test");

        mockMvc.perform(delete("/api/stores/" + store.getId())
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isNoContent());
    }

    private Role role(String name) {
        return roleRepository.findByName(name).orElseGet(() -> {
            Role role = new Role();
            role.setName(name);
            role.setDescription(name);
            return roleRepository.save(role);
        });
    }

    private User user(String email, Role role) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(PASSWORD));
        user.setFullName("Test User");
        user.getRoles().add(role);
        return userRepository.save(user);
    }

    private Store store(String name, long storeCode) {
        Store store = new Store();
        store.setName(name);
        store.setStoreCode(storeCode);
        store.setActive(true);
        return storeRepository.save(store);
    }

    private void linkOwnerToStore(User owner, Store store) {
        StoreOwner storeOwner = new StoreOwner();
        storeOwner.setOwner(owner);
        storeOwner.setStore(store);
        storeOwnerRepository.save(storeOwner);
    }

    private String login(String email) throws Exception {
        String body = objectMapper.writeValueAsString(new LoginPayload(email, PASSWORD));
        String responseJson = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
        return objectMapper.readTree(responseJson).get("token").asText();
    }

    private record LoginPayload(String email, String password) {}
}
