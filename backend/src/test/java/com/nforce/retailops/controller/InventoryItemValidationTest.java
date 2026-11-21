package com.nforce.retailops.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nforce.retailops.entity.InventoryCategory;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.InventoryCategoryRepository;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.StoreInventoryItemRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Inventory item names are compared normalised, and minimums must be above 0. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class InventoryItemValidationTest {

    private static final String PASSWORD = "correct-horse-battery-staple";

    @Autowired private MockMvc mockMvc;
    @Autowired private RoleRepository roleRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private StoreRepository storeRepository;
    @Autowired private StoreOwnerRepository storeOwnerRepository;
    @Autowired private StoreInventoryItemRepository itemRepository;
    @Autowired private InventoryCategoryRepository categoryRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private String token;
    private Store store;

    @BeforeEach
    void setUp() throws Exception {
        Role role = roleRepository.findByName("OWNER_ADMIN").orElseGet(() -> {
            Role r = new Role();
            r.setName("OWNER_ADMIN");
            r.setDescription("OWNER_ADMIN");
            return roleRepository.save(r);
        });
        User owner = new User();
        owner.setEmail("inv-validation-owner@nforce.test");
        owner.setPasswordHash(passwordEncoder.encode(PASSWORD));
        owner.setFullName("Validation Owner");
        owner.getRoles().add(role);
        owner = userRepository.save(owner);

        store = new Store();
        store.setName("Validation Store");
        store.setStoreCode(98101L);
        store.setActive(true);
        store = storeRepository.save(store);
        StoreOwner link = new StoreOwner();
        link.setOwner(owner);
        link.setStore(store);
        storeOwnerRepository.save(link);

        InventoryCategory category = new InventoryCategory();
        category.setName("Ingredients");
        category.setAppliesToAllStores(true);
        categoryRepository.save(category);

        String json = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("email", owner.getEmail(), "password", PASSWORD))))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        token = objectMapper.readTree(json).get("token").asText();
    }

    private String body(String name, Object minWeekday, Object minWeekend) throws Exception {
        java.util.Map<String, Object> b = new java.util.HashMap<>();
        b.put("name", name);
        b.put("category", "Ingredients");
        b.put("unitOfMeasurement", "Nos.");
        b.put("minWeekday", minWeekday);
        b.put("minWeekend", minWeekend);
        return objectMapper.writeValueAsString(b);
    }

    private ResultActions create(String name, Object minWeekday, Object minWeekend) throws Exception {
        return mockMvc.perform(post("/api/stores/inventory")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body(name, minWeekday, minWeekend)));
    }

    private long countNamed(String lowerTrimmed) {
        return itemRepository.findAll().stream()
            .filter(i -> i.getStore().getId().equals(store.getId()))
            .filter(i -> i.getName().strip().replaceAll("\\s+", " ").equalsIgnoreCase(lowerTrimmed))
            .count();
    }

    @Test
    void namesDifferingOnlyByCaseOrSpacesAreDuplicates() throws Exception {
        create("Vanilla Bean", 5, 5).andExpect(status().isCreated());

        for (String dup : new String[] {
            "vanilla bean", "VANILLA BEAN", "  Vanilla Bean  ", "Vanilla Bean\t",
            "Vanilla   Bean", " Vanilla Bean ", "Vanilla Bean",
        }) {
            create(dup, 5, 5).andExpect(status().isConflict());
        }
        assertThat(countNamed("vanilla bean")).isEqualTo(1);
    }

    @Test
    void savedNamesAreTidied() throws Exception {
        create("  Mint   Chip ", 5, 5)
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("Mint Chip"));
    }

    @Test
    void anOlderUntrimmedNameStillBlocksADuplicate() throws Exception {
        StoreInventoryItem legacy = new StoreInventoryItem();
        legacy.setStore(store);
        legacy.setName("Vanilla ");
        legacy.setCategory("Ingredients");
        legacy.setUnitOfMeasurement("Nos.");
        legacy.setMinWeekday(BigDecimal.ONE);
        legacy.setActive(true);
        itemRepository.save(legacy);

        create("vanilla", 5, 5).andExpect(status().isConflict());
    }

    @Test
    void renamingOntoAnotherItemsNameIsADuplicate() throws Exception {
        create("Vanilla", 5, 5).andExpect(status().isCreated());
        String json = create("Chocolate", 5, 5).andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        long chocolateId = objectMapper.readTree(json).get("id").asLong();

        mockMvc.perform(put("/api/stores/inventory/" + chocolateId)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(" VANILLA ", 5, 5)))
            .andExpect(status().isConflict());
    }

    @Test
    void minimumsMustBeAboveZero() throws Exception {
        create("Zero Weekday", 0, 5).andExpect(status().isBadRequest());
        create("Zero Weekend", 5, 0).andExpect(status().isBadRequest());
        create("Fractional Ok", 0.5, null).andExpect(status().isCreated());
    }
}
