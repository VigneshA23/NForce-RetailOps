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
 * Reproduces the exact scenario from the "deactivate then reactivate an
 * owner" bug report: the store link must be fully released (not just
 * flagged inactive) on deactivation, so reactivation never silently restores
 * it -- only an explicit Add Store pick should.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OwnerDeactivationReassignmentTest {

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
    void deactivatingThenReactivatingOwnerReleasesStoreInsteadOfLeavingItInactive() throws Exception {
        Role ownerRole = roleRepository.findByName("OWNER_ADMIN").orElseGet(() -> {
            Role role = new Role();
            role.setName("OWNER_ADMIN");
            return roleRepository.save(role);
        });

        SuperAdmin sa = new SuperAdmin();
        sa.setName("SA Reassign Test");
        sa.setEmail("sa-reassign-test@nforce.test");
        sa.setPasswordHash(passwordEncoder.encode(PASSWORD));
        superAdminRepository.save(sa);

        User owner = new User();
        owner.setFullName("Reassign Owner");
        owner.setEmail("reassign-owner@nforce.test");
        owner.setPasswordHash(passwordEncoder.encode(PASSWORD));
        owner.getRoles().add(ownerRole);
        owner = userRepository.save(owner);
        Long ownerId = owner.getId();

        Store storeA = new Store();
        storeA.setName("Store A");
        storeA.setStoreCode(70001L);
        storeA.setLocation("Main St");
        storeA = storeRepository.save(storeA);
        Long storeAId = storeA.getId();

        StoreOwner link = new StoreOwner();
        link.setStore(storeA);
        link.setOwner(owner);
        link.setActive(true);
        storeOwnerRepository.save(link);

        String token = login("sa-reassign-test@nforce.test");

        // Step 1: Deactivate the owner.
        String deactivateResponse = mockMvc.perform(patch("/api/owners/" + ownerId + "/status")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"active\":false}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].storeId").doesNotExist())
            .andReturn().getResponse().getContentAsString();
        assertThat(deactivateResponse).doesNotContain("\"storeId\":" + storeAId);

        // The Store record itself must survive, untouched.
        assertThat(storeRepository.findById(storeAId)).isPresent();

        // The link is released, not just flagged inactive: owner reference cleared.
        StoreOwner releasedLink = storeOwnerRepository.findByStoreId(storeAId).orElseThrow();
        assertThat(releasedLink.isActive()).isFalse();
        assertThat(releasedLink.getOwner()).isNull();
        assertThat(storeOwnerRepository.findByOwnerId(ownerId)).isEmpty();

        // Step 2: Reactivate the owner -- must NOT auto-restore Store A.
        String reactivateResponse = mockMvc.perform(patch("/api/owners/" + ownerId + "/status")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"active\":true}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].storeId").doesNotExist())
            .andExpect(jsonPath("$[0].ownerActive").value(true))
            .andReturn().getResponse().getContentAsString();
        assertThat(reactivateResponse).doesNotContain("\"storeId\":" + storeAId);

        // Step 3: Store A must now show up as available for explicit reassignment.
        mockMvc.perform(get("/api/owners/reassignable-stores")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[?(@.storeId == " + storeAId + ")]").exists())
            .andExpect(jsonPath("$[?(@.storeId == " + storeAId + ")].currentOwnerName").value(org.hamcrest.Matchers.contains(org.hamcrest.Matchers.nullValue())));

        // Step 4: Explicitly assigning Store A back to the (now active) owner works.
        String assignResponse = mockMvc.perform(post("/api/owners/" + ownerId + "/stores")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"existingStoreId\":" + storeAId + "}"))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        assertThat(assignResponse).contains("\"storeId\":" + storeAId);
        assertThat(assignResponse).contains("\"storeActive\":true");
    }

    private record LoginPayload(String email, String password) {
    }
}
