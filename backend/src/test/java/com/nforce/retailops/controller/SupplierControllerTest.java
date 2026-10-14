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

import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Real-DB, real-JWT round trip for Super Admin's extended Add/Edit Supplier
// form (SupplierDetailsRequest, as opposed to the inline quick-add covered by
// StoreControllerTest's own supplier tests) -- specifically proving a
// supplier assigned to SPECIFIC stores (not appliesToAllStores) is visible to
// that store's own Owner/Admin via GET /api/stores/suppliers, and invisible
// to a different store's Owner/Admin. Closes the coverage gap that let a
// regression in SupplierService.listSuppliersForStore's own store-scoping
// filter ship unnoticed: every other test either mocked the repository or
// only asserted the create/update response shape, never re-fetching through
// the owner-facing endpoint afterward.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SupplierControllerTest {

    private static final String PASSWORD = "correct-horse-battery-staple";

    @Autowired private MockMvc mockMvc;
    @Autowired private RoleRepository roleRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private StoreRepository storeRepository;
    @Autowired private StoreOwnerRepository storeOwnerRepository;
    @Autowired private SuperAdminRepository superAdminRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @Transactional
    void supplierAssignedToASpecificStoreIsVisibleToThatStoresOwnerAndNoOther() throws Exception {
        superAdmin("sa-supplier-scope@nforce.test");
        Store targetStore = store("Supplier Scope Target", 8300L);
        Store otherStore = store("Supplier Scope Other", 8301L);

        User targetOwner = user("supplier-scope-owner-target@nforce.test");
        linkOwnerToStore(targetOwner, targetStore);
        User otherOwner = user("supplier-scope-owner-other@nforce.test");
        linkOwnerToStore(otherOwner, otherStore);

        String superAdminToken = login("sa-supplier-scope@nforce.test");

        String createBody = objectMapper.writeValueAsString(new SupplierDetailsPayload(
            "Scoped Supplier", null, null, false, List.of(targetStore.getId())));
        mockMvc.perform(post("/api/super-admin/suppliers")
                .header("Authorization", "Bearer " + superAdminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(createBody))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.appliesToAllStores").value(false))
            .andExpect(jsonPath("$.stores[0].id").value(targetStore.getId()));

        String targetOwnerToken = login("supplier-scope-owner-target@nforce.test");
        mockMvc.perform(get("/api/stores/suppliers")
                .header("Authorization", "Bearer " + targetOwnerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[?(@.name == 'Scoped Supplier')]").exists());

        String otherOwnerToken = login("supplier-scope-owner-other@nforce.test");
        mockMvc.perform(get("/api/stores/suppliers")
                .header("Authorization", "Bearer " + otherOwnerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[?(@.name == 'Scoped Supplier')]").doesNotExist());
    }

    @Test
    @Transactional
    void supplierMarkedAppliesToAllStoresIsVisibleToEveryOwner() throws Exception {
        superAdmin("sa-supplier-global@nforce.test");
        Store storeA = store("Supplier Global Store A", 8302L);
        Store storeB = store("Supplier Global Store B", 8303L);

        User ownerA = user("supplier-global-owner-a@nforce.test");
        linkOwnerToStore(ownerA, storeA);
        User ownerB = user("supplier-global-owner-b@nforce.test");
        linkOwnerToStore(ownerB, storeB);

        String superAdminToken = login("sa-supplier-global@nforce.test");

        String createBody = objectMapper.writeValueAsString(new SupplierDetailsPayload(
            "Global Supplier", null, null, true, List.of()));
        mockMvc.perform(post("/api/super-admin/suppliers")
                .header("Authorization", "Bearer " + superAdminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(createBody))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.appliesToAllStores").value(true));

        for (String email : List.of("supplier-global-owner-a@nforce.test", "supplier-global-owner-b@nforce.test")) {
            String token = login(email);
            mockMvc.perform(get("/api/stores/suppliers")
                    .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.name == 'Global Supplier')]").exists());
        }
    }

    private Role role(String name) {
        return roleRepository.findByName(name).orElseGet(() -> {
            Role role = new Role();
            role.setName(name);
            role.setDescription(name);
            return roleRepository.save(role);
        });
    }

    private User user(String email) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(PASSWORD));
        user.setFullName("Test User");
        user.getRoles().add(role("OWNER_ADMIN"));
        return userRepository.save(user);
    }

    private Store store(String name, long storeCode) {
        Store store = new Store();
        store.setName(name);
        store.setStoreCode(storeCode);
        store.setActive(true);
        return storeRepository.save(store);
    }

    private SuperAdmin superAdmin(String email) {
        SuperAdmin sa = new SuperAdmin();
        sa.setName("Super Admin");
        sa.setEmail(email);
        sa.setPasswordHash(passwordEncoder.encode(PASSWORD));
        return superAdminRepository.save(sa);
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

    private record SupplierDetailsPayload(
        String name, String contact, String location, boolean appliesToAllStores, List<Long> storeIds
    ) {}
}
