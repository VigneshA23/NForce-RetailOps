package com.nforce.retailops.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.OrderListEntry;
import com.nforce.retailops.entity.OrderStatus;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.StoreInventoryItemRepository;
import com.nforce.retailops.repository.OrderListEntryRepository;
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

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Covers the owner's low-stock badge count. Response shape deliberately mirrors
// NotificationController's /unread-count ({"count": n}), so the assertions here
// match that test class's form.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OrderListControllerTest {

    private static final String PASSWORD = "correct-horse-battery-staple";

    @Autowired private MockMvc mockMvc;
    @Autowired private RoleRepository roleRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private StoreRepository storeRepository;
    @Autowired private StoreOwnerRepository storeOwnerRepository;
    @Autowired private StoreInventoryItemRepository storeInventoryItemRepository;
    @Autowired private OrderListEntryRepository orderListEntryRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private int itemSeq = 0;

    private Role role(String name) {
        return roleRepository.findByName(name).orElseGet(() -> {
            Role role = new Role();
            role.setName(name);
            role.setDescription(name);
            return roleRepository.save(role);
        });
    }

    private User user(String email, String roleName, String fullName) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(PASSWORD));
        user.setFullName(fullName);
        user.getRoles().add(role(roleName));
        return userRepository.save(user);
    }

    private Store store(String name, long storeCode) {
        Store store = new Store();
        store.setName(name);
        store.setStoreCode(storeCode);
        store.setActive(true);
        return storeRepository.save(store);
    }

    private StoreOwner linkOwnerToStore(User owner, Store store) {
        StoreOwner link = new StoreOwner();
        link.setOwner(owner);
        link.setStore(store);
        return storeOwnerRepository.save(link);
    }

    // A distinct item per entry: V49's partial unique index forbids two
    // non-RECEIVED entries for the same store+item in production.
    private StoreInventoryItem inventoryItem(Store store) {

        StoreInventoryItem item = new StoreInventoryItem();
        item.setStore(store);
        item.setName("Item " + ++itemSeq);
        item.setUnitOfMeasurement("L");
        item.setActive(true);
        return storeInventoryItemRepository.save(item);
    }

    private OrderListEntry orderEntry(Store store, OrderStatus status) {
        OrderListEntry entry = new OrderListEntry();
        entry.setStore(store);
        entry.setStoreInventoryItem(inventoryItem(store));
        entry.setQuantityNeeded(2);
        entry.setStatus(status);
        return orderListEntryRepository.save(entry);
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
    void needsOrderingCountReturnsCountKey() throws Exception {
        User owner = user("ord-count-owner-a@nforce.test", "OWNER_ADMIN", "Owner A");
        Store store = store("Store Count A", 8200L);
        linkOwnerToStore(owner, store);

        orderEntry(store, OrderStatus.NEEDS_ORDERING);
        orderEntry(store, OrderStatus.NEEDS_ORDERING);
        orderEntry(store, OrderStatus.ORDERED);

        String token = login("ord-count-owner-a@nforce.test");

        mockMvc.perform(get("/api/stores/order-list/needs-ordering-count")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.count").value(2));
    }

    // The key must still be present at zero -- the frontend unwraps .count
    // unconditionally, so an empty body would surface as undefined.
    @Test
    @Transactional
    void needsOrderingCountIsZeroWhenNothingOutstanding() throws Exception {
        User owner = user("ord-count-owner-b@nforce.test", "OWNER_ADMIN", "Owner B");
        Store store = store("Store Count B", 8201L);
        linkOwnerToStore(owner, store);

        orderEntry(store, OrderStatus.RECEIVED);

        String token = login("ord-count-owner-b@nforce.test");

        mockMvc.perform(get("/api/stores/order-list/needs-ordering-count")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.count").value(0));
    }

    @Test
    @Transactional
    void needsOrderingCountIsScopedToTheCallersOwnStore() throws Exception {
        User ownerA = user("ord-count-owner-c@nforce.test", "OWNER_ADMIN", "Owner C");
        User ownerB = user("ord-count-owner-d@nforce.test", "OWNER_ADMIN", "Owner D");
        Store storeA = store("Store Count C", 8202L);
        Store storeB = store("Store Count D", 8203L);
        linkOwnerToStore(ownerA, storeA);
        linkOwnerToStore(ownerB, storeB);

        orderEntry(storeA, OrderStatus.NEEDS_ORDERING);
        orderEntry(storeB, OrderStatus.NEEDS_ORDERING);
        orderEntry(storeB, OrderStatus.NEEDS_ORDERING);
        orderEntry(storeB, OrderStatus.NEEDS_ORDERING);

        mockMvc.perform(get("/api/stores/order-list/needs-ordering-count")
                .header("Authorization", "Bearer " + login("ord-count-owner-c@nforce.test")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.count").value(1));

        mockMvc.perform(get("/api/stores/order-list/needs-ordering-count")
                .header("Authorization", "Bearer " + login("ord-count-owner-d@nforce.test")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.count").value(3));
    }

    // Pins the 404-not-403 masking inherited from requireActiveStoreOwner.
    @Test
    @Transactional
    void needsOrderingCountReturnsNotFoundWhenOwnerHasNoActiveStore() throws Exception {
        user("ord-count-owner-e@nforce.test", "OWNER_ADMIN", "Owner E");
        String token = login("ord-count-owner-e@nforce.test");

        mockMvc.perform(get("/api/stores/order-list/needs-ordering-count")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void needsOrderingCountRejectsAnEmployee() throws Exception {
        user("ord-count-emp-f@nforce.test", "EMPLOYEE", "Employee F");
        String token = login("ord-count-emp-f@nforce.test");

        mockMvc.perform(get("/api/stores/order-list/needs-ordering-count")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void createEntryFromInventoryAddsItToTheOrderList() throws Exception {
        User owner = user("ord-create-owner-a@nforce.test", "OWNER_ADMIN", "Owner Create A");
        Store store = store("Store Create A", 8204L);
        linkOwnerToStore(owner, store);
        StoreInventoryItem milk = inventoryItem(store);

        String token = login("ord-create-owner-a@nforce.test");
        String body = objectMapper.writeValueAsString(Map.of(
            "storeInventoryItemId", milk.getId(),
            "quantityNeeded", 4,
            "note", "Extra for Saturday event"
        ));

        mockMvc.perform(post("/api/stores/order-list")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.itemName").value(milk.getName()))
            .andExpect(jsonPath("$.quantityNeeded").value(4))
            .andExpect(jsonPath("$.status").value("NEEDS_ORDERING"));
    }

    @Test
    @Transactional
    void createEntryForACustomItemNotSavedToInventoryKeepsItOutOfTheInventoryList() throws Exception {
        User owner = user("ord-create-owner-b@nforce.test", "OWNER_ADMIN", "Owner Create B");
        Store store = store("Store Create B", 8205L);
        linkOwnerToStore(owner, store);

        String token = login("ord-create-owner-b@nforce.test");
        String body = objectMapper.writeValueAsString(Map.of(
            "itemName", "Birthday candles",
            "category", "SUPPLIES",
            "unitOfMeasurement", "packs",
            "saveToInventory", false,
            "quantityNeeded", 2
        ));

        mockMvc.perform(post("/api/stores/order-list")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.itemName").value("Birthday candles"));

        // Created as an inactive catalog item -- it shows up on the owner's
        // Inventory list, but flagged inactive rather than ready to count.
        String inventoryJson = mockMvc.perform(get("/api/stores/inventory")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        JsonNode candlesNode = null;
        for (JsonNode node : objectMapper.readTree(inventoryJson)) {
            if (node.get("name").asText().equals("Birthday candles")) {
                candlesNode = node;
                break;
            }
        }
        assertThat(candlesNode).isNotNull();
        assertThat(candlesNode.get("active").asBoolean()).isFalse();
    }

    @Test
    @Transactional
    void createEntryRejectsACustomItemMissingRequiredFields() throws Exception {
        User owner = user("ord-create-owner-c@nforce.test", "OWNER_ADMIN", "Owner Create C");
        linkOwnerToStore(owner, store("Store Create C", 8206L));

        String token = login("ord-create-owner-c@nforce.test");
        String body = objectMapper.writeValueAsString(Map.of("quantityNeeded", 1));

        mockMvc.perform(post("/api/stores/order-list")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Item name is required for a custom item"));
    }

    record LoginPayload(String email, String password) {}
}
