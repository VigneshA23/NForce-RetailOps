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

import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * One Owner/Admin across several stores: Super Admin assign/unassign rules, the
 * one-active-admin-per-store 409, and the X-Store-Id scoping every owner
 * request goes through.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class MultiStoreAdminTest {

    private static final String PASSWORD = "correct-horse-battery-staple";
    private static final AtomicLong STORE_CODE = new AtomicLong(81000L);
    private static final String CONFLICT = "An admin is already assigned to this store";

    @Autowired private MockMvc mockMvc;
    @Autowired private RoleRepository roleRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private StoreRepository storeRepository;
    @Autowired private StoreOwnerRepository storeOwnerRepository;
    @Autowired private SuperAdminRepository superAdminRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private Role ownerRole;
    private String saToken;

    @BeforeEach
    void setUp() throws Exception {
        ownerRole = roleRepository.findByName("OWNER_ADMIN").orElseGet(() -> {
            Role role = new Role();
            role.setName("OWNER_ADMIN");
            return roleRepository.save(role);
        });
        SuperAdmin sa = new SuperAdmin();
        sa.setName("SA Multi Store");
        sa.setEmail("sa-multistore@nforce.test");
        sa.setPasswordHash(passwordEncoder.encode(PASSWORD));
        superAdminRepository.save(sa);
        saToken = login("sa-multistore@nforce.test");
    }

    // ---- Super Admin: assign / 409 / unassign ------------------------------

    @Test
    void adminCanBeActiveOnSeveralStoresAtOnce() throws Exception {
        User owner = owner("multi-a@nforce.test");
        Store first = vacantStore("Alpha");
        Store second = vacantStore("Beta");

        assign(owner, first).andExpect(status().isCreated());
        assign(owner, second).andExpect(status().isCreated());

        assertThat(storeOwnerRepository.findActiveWithStoreByOwnerId(owner.getId())).hasSize(2);
        mockMvc.perform(get("/api/owner-stores").header("Authorization", bearer(login(owner.getEmail()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(2)))
            .andExpect(jsonPath("$[0].name").value("Alpha"))
            .andExpect(jsonPath("$[1].name").value("Beta"));
    }

    @Test
    void assigningAStoreThatAlreadyHasAnAdminIs409AndChangesNothing() throws Exception {
        User holder = owner("holder@nforce.test");
        User other = owner("other@nforce.test");
        Store store = vacantStore("Gamma");
        assign(holder, store).andExpect(status().isCreated());

        assign(other, store)
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.message").value(CONFLICT));

        StoreOwner link = storeOwnerRepository.findByStoreId(store.getId()).orElseThrow();
        assertThat(link.isActive()).isTrue();
        assertThat(link.getOwner().getId()).isEqualTo(holder.getId());
        assertThat(storeOwnerRepository.findActiveWithStoreByOwnerId(other.getId())).isEmpty();
    }

    @Test
    void reassigningFromTheStoresPageIsAlso409WhileAnotherAdminIsActive() throws Exception {
        User holder = owner("holder2@nforce.test");
        User other = owner("other2@nforce.test");
        Store store = vacantStore("Delta");
        assign(holder, store).andExpect(status().isCreated());

        mockMvc.perform(patch("/api/stores/" + store.getId() + "/assign-owner")
                .header("Authorization", bearer(saToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"ownerId\":" + other.getId() + "}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.message").value(CONFLICT));
        assertThat(storeOwnerRepository.findByStoreId(store.getId()).orElseThrow().getOwner().getId())
            .isEqualTo(holder.getId());
    }

    @Test
    void unassigningSoftReleasesTheLinkAndFreesTheStoreForAnotherAdmin() throws Exception {
        User first = owner("first@nforce.test");
        User second = owner("second@nforce.test");
        Store store = vacantStore("Epsilon");
        assign(first, store).andExpect(status().isCreated());

        mockMvc.perform(delete("/api/owners/" + first.getId() + "/stores/" + store.getId())
                .header("Authorization", bearer(saToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].storeId").doesNotExist());

        // Deactivated, not deleted: vacant, vacancy clock running, and the
        // previous admin kept as last owner so employees still see the tasks.
        StoreOwner link = storeOwnerRepository.findByStoreId(store.getId()).orElseThrow();
        assertThat(link.isActive()).isFalse();
        assertThat(link.getOwner()).isNull();
        assertThat(link.getLastOwner().getId()).isEqualTo(first.getId());
        assertThat(link.getOwnerVacantSince()).isNotNull();
        assertThat(link.resolveTaskOwnerId()).isEqualTo(first.getId());

        assign(second, store).andExpect(status().isCreated());
        StoreOwner reassigned = storeOwnerRepository.findByStoreId(store.getId()).orElseThrow();
        assertThat(reassigned.isActive()).isTrue();
        assertThat(reassigned.getOwner().getId()).isEqualTo(second.getId());
        assertThat(reassigned.getOwnerVacantSince()).isNull();
    }

    @Test
    void unassigningAStoreTheAdminDoesNotHoldIs404() throws Exception {
        User holder = owner("holder3@nforce.test");
        User stranger = owner("stranger@nforce.test");
        Store store = vacantStore("Zeta");
        assign(holder, store).andExpect(status().isCreated());

        mockMvc.perform(delete("/api/owners/" + stranger.getId() + "/stores/" + store.getId())
                .header("Authorization", bearer(saToken)))
            .andExpect(status().isNotFound());
        assertThat(storeOwnerRepository.findByStoreId(store.getId()).orElseThrow().isActive()).isTrue();
    }

    @Test
    void deactivatingAnAdminReleasesEveryOneOfTheirStores() throws Exception {
        User owner = owner("deact-multi@nforce.test");
        Store first = vacantStore("Eta");
        Store second = vacantStore("Theta");
        assign(owner, first).andExpect(status().isCreated());
        assign(owner, second).andExpect(status().isCreated());

        mockMvc.perform(patch("/api/owners/" + owner.getId() + "/status")
                .header("Authorization", bearer(saToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"active\":false}"))
            .andExpect(status().isOk());

        assertThat(storeOwnerRepository.findActiveWithStoreByOwnerId(owner.getId())).isEmpty();
        assertThat(storeOwnerRepository.findByStoreId(first.getId()).orElseThrow().isActive()).isFalse();
        assertThat(storeOwnerRepository.findByStoreId(second.getId()).orElseThrow().isActive()).isFalse();
    }

    // ---- Owner/Admin: store scoping ----------------------------------------

    @Test
    void adminWithNoStoresCanSignInAndGetsAnEmptyStoreList() throws Exception {
        User owner = owner("nostores@nforce.test");
        String token = login(owner.getEmail());

        mockMvc.perform(get("/api/owner-stores").header("Authorization", bearer(token)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(0)));
        mockMvc.perform(get("/api/stores").header("Authorization", bearer(token)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void ownerRequestsAreScopedToTheSelectedStore() throws Exception {
        User owner = owner("scoped@nforce.test");
        Store first = vacantStore("Iota");
        Store second = vacantStore("Kappa");
        assign(owner, first).andExpect(status().isCreated());
        assign(owner, second).andExpect(status().isCreated());
        String token = login(owner.getEmail());

        mockMvc.perform(get("/api/stores").header("Authorization", bearer(token))
                .header("X-Store-Id", first.getId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].id").value(first.getId()));
        mockMvc.perform(get("/api/stores").header("Authorization", bearer(token))
                .header("X-Store-Id", second.getId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value(second.getId()));
    }

    @Test
    void severalStoresAndNoSelectionIs404() throws Exception {
        User owner = owner("ambiguous@nforce.test");
        assign(owner, vacantStore("Lambda")).andExpect(status().isCreated());
        assign(owner, vacantStore("Mu")).andExpect(status().isCreated());

        mockMvc.perform(get("/api/stores/cash-target").header("Authorization", bearer(login(owner.getEmail()))))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("STORE_SCOPE_INVALID"));
    }

    @Test
    void singleStoreAdminWorksWithoutAnySelection() throws Exception {
        User owner = owner("single@nforce.test");
        Store store = vacantStore("Nu");
        assign(owner, store).andExpect(status().isCreated());

        mockMvc.perform(get("/api/stores").header("Authorization", bearer(login(owner.getEmail()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value(store.getId()));
    }

    @Test
    void anotherAdminsStoreIs404NotForbidden() throws Exception {
        User owner = owner("mine@nforce.test");
        User other = owner("theirs@nforce.test");
        assign(owner, vacantStore("Xi")).andExpect(status().isCreated());
        Store theirs = vacantStore("Omicron");
        assign(other, theirs).andExpect(status().isCreated());
        String token = login(owner.getEmail());

        // Both a store-scoped endpoint and one that isn't (notifications) are
        // refused by the per-request check.
        for (String path : new String[] {"/api/stores/cash-target", "/api/tasks", "/api/notifications"}) {
            mockMvc.perform(get(path).header("Authorization", bearer(token)).header("X-Store-Id", theirs.getId()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Store not found"))
                .andExpect(jsonPath("$.code").value("STORE_SCOPE_INVALID"));
        }
    }

    @Test
    void unassignedMidSessionTheNextRequestForThatStoreIs404() throws Exception {
        User owner = owner("midsession@nforce.test");
        Store kept = vacantStore("Pi");
        Store removed = vacantStore("Rho");
        assign(owner, kept).andExpect(status().isCreated());
        assign(owner, removed).andExpect(status().isCreated());
        String token = login(owner.getEmail());

        mockMvc.perform(get("/api/stores/cash-target").header("Authorization", bearer(token))
                .header("X-Store-Id", removed.getId()))
            .andExpect(status().isOk());

        mockMvc.perform(delete("/api/owners/" + owner.getId() + "/stores/" + removed.getId())
                .header("Authorization", bearer(saToken)))
            .andExpect(status().isOk());

        mockMvc.perform(get("/api/stores/cash-target").header("Authorization", bearer(token))
                .header("X-Store-Id", removed.getId()))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("STORE_SCOPE_INVALID"));
        // Recovery path stays open: the store list, now with only the kept store.
        mockMvc.perform(get("/api/owner-stores").header("Authorization", bearer(token))
                .header("X-Store-Id", removed.getId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].id").value(kept.getId()));
    }

    @Test
    void malformedStoreHeaderIs404() throws Exception {
        User owner = owner("malformed@nforce.test");
        assign(owner, vacantStore("Sigma")).andExpect(status().isCreated());

        mockMvc.perform(get("/api/stores").header("Authorization", bearer(login(owner.getEmail())))
                .header("X-Store-Id", "abc"))
            .andExpect(status().isNotFound());
    }

    // ---- helpers ------------------------------------------------------------

    private org.springframework.test.web.servlet.ResultActions assign(User owner, Store store) throws Exception {
        return mockMvc.perform(post("/api/owners/" + owner.getId() + "/stores")
            .header("Authorization", bearer(saToken))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"existingStoreId\":" + store.getId() + "}"));
    }

    private User owner(String email) {
        User owner = new User();
        owner.setFullName("Owner " + email);
        owner.setEmail(email);
        owner.setPasswordHash(passwordEncoder.encode(PASSWORD));
        owner.getRoles().add(ownerRole);
        return userRepository.save(owner);
    }

    // A store with no admin yet: the same shape Super Admin's "create store" makes.
    private Store vacantStore(String name) {
        Store store = new Store();
        store.setName(name);
        store.setLocation("Main St");
        store.setStoreCode(STORE_CODE.getAndIncrement());
        store = storeRepository.save(store);
        StoreOwner link = new StoreOwner();
        link.setStore(store);
        link.setActive(false);
        storeOwnerRepository.save(link);
        return store;
    }

    private String login(String email) throws Exception {
        String body = objectMapper.writeValueAsString(new LoginPayload(email, PASSWORD));
        String json = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(json).get("token").asText();
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }

    private record LoginPayload(String email, String password) {
    }
}
