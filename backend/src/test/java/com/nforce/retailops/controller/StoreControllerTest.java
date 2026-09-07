package com.nforce.retailops.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nforce.retailops.entity.Category;
import com.nforce.retailops.entity.CompletionType;
import com.nforce.retailops.entity.ResponseType;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.ScheduleType;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.Task;
import com.nforce.retailops.entity.TimeMode;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.CategoryRepository;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.TaskRepository;
import com.nforce.retailops.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import java.time.LocalDate;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
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
    @Autowired private TaskRepository taskRepository;
    @Autowired private CategoryRepository categoryRepository;
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

    @Test
    @Transactional
    void ownerAdminCannotListAllStores() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        User owner = user("store-all-denied@nforce.test", ownerRole);
        linkOwnerToStore(owner, store("Denied Directory Store", 8006L));

        String token = login("store-all-denied@nforce.test");

        mockMvc.perform(get("/api/stores/all")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void superAdminCanListAllStoresAcrossOwners() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role superRole = role("SUPER_ADMIN");
        User owner = user("store-all-owner@nforce.test", ownerRole);
        user("store-all-super@nforce.test", superRole);
        linkOwnerToStore(owner, store("Directory Test Store", 8007L));

        String token = login("store-all-super@nforce.test");

        mockMvc.perform(get("/api/stores/all")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[*].storeName", org.hamcrest.Matchers.hasItem("Directory Test Store")))
            .andExpect(jsonPath("$[*].ownerName", org.hamcrest.Matchers.hasItem("Test User")))
            .andExpect(jsonPath("$[?(@.storeName=='Directory Test Store')].ownerAccessActive",
                org.hamcrest.Matchers.hasItem(true)));
    }

    @Test
    @Transactional
    void aStoreWithARevokedOwnerLinkIsReportedAsHavingNoActiveOwnerAccess() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role superRole = role("SUPER_ADMIN");
        User owner = user("store-revoked-owner@nforce.test", ownerRole);
        user("store-revoked-super@nforce.test", superRole);
        Store store = store("Revoked Access Store", 8008L);
        StoreOwner storeOwner = new StoreOwner();
        storeOwner.setOwner(owner);
        storeOwner.setStore(store);
        storeOwner.setActive(false);
        storeOwnerRepository.save(storeOwner);

        String token = login("store-revoked-super@nforce.test");

        mockMvc.perform(get("/api/stores/all")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            // The store itself is still active/open -- only the owner's access
            // to it was revoked.
            .andExpect(jsonPath("$[?(@.storeName=='Revoked Access Store')].storeActive",
                org.hamcrest.Matchers.hasItem(true)))
            .andExpect(jsonPath("$[?(@.storeName=='Revoked Access Store')].ownerName",
                org.hamcrest.Matchers.hasItem("Test User")))
            .andExpect(jsonPath("$[?(@.storeName=='Revoked Access Store')].ownerAccessActive",
                org.hamcrest.Matchers.hasItem(false)));
    }

    @Test
    @Transactional
    void ownerAdminCannotCreateAStore() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        user("store-create-denied@nforce.test", ownerRole);

        String token = login("store-create-denied@nforce.test");

        mockMvc.perform(post("/api/stores")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Attempted Store\",\"location\":\"Nowhere\"}"))
            .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void superAdminCanCreateAnUnownedStoreAndItAppearsAsReassignable() throws Exception {
        Role superRole = role("SUPER_ADMIN");
        user("store-create-super@nforce.test", superRole);

        String token = login("store-create-super@nforce.test");

        mockMvc.perform(post("/api/stores")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Unowned Store\",\"location\":\"Midtown\"}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.storeName").value("Unowned Store"))
            .andExpect(jsonPath("$.ownerId").value(org.hamcrest.Matchers.nullValue()))
            // The store itself is active/open even with no owner assigned yet --
            // storeActive must reflect the store, not the (necessarily inactive)
            // owner link used for reassignment.
            .andExpect(jsonPath("$.storeActive").value(true))
            .andExpect(jsonPath("$.ownerAccessActive").value(false));

        mockMvc.perform(get("/api/owners/reassignable-stores")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[*].storeName", org.hamcrest.Matchers.hasItem("Unowned Store")));

        mockMvc.perform(get("/api/stores/all")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[?(@.storeName=='Unowned Store')].storeActive", org.hamcrest.Matchers.hasItem(true)));
    }

    @Test
    @Transactional
    void superAdminCannotDeleteStoreWithTaskHistory() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role superRole = role("SUPER_ADMIN");
        User owner = user("store-history-owner@nforce.test", ownerRole);
        user("store-history-super@nforce.test", superRole);
        Store store = store("Store With History", 8011L);
        linkOwnerToStore(owner, store);
        taskForStore(owner, store);

        String token = login("store-history-super@nforce.test");

        mockMvc.perform(delete("/api/stores/" + store.getId())
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.message").value(
                "This store has checklist history and cannot be deleted. Deactivate it instead."));
    }

    @Test
    @Transactional
    void superAdminCanDeleteStoreWithNoHistory() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role superRole = role("SUPER_ADMIN");
        User owner = user("store-nohistory-owner@nforce.test", ownerRole);
        user("store-nohistory-super@nforce.test", superRole);
        Store store = store("Store With No History", 8012L);
        linkOwnerToStore(owner, store);

        String token = login("store-nohistory-super@nforce.test");

        mockMvc.perform(delete("/api/stores/" + store.getId())
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isNoContent());
    }

    @Test
    @Transactional
    void ownerAdminCannotToggleStoreStatus() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        User owner = user("store-status-denied@nforce.test", ownerRole);
        Store store = store("Status Denied Store", 8009L);
        linkOwnerToStore(owner, store);

        String token = login("store-status-denied@nforce.test");

        mockMvc.perform(patch("/api/stores/" + store.getId() + "/status")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"active\":false}"))
            .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void superAdminCanToggleStoreActiveStatusAndItPersistsWithoutAffectingOwnerAccess() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role superRole = role("SUPER_ADMIN");
        User owner = user("store-status-owner@nforce.test", ownerRole);
        user("store-status-super@nforce.test", superRole);
        Store store = store("Status Toggle Store", 8010L);
        linkOwnerToStore(owner, store);

        String token = login("store-status-super@nforce.test");

        mockMvc.perform(patch("/api/stores/" + store.getId() + "/status")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"active\":false}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.storeActive").value(false))
            // Deactivating the store itself must not touch the owner's access.
            .andExpect(jsonPath("$.ownerName").value("Test User"))
            .andExpect(jsonPath("$.ownerAccessActive").value(true));

        mockMvc.perform(get("/api/stores/all")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[?(@.storeName=='Status Toggle Store')].storeActive",
                org.hamcrest.Matchers.hasItem(false)));

        mockMvc.perform(patch("/api/stores/" + store.getId() + "/status")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"active\":true}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.storeActive").value(true))
            .andExpect(jsonPath("$.ownerAccessActive").value(true));
    }

    private void taskForStore(User owner, Store store) {
        Category category = new Category();
        category.setName("Test Category " + store.getId());
        category.setOwner(owner);
        category.setDisplayOrder(1);
        category = categoryRepository.save(category);

        Task task = new Task();
        task.setOwner(owner);
        task.setCategory(category);
        task.setName("Test Task");
        task.setAppliesToAllStores(false);
        task.setResponseType(ResponseType.YES_NO);
        task.setCompletionType(CompletionType.SINGLE);
        task.setScheduleType(ScheduleType.EVERY_DAY);
        task.setTimeMode(TimeMode.ANYTIME);
        task.setStartDate(LocalDate.now());
        task.getStores().add(store);
        taskRepository.save(task);
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
