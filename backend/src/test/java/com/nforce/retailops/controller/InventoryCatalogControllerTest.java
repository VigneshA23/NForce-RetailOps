package com.nforce.retailops.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.StockCheck;
import com.nforce.retailops.entity.StockCheckSnapshot;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.StockCheckRepository;
import com.nforce.retailops.repository.StoreInventoryItemRepository;
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

import java.time.LocalDate;
import java.time.OffsetDateTime;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class InventoryCatalogControllerTest {

    private static final String PASSWORD = "correct-horse-battery-staple";

    @Autowired private MockMvc mockMvc;
    @Autowired private RoleRepository roleRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private StoreRepository storeRepository;
    @Autowired private StoreOwnerRepository storeOwnerRepository;
    @Autowired private StoreInventoryItemRepository storeInventoryItemRepository;
    @Autowired private StockCheckRepository stockCheckRepository;
    @Autowired private SuperAdminRepository superAdminRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private Role ownerRole() {
        return roleRepository.findByName("OWNER_ADMIN").orElseGet(() -> {
            Role role = new Role();
            role.setName("OWNER_ADMIN");
            role.setDescription("OWNER_ADMIN");
            return roleRepository.save(role);
        });
    }

    private User owner(String email) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(PASSWORD));
        user.setFullName("Test Owner");
        user.getRoles().add(ownerRole());
        return userRepository.save(user);
    }

    private SuperAdmin superAdmin(String email) {
        SuperAdmin sa = new SuperAdmin();
        sa.setName("Super Admin");
        sa.setEmail(email);
        sa.setPasswordHash(passwordEncoder.encode(PASSWORD));
        return superAdminRepository.save(sa);
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

    private StoreInventoryItem item(Store store, String name, Integer minWeekday) {
        StoreInventoryItem item = new StoreInventoryItem();
        item.setStore(store);
        item.setName(name);
        item.setUnitOfMeasurement("ct");
        item.setMinWeekday(minWeekday);
        item.setMinWeekend(minWeekday);
        item.setActive(true);
        return storeInventoryItemRepository.save(item);
    }

    private void check(StoreInventoryItem item, User by, LocalDate date, int available) {
        StockCheck check = new StockCheck();
        check.setStore(item.getStore());
        check.setStoreInventoryItem(item);
        check.setCheckDate(date);
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, available, 0, by, OffsetDateTime.now());
        stockCheckRepository.save(check);
    }

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
    void stockComparisonRequiresSuperAdminRole() throws Exception {
        owner("sic-owner-a@nforce.test");
        String ownerToken = login("sic-owner-a@nforce.test");

        mockMvc.perform(get("/api/super-admin/inventory/stock-comparison")
                .header("Authorization", "Bearer " + ownerToken)
                .param("itemName", "Napkins"))
            .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void stockComparisonMarksAnUnassignedStoreWithoutZeroingItsFields() throws Exception {
        superAdmin("sic-admin-b@nforce.test");
        User owner = owner("sic-owner-b@nforce.test");
        Store assignedStore = store("Store With Napkins", 9400L);
        Store unassignedStore = store("Store Without Napkins", 9401L);
        linkOwnerToStore(owner, assignedStore);
        linkOwnerToStore(owner, unassignedStore);

        StoreInventoryItem napkins = item(assignedStore, "Napkins", 10);
        check(napkins, owner, LocalDate.now(), 5);

        String token = login("sic-admin-b@nforce.test");

        mockMvc.perform(get("/api/super-admin/inventory/stock-comparison")
                .header("Authorization", "Bearer " + token)
                .param("itemName", "napkins"))
            .andExpect(status().isOk())
            // Alphabetical by store name ("With" sorts before "Without" as its
            // own prefix), matching StoreRepository.findByActiveTrueOrderByName.
            .andExpect(jsonPath("$[0].storeName").value("Store With Napkins"))
            .andExpect(jsonPath("$[0].assigned").value(true))
            .andExpect(jsonPath("$[0].requiredToday").value(10))
            .andExpect(jsonPath("$[0].currentAvailable").value(5))
            .andExpect(jsonPath("$[0].status").value("LOW"))
            .andExpect(jsonPath("$[1].storeName").value("Store Without Napkins"))
            .andExpect(jsonPath("$[1].assigned").value(false))
            .andExpect(jsonPath("$[1].requiredToday").value(org.hamcrest.Matchers.nullValue()))
            .andExpect(jsonPath("$[1].currentAvailable").value(org.hamcrest.Matchers.nullValue()))
            .andExpect(jsonPath("$[1].status").value(org.hamcrest.Matchers.nullValue()));
    }

    private record LoginPayload(String email, String password) {
    }
}
