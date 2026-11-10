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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Security finding: Owner/Admin supplier rename/deactivate/delete had no
// store-ownership check, and delete cleared preferredSupplier platform-wide.
// An owner may now change only a supplier their own store uses exclusively:
// another store's supplier is 404 (masked), a shared one is 403.
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
    private String tokenA;

    @BeforeEach
    void setUp() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        storeA = store("Ownership Store A", 8701L);
        storeB = store("Ownership Store B", 8702L);
        link(user("supplier-owner-a@nforce.test", ownerRole), storeA);
        link(user("supplier-owner-b@nforce.test", ownerRole), storeB);
        tokenA = login("supplier-owner-a@nforce.test");
    }

    // ---- cross-store: rejected as 404, supplier untouched ------------------

    @Test
    void ownerCannotRenameAnotherStoresSupplier() throws Exception {
        Supplier theirs = supplier("B Only Rename", storeB);

        mockMvc.perform(put("/api/stores/suppliers/" + theirs.getId())
                .header("Authorization", "Bearer " + tokenA)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Hijacked\"}"))
            .andExpect(status().isNotFound());

        assertThat(reload(theirs).getName()).isEqualTo("B Only Rename");
    }

    @Test
    void ownerCannotDeactivateAnotherStoresSupplier() throws Exception {
        Supplier theirs = supplier("B Only Status", storeB);

        mockMvc.perform(patch("/api/stores/suppliers/" + theirs.getId() + "/status")
                .header("Authorization", "Bearer " + tokenA)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"active\":false}"))
            .andExpect(status().isNotFound());

        assertThat(reload(theirs).isActive()).isTrue();
    }

    @Test
    void ownerCannotDeleteAnotherStoresSupplier_andTheirPreferenceSurvives() throws Exception {
        Supplier theirs = supplier("B Only Delete", storeB);
        StoreInventoryItem bItem = item(storeB, "B Milk", theirs);

        mockMvc.perform(delete("/api/stores/suppliers/" + theirs.getId())
                .header("Authorization", "Bearer " + tokenA))
            .andExpect(status().isNotFound());

        assertThat(supplierRepository.findById(theirs.getId())).isPresent();
        assertThat(reloadItem(bItem).getPreferredSupplier()).isNotNull();
    }

    @Test
    void ownerCannotChangeASupplierTheirStoreHasHidden() throws Exception {
        Supplier hidden = supplier("A Hidden", storeA);
        hidden.getHiddenAtStores().add(storeA);
        supplierRepository.save(hidden);

        mockMvc.perform(put("/api/stores/suppliers/" + hidden.getId())
                .header("Authorization", "Bearer " + tokenA)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Renamed Hidden\"}"))
            .andExpect(status().isNotFound());
    }

    // ---- shared with another store: 403 -----------------------------------

    @Test
    void ownerCannotRenameASupplierAssignedToAnotherStoreToo() throws Exception {
        Supplier shared = supplier("Shared Assigned", storeA, storeB);

        mockMvc.perform(put("/api/stores/suppliers/" + shared.getId())
                .header("Authorization", "Bearer " + tokenA)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Renamed Shared\"}"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.message").exists());

        assertThat(reload(shared).getName()).isEqualTo("Shared Assigned");
    }

    @Test
    void ownerCannotDeleteAnAllStoresSupplier() throws Exception {
        Supplier global = supplier("Global Supplier");
        global.setAppliesToAllStores(true);
        supplierRepository.save(global);
        StoreInventoryItem bItem = item(storeB, "B Bread", global);

        mockMvc.perform(delete("/api/stores/suppliers/" + global.getId())
                .header("Authorization", "Bearer " + tokenA))
            .andExpect(status().isForbidden());

        assertThat(supplierRepository.findById(global.getId())).isPresent();
        assertThat(reloadItem(bItem).getPreferredSupplier()).isNotNull();
    }

    @Test
    void ownerCannotDeactivateASupplierAnotherStoresItemsPrefer() throws Exception {
        // Assigned only to A, but B's item still points at it.
        Supplier usedByB = supplier("Preferred By B", storeA);
        item(storeB, "B Eggs", usedByB);

        mockMvc.perform(patch("/api/stores/suppliers/" + usedByB.getId() + "/status")
                .header("Authorization", "Bearer " + tokenA)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"active\":false}"))
            .andExpect(status().isForbidden());

        assertThat(reload(usedByB).isActive()).isTrue();
    }

    // ---- the caller's own exclusive supplier: still allowed ----------------

    @Test
    void ownerCanRenameAndDeactivateTheirOwnSupplier() throws Exception {
        Supplier mine = supplier("A Only", storeA);

        mockMvc.perform(put("/api/stores/suppliers/" + mine.getId())
                .header("Authorization", "Bearer " + tokenA)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"A Only Renamed\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("A Only Renamed"));

        mockMvc.perform(patch("/api/stores/suppliers/" + mine.getId() + "/status")
                .header("Authorization", "Bearer " + tokenA)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"active\":false}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.active").value(false));
    }

    @Test
    void ownerCanDeleteTheirOwnSupplier_clearingOnlyTheirItems() throws Exception {
        Supplier mine = supplier("A Delete", storeA);
        StoreInventoryItem aItem = item(storeA, "A Milk", mine);

        mockMvc.perform(delete("/api/stores/suppliers/" + mine.getId())
                .header("Authorization", "Bearer " + tokenA))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.deleted").value(true));

        assertThat(supplierRepository.findById(mine.getId())).isEmpty();
        assertThat(reloadItem(aItem).getPreferredSupplier()).isNull();
    }

    @Test
    void scopedClearLeavesOtherStoresPreferencesAlone() {
        Supplier supplier = supplier("Scoped Clear", storeA);
        StoreInventoryItem aItem = item(storeA, "A Juice", supplier);
        StoreInventoryItem bItem = item(storeB, "B Juice", supplier);

        int cleared = itemRepository.clearPreferredSupplierForStore(supplier.getId(), storeA.getId());

        assertThat(cleared).isEqualTo(1);
        assertThat(reloadItem(aItem).getPreferredSupplier()).isNull();
        assertThat(reloadItem(bItem).getPreferredSupplier()).isNotNull();
    }

    // ---- Super Admin keeps platform-wide delete ----------------------------

    @Test
    void superAdminCanStillDeleteASharedSupplier() throws Exception {
        superAdmin("supplier-ownership-sa@nforce.test");
        String saToken = login("supplier-ownership-sa@nforce.test");
        Supplier shared = supplier("Shared For SA", storeA, storeB);
        StoreInventoryItem bItem = item(storeB, "B Cheese", shared);

        mockMvc.perform(delete("/api/stores/suppliers/" + shared.getId())
                .header("Authorization", "Bearer " + saToken))
            .andExpect(status().isOk());

        assertThat(supplierRepository.findById(shared.getId())).isEmpty();
        assertThat(reloadItem(bItem).getPreferredSupplier()).isNull();
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

    private SuperAdmin superAdmin(String email) {
        SuperAdmin sa = new SuperAdmin();
        sa.setName("Super Admin");
        sa.setEmail(email);
        sa.setPasswordHash(passwordEncoder.encode(PASSWORD));
        return superAdminRepository.save(sa);
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
