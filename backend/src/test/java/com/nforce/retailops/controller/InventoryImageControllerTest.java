package com.nforce.retailops.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nforce.retailops.entity.InventoryItemImage;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreEmployee;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.InventoryItemImageRepository;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.StoreEmployeeRepository;
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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// RTS-482: GET /api/inventory-images/{id} used to be open to any signed-in
// user, so an employee could walk the sequential ids and read other stores'
// uploaded photos. Unsplash stock photos stay open; an uploaded photo is only
// served to its own store's Owner/Admin and employees, and Super Admin.
// Everyone else gets the same 404 as a missing id.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class InventoryImageControllerTest {

    private static final String PASSWORD = "correct-horse-battery-staple";
    private static final byte[] BYTES = {1, 2, 3, 4};
    private static final java.util.concurrent.atomic.AtomicLong STORE_CODE =
        new java.util.concurrent.atomic.AtomicLong(91000);

    @Autowired private MockMvc mockMvc;
    @Autowired private RoleRepository roleRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private SuperAdminRepository superAdminRepository;
    @Autowired private StoreRepository storeRepository;
    @Autowired private StoreOwnerRepository storeOwnerRepository;
    @Autowired private StoreEmployeeRepository storeEmployeeRepository;
    @Autowired private StoreInventoryItemRepository storeInventoryItemRepository;
    @Autowired private InventoryItemImageRepository inventoryItemImageRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private record LoginPayload(String email, String password) {}

    private Role role(String name) {
        return roleRepository.findByName(name).orElseGet(() -> {
            Role r = new Role();
            r.setName(name);
            r.setDescription(name);
            return roleRepository.save(r);
        });
    }

    private User user(String email, String roleName) {
        User u = new User();
        u.setEmail(email);
        u.setPasswordHash(passwordEncoder.encode(PASSWORD));
        u.setFullName("Test User");
        u.getRoles().add(role(roleName));
        return userRepository.save(u);
    }

    private SuperAdmin superAdmin(String email) {
        SuperAdmin sa = new SuperAdmin();
        sa.setName("Test Super Admin");
        sa.setEmail(email);
        sa.setPasswordHash(passwordEncoder.encode(PASSWORD));
        return superAdminRepository.save(sa);
    }

    private Store store(String name) {
        Store s = new Store();
        s.setName(name);
        s.setStoreCode(STORE_CODE.getAndIncrement());
        s.setActive(true);
        return storeRepository.save(s);
    }

    private void owns(User owner, Store store) {
        StoreOwner so = new StoreOwner();
        so.setOwner(owner);
        so.setStore(store);
        storeOwnerRepository.save(so);
    }

    private void worksAt(User employee, Store store) {
        StoreEmployee se = new StoreEmployee();
        se.setEmployee(employee);
        se.setPhone("555-0100");
        se.setEmployeeType("Full-time");
        se.setGender("Other");
        se.getStores().add(store);
        storeEmployeeRepository.save(se);
    }

    private InventoryItemImage image(String unsplashPhotoId) {
        InventoryItemImage image = new InventoryItemImage();
        image.setContentType("image/png");
        image.setData(BYTES);
        image.setUnsplashPhotoId(unsplashPhotoId);
        return inventoryItemImageRepository.save(image);
    }

    // An item in the store that owns the given image.
    private void itemWithImage(Store store, InventoryItemImage image) {
        StoreInventoryItem item = new StoreInventoryItem();
        item.setStore(store);
        item.setName("Item " + image.getId());
        item.setUnitOfMeasurement("pcs");
        item.setImage(image);
        storeInventoryItemRepository.save(item);
    }

    private String login(String email) throws Exception {
        String body = objectMapper.writeValueAsString(new LoginPayload(email, PASSWORD));
        String json = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(json).get("token").asText();
    }

    private org.springframework.test.web.servlet.ResultActions fetch(String token, Long imageId) throws Exception {
        return mockMvc.perform(get("/api/inventory-images/" + imageId)
            .header("Authorization", "Bearer " + token));
    }

    @Test
    @Transactional
    void anEmployeeOfTheOwningStoreCanReadAnUploadedImage() throws Exception {
        Store store = store("Image Store A1");
        InventoryItemImage upload = image(null);
        itemWithImage(store, upload);
        worksAt(user("img-emp-a1@nforce.test", "EMPLOYEE"), store);

        fetch(login("img-emp-a1@nforce.test"), upload.getId())
            .andExpect(status().isOk())
            .andExpect(content().contentType("image/png"))
            .andExpect(content().bytes(BYTES));
    }

    @Test
    @Transactional
    void anEmployeeOfAnotherStoreCannotReadAnUploadedImage() throws Exception {
        Store storeA = store("Image Store A2");
        Store storeB = store("Image Store B2");
        InventoryItemImage upload = image(null);
        itemWithImage(storeA, upload);
        worksAt(user("img-emp-b2@nforce.test", "EMPLOYEE"), storeB);

        fetch(login("img-emp-b2@nforce.test"), upload.getId()).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void theOwnerOfTheOwningStoreCanReadAnUploadedImage() throws Exception {
        Store store = store("Image Store A3");
        InventoryItemImage upload = image(null);
        itemWithImage(store, upload);
        owns(user("img-owner-a3@nforce.test", "OWNER_ADMIN"), store);

        fetch(login("img-owner-a3@nforce.test"), upload.getId()).andExpect(status().isOk());
    }

    @Test
    @Transactional
    void theOwnerOfAnotherStoreCannotReadAnUploadedImage() throws Exception {
        Store storeA = store("Image Store A4");
        Store storeB = store("Image Store B4");
        InventoryItemImage upload = image(null);
        itemWithImage(storeA, upload);
        owns(user("img-owner-b4@nforce.test", "OWNER_ADMIN"), storeB);

        fetch(login("img-owner-b4@nforce.test"), upload.getId()).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void aDeactivatedOwnerLinkNoLongerGrantsAccess() throws Exception {
        Store store = store("Image Store A5");
        InventoryItemImage upload = image(null);
        itemWithImage(store, upload);
        User owner = user("img-owner-a5@nforce.test", "OWNER_ADMIN");
        StoreOwner link = new StoreOwner();
        link.setOwner(owner);
        link.setStore(store);
        link = storeOwnerRepository.save(link);
        link.setActive(false);
        storeOwnerRepository.save(link);

        fetch(login("img-owner-a5@nforce.test"), upload.getId()).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void superAdminCanReadAnyStoresUploadedImage() throws Exception {
        Store store = store("Image Store A6");
        InventoryItemImage upload = image(null);
        itemWithImage(store, upload);
        superAdmin("img-sa-a6@nforce.test");

        fetch(login("img-sa-a6@nforce.test"), upload.getId()).andExpect(status().isOk());
    }

    @Test
    @Transactional
    void anUnsplashImageIsReadableByAnyAuthenticatedUser() throws Exception {
        Store storeA = store("Image Store A7");
        Store storeB = store("Image Store B7");
        InventoryItemImage stock = image("unsplash-photo-7");
        itemWithImage(storeA, stock);
        worksAt(user("img-emp-b7@nforce.test", "EMPLOYEE"), storeB);
        owns(user("img-owner-b7@nforce.test", "OWNER_ADMIN"), storeB);

        fetch(login("img-emp-b7@nforce.test"), stock.getId()).andExpect(status().isOk());
        fetch(login("img-owner-b7@nforce.test"), stock.getId()).andExpect(status().isOk());
    }

    @Test
    @Transactional
    void anUploadedImageNoItemOwnsIsNotServedToStoreUsers() throws Exception {
        Store store = store("Image Store A8");
        InventoryItemImage orphan = image(null);
        worksAt(user("img-emp-a8@nforce.test", "EMPLOYEE"), store);

        fetch(login("img-emp-a8@nforce.test"), orphan.getId()).andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void anUnknownImageIdIs404() throws Exception {
        Store store = store("Image Store A9");
        worksAt(user("img-emp-a9@nforce.test", "EMPLOYEE"), store);

        fetch(login("img-emp-a9@nforce.test"), 987_654_321L).andExpect(status().isNotFound());
    }

    @Test
    void anUnauthenticatedRequestIsRejected() throws Exception {
        mockMvc.perform(get("/api/inventory-images/1")).andExpect(status().is4xxClientError());
    }
}
