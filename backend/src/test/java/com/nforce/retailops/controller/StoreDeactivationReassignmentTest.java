package com.nforce.retailops.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.entity.User;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Mirrors OwnerDeactivationReassignmentTest, the other direction: deactivating
 * the STORE (not the owner) must also fully release the owner link, and the
 * store must drop out of the "existing store" reassignment picker until it's
 * reactivated.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class StoreDeactivationReassignmentTest {

    private static final String PASSWORD = "correct-horse-battery-staple";

    @Autowired private MockMvc mockMvc;
    @Autowired private RoleRepository roleRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private StoreRepository storeRepository;
    @Autowired private StoreOwnerRepository storeOwnerRepository;
    @Autowired private SuperAdminRepository superAdminRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private String login(String email) throws Exception {
        String body = objectMapper.writeValueAsString(new LoginPayload(email, PASSWORD));
        String responseJson = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(responseJson).get("token").asText();
    }

    @Test
    @Transactional
    void deactivatingThenReactivatingStoreReleasesOwnerAndTogglesReassignabilityListing() throws Exception {
        Role ownerRole = roleRepository.findByName("OWNER_ADMIN").orElseGet(() -> {
            Role role = new Role();
            role.setName("OWNER_ADMIN");
            return roleRepository.save(role);
        });

        SuperAdmin sa = new SuperAdmin();
        sa.setName("SA Store Deactivation Test");
        sa.setEmail("sa-store-deactivation-test@nforce.test");
        sa.setPasswordHash(passwordEncoder.encode(PASSWORD));
        superAdminRepository.save(sa);

        User owner = new User();
        owner.setFullName("Store Deactivation Owner");
        owner.setEmail("store-deactivation-owner@nforce.test");
        owner.setPasswordHash(passwordEncoder.encode(PASSWORD));
        owner.getRoles().add(ownerRole);
        owner = userRepository.save(owner);
        Long ownerId = owner.getId();

        Store storeA = new Store();
        storeA.setName("Store A");
        storeA.setStoreCode(70101L);
        storeA.setLocation("Main St");
        storeA = storeRepository.save(storeA);
        Long storeAId = storeA.getId();

        StoreOwner link = new StoreOwner();
        link.setStore(storeA);
        link.setOwner(owner);
        link.setActive(true);
        storeOwnerRepository.save(link);

        String token = login("sa-store-deactivation-test@nforce.test");

        // Step 1: Deactivate the store itself.
        mockMvc.perform(patch("/api/stores/" + storeAId + "/status")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"active\":false}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.storeActive").value(false))
            .andExpect(jsonPath("$.ownerName").doesNotExist())
            .andExpect(jsonPath("$.ownerAccessActive").value(false));

        // The link is released, not just flagged inactive: owner reference cleared.
        StoreOwner releasedLink = storeOwnerRepository.findByStoreId(storeAId).orElseThrow();
        assertThat(releasedLink.isActive()).isFalse();
        assertThat(releasedLink.getOwner()).isNull();
        assertThat(storeOwnerRepository.findByOwnerId(ownerId)).isEmpty();

        // Step 2: A deactivated store must NOT be offered in the "existing store"
        // reassignment picker, even though its link is released.
        mockMvc.perform(get("/api/owners/reassignable-stores")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[?(@.storeId == " + storeAId + ")]").doesNotExist());

        // Step 3: Reactivate the store -- must NOT auto-restore the previous owner.
        mockMvc.perform(patch("/api/stores/" + storeAId + "/status")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"active\":true}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.storeActive").value(true))
            .andExpect(jsonPath("$.ownerName").doesNotExist());

        // Step 4: Now that it's active again, it shows up as available for
        // explicit reassignment, unowned.
        mockMvc.perform(get("/api/owners/reassignable-stores")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[?(@.storeId == " + storeAId + ")]").exists())
            .andExpect(jsonPath("$[?(@.storeId == " + storeAId + ")].currentOwnerName").value(org.hamcrest.Matchers.contains(org.hamcrest.Matchers.nullValue())));

        // Step 5: Explicitly assigning it back to the same owner works.
        mockMvc.perform(patch("/api/stores/" + storeAId + "/assign-owner")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"ownerId\":" + ownerId + "}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ownerId").value(ownerId))
            .andExpect(jsonPath("$.ownerAccessActive").value(true));
    }

    private record LoginPayload(String email, String password) {
    }
}
