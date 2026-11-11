package com.nforce.retailops.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.entity.Supplier;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.StoreInventoryItemRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.SuperAdminRepository;
import com.nforce.retailops.repository.SupplierRepository;
import com.nforce.retailops.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Security finding: Owner/Admin could rename, deactivate or delete any
// store's supplier through /api/stores/suppliers/{id}. The Owner/Admin UI
// has none of those actions, so the three owner routes were removed. These
// tests pin that (1) an Owner/Admin can no longer rename, deactivate or
// delete a supplier, and (2) every supplier API that remains -- Owner/Admin's
// list / inline add / hide, and all of Super Admin's -- still works.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class StoreSupplierOwnershipTest {

    private static final String PASSWORD = "correct-horse-battery-staple";

    @Autowired private MockMvc mockMvc;
    @Autowired private RoleRepository roleRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private StoreRepository storeRepository;
    @Autowired private StoreOwnerRepository storeOwnerRepository;
    @Autowired private SupplierRepository supplierRepository;
    @Autowired private StoreInventoryItemRepository itemRepository;
    @Autowired private SuperAdminRepository superAdminRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private EntityManager entityManager;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private Store storeA;
    private Store storeB;
    private String ownerToken;

    @BeforeEach
    void setUp() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        storeA = store("Supplier Routes Store A", 8701L);
        storeB = store("Supplier Routes Store B", 8702L);
        link(user("supplier-routes-owner@nforce.test", ownerRole), storeA);
        ownerToken = login("supplier-routes-owner@nforce.test");
    }

    // ---- removed for Owner/Admin -------------------------------------------

    @Test
    void ownerCanNoLongerRenameASupplier() throws Exception {
        Supplier supplier = supplier("Rename Target", storeA);

        int status = mockMvc.perform(put("/api/stores/suppliers/" + supplier.getId())
                .header("Authorization", "Bearer " + ownerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Renamed\"}"))
            .andReturn().getResponse().getStatus();

        assertThat(status / 100).as("HTTP status %s", status).isNotEqualTo(2);
        assertThat(reload(supplier).getName()).isEqualTo("Rename Target");
    }

    @Test
    void ownerCanNoLongerDeactivateASupplier() throws Exception {
        Supplier supplier = supplier("Deactivate Target", storeA);

        int status = mockMvc.perform(patch("/api/stores/suppliers/" + supplier.getId() + "/status")
                .header("Authorization", "Bearer " + ownerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"active\":false}"))
            .andReturn().getResponse().getStatus();

        assertThat(status / 100).as("HTTP status %s", status).isNotEqualTo(2);
        assertThat(reload(supplier).isActive()).isTrue();
    }

    @Test
    void ownerCanNoLongerDeleteASupplier_evenAnotherStoresPreferenceSurvives() throws Exception {
        Supplier supplier = supplier("Delete Target", storeB);
        StoreInventoryItem bItem = item(storeB, "B Milk", supplier);

        mockMvc.perform(delete("/api/stores/suppliers/" + supplier.getId())
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isForbidden());

        assertThat(supplierRepository.findById(supplier.getId())).isPresent();
        assertThat(reloadItem(bItem).getPreferredSupplier()).isNotNull();
    }

    // ---- Owner/Admin supplier APIs that remain -----------------------------

    @Test
    void ownerCanStillListAddAndHideSuppliers() throws Exception {
        mockMvc.perform(post("/api/stores/suppliers")
                .header("Authorization", "Bearer " + ownerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Regression Inline Supplier\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Regression Inline Supplier"));

        Supplier mine = supplier("Regression Listed", storeA);
        mockMvc.perform(get("/api/stores/suppliers")
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[?(@.name == 'Regression Listed')]").exists());

        mockMvc.perform(delete("/api/stores/suppliers/" + mine.getId() + "/hide")
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/stores/suppliers")
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(jsonPath("$[?(@.name == 'Regression Listed')]").doesNotExist());
    }

    // ---- Super Admin unaffected --------------------------------------------

    @Test
    void superAdminCanStillDeleteThroughTheStoresRoute() throws Exception {
        String saToken = superAdminToken("supplier-routes-sa1@nforce.test");
        Supplier supplier = supplier("SA Store-Route Delete", storeA, storeB);
        StoreInventoryItem bItem = item(storeB, "B Cheese", supplier);

        mockMvc.perform(delete("/api/stores/suppliers/" + supplier.getId())
                .header("Authorization", "Bearer " + saToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.deleted").value(true));

        assertThat(supplierRepository.findById(supplier.getId())).isEmpty();
        assertThat(reloadItem(bItem).getPreferredSupplier()).isNull();
    }

    @Test
    void superAdminSupplierManagementStillWorks() throws Exception {
        String saToken = superAdminToken("supplier-routes-sa2@nforce.test");
        Supplier supplier = supplier("SA Managed", storeA);

        mockMvc.perform(put("/api/super-admin/suppliers/" + supplier.getId())
                .header("Authorization", "Bearer " + saToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"SA Managed Renamed\",\"appliesToAllStores\":true}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("SA Managed Renamed"));

        mockMvc.perform(patch("/api/super-admin/suppliers/" + supplier.getId() + "/status")
                .header("Authorization", "Bearer " + saToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"active\":false}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.active").value(false));

        mockMvc.perform(delete("/api/super-admin/suppliers/" + supplier.getId())
                .header("Authorization", "Bearer " + saToken))
            .andExpect(status().isOk());
        assertThat(supplierRepository.findById(supplier.getId())).isEmpty();
    }

    // ---- helpers -----------------------------------------------------------

    private Supplier supplier(String name, Store... stores) {
        Supplier s = new Supplier();
        s.setName(name);
        for (Store store : stores) {
            s.getStores().add(store);
        }
        return supplierRepository.save(s);
    }

    private StoreInventoryItem item(Store store, String name, Supplier preferred) {
        StoreInventoryItem i = new StoreInventoryItem();
        i.setStore(store);
        i.setName(name);
        i.setUnitOfMeasurement("EA");
        i.setActive(true);
        i.setPreferredSupplier(preferred);
        return itemRepository.saveAndFlush(i);
    }

    private Supplier reload(Supplier s) {
        entityManager.flush();
        entityManager.clear();
        return supplierRepository.findById(s.getId()).orElseThrow();
    }

    private StoreInventoryItem reloadItem(StoreInventoryItem i) {
        entityManager.flush();
        entityManager.clear();
        return itemRepository.findById(i.getId()).orElseThrow();
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

    private void link(User owner, Store store) {
        StoreOwner storeOwner = new StoreOwner();
        storeOwner.setOwner(owner);
        storeOwner.setStore(store);
        storeOwnerRepository.save(storeOwner);
    }

    private String superAdminToken(String email) throws Exception {
        SuperAdmin sa = new SuperAdmin();
        sa.setName("Super Admin");
        sa.setEmail(email);
        sa.setPasswordHash(passwordEncoder.encode(PASSWORD));
        superAdminRepository.save(sa);
        return login(email);
    }

    private String login(String email) throws Exception {
        String body = objectMapper.writeValueAsString(new LoginPayload(email, PASSWORD));
        String json = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
        return objectMapper.readTree(json).get("token").asText();
    }

    private record LoginPayload(String email, String password) {}
}
