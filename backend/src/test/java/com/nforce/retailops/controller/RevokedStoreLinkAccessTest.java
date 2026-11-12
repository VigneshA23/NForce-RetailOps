package com.nforce.retailops.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nforce.retailops.dto.AdminCorrectionRequest;
import com.nforce.retailops.entity.Category;
import com.nforce.retailops.entity.CompletionType;
import com.nforce.retailops.entity.ResponseType;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.ScheduleType;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.Task;
import com.nforce.retailops.entity.TaskResponseEntry;
import com.nforce.retailops.entity.TimeMode;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.CategoryRepository;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.TaskRepository;
import com.nforce.retailops.repository.TaskResponseEntryRepository;
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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// "Revoked but not deactivated": a Super Admin removes an Owner/Admin's link to
// their store while the account stays enabled and logged in. Authority must come
// from a currently-active link, so every checklist-history and task-definition
// call for that store has to stop working immediately, with no re-login. Each
// test proves the call works first (so the denial is the revocation's doing),
// revokes, then proves it is refused.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RevokedStoreLinkAccessTest {

    private static final String PASSWORD = "correct-horse-battery-staple";
    private static final java.util.concurrent.atomic.AtomicLong STORE_CODE =
        new java.util.concurrent.atomic.AtomicLong(89000);

    @Autowired private MockMvc mockMvc;
    @Autowired private RoleRepository roleRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private StoreRepository storeRepository;
    @Autowired private StoreOwnerRepository storeOwnerRepository;
    @Autowired private CategoryRepository categoryRepository;
    @Autowired private TaskRepository taskRepository;
    @Autowired private TaskResponseEntryRepository taskResponseEntryRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private record LoginPayload(String email, String password) {}

    private record Fixture(User owner, Store store, StoreOwner link, Task task, TaskResponseEntry response, String token) {}

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

    private String login(String email) throws Exception {
        String body = objectMapper.writeValueAsString(new LoginPayload(email, PASSWORD));
        String json = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(json).get("token").asText();
    }

    // An owner with one active store, a task and one employee response, already logged in.
    private Fixture fixture(String tag) throws Exception {
        User owner = user("revoked-owner-" + tag + "@nforce.test", "OWNER_ADMIN");
        User employee = user("revoked-emp-" + tag + "@nforce.test", "EMPLOYEE");

        Store store = new Store();
        store.setName("Revoked Store " + tag);
        store.setStoreCode(STORE_CODE.getAndIncrement());
        store.setActive(true);
        store = storeRepository.save(store);

        StoreOwner link = new StoreOwner();
        link.setOwner(owner);
        link.setStore(store);
        link = storeOwnerRepository.save(link);

        Category category = new Category();
        category.setOwner(owner);
        category.setName("Opening");
        category.setDisplayOrder(0);
        category.setActive(true);
        category = categoryRepository.save(category);

        Task task = new Task();
        task.setOwner(owner);
        task.setCategory(category);
        task.setName("Open safe");
        task.setDisplayOrder(0);
        task.setAppliesToAllStores(true);
        task.setResponseType(ResponseType.DONE_NOT_DONE);
        task.setCompletionType(CompletionType.SINGLE);
        task.setScheduleType(ScheduleType.EVERY_DAY);
        task.setTimeMode(TimeMode.ANYTIME);
        task.setStartDate(LocalDate.now().minusDays(1));
        task.setActive(true);
        task = taskRepository.save(task);

        TaskResponseEntry response = new TaskResponseEntry();
        response.setTask(task);
        response.setStore(store);
        response.setEmployee(employee);
        response.setResponseDate(LocalDate.now());
        response.setResponseType(ResponseType.DONE_NOT_DONE);
        response.setCompletionType(CompletionType.SINGLE);
        response.setValueBoolean(false);
        response.setActive(true);
        response = taskResponseEntryRepository.save(response);

        String token = login(owner.getEmail());
        return new Fixture(owner, store, link, task, response, token);
    }

    // Revoke the link only: the account stays enabled, the session stays valid.
    private void revoke(Fixture f) {
        f.link().setActive(false);
        storeOwnerRepository.saveAndFlush(f.link());
    }

    private static String bearer(Fixture f) {
        return "Bearer " + f.token();
    }

    @Test
    @Transactional
    void checklistHistoryDetail_isDeniedAfterRevocation() throws Exception {
        Fixture f = fixture("detail");
        String date = LocalDate.now().toString();

        mockMvc.perform(get("/api/checklist-history/detail")
                .param("storeId", f.store().getId().toString()).param("date", date)
                .header("Authorization", bearer(f)))
            .andExpect(status().isOk());

        revoke(f);

        mockMvc.perform(get("/api/checklist-history/detail")
                .param("storeId", f.store().getId().toString()).param("date", date)
                .header("Authorization", bearer(f)))
            .andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void checklistHistorySummaryForANamedStore_isDeniedAfterRevocation() throws Exception {
        Fixture f = fixture("summary");
        String today = LocalDate.now().toString();

        mockMvc.perform(get("/api/checklist-history/summary")
                .param("storeIds", f.store().getId().toString())
                .param("startDate", today).param("endDate", today)
                .header("Authorization", bearer(f)))
            .andExpect(status().isOk());

        revoke(f);

        // The batched "named stores" lookup no longer matches the revoked link.
        mockMvc.perform(get("/api/checklist-history/summary")
                .param("storeIds", f.store().getId().toString())
                .param("startDate", today).param("endDate", today)
                .header("Authorization", bearer(f)))
            .andExpect(status().is4xxClientError());
    }

    @Test
    @Transactional
    void adminCorrection_isDeniedAfterRevocation_andLeavesTheResponseUnchanged() throws Exception {
        Fixture f = fixture("correct");
        revoke(f);

        mockMvc.perform(patch("/api/checklist-history/responses/{id}/correct", f.response().getId())
                .header("Authorization", bearer(f))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                    new AdminCorrectionRequest(true, null, null, "Employee pressed wrong button"))))
            .andExpect(status().isForbidden());

        org.junit.jupiter.api.Assertions.assertEquals(false,
            taskResponseEntryRepository.findById(f.response().getId()).orElseThrow().getValueBoolean());
    }

    @Test
    @Transactional
    void correctionHistoryAndFlag_areDeniedAfterRevocation() throws Exception {
        Fixture f = fixture("history");
        mockMvc.perform(get("/api/checklist-history/responses/{id}/corrections", f.response().getId())
                .header("Authorization", bearer(f)))
            .andExpect(status().isOk());

        revoke(f);

        mockMvc.perform(get("/api/checklist-history/responses/{id}/corrections", f.response().getId())
                .header("Authorization", bearer(f)))
            .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/checklist-history/responses/{id}/flag", f.response().getId())
                .header("Authorization", bearer(f))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"Looks wrong to me\"}"))
            .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void taskDefinitionReadUpdateStatusAndDelete_areDeniedAfterRevocation() throws Exception {
        Fixture f = fixture("task");
        Long taskId = f.task().getId();

        mockMvc.perform(get("/api/tasks/{id}", taskId).header("Authorization", bearer(f)))
            .andExpect(status().isOk());

        revoke(f);

        mockMvc.perform(get("/api/tasks/{id}", taskId).header("Authorization", bearer(f)))
            .andExpect(status().isNotFound());
        mockMvc.perform(patch("/api/tasks/{id}/status", taskId)
                .header("Authorization", bearer(f))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"active\":false}"))
            .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/tasks/{id}", taskId).header("Authorization", bearer(f)))
            .andExpect(status().isNotFound());

        // And nothing was changed by those attempts.
        Task after = taskRepository.findById(taskId).orElseThrow();
        org.junit.jupiter.api.Assertions.assertTrue(after.isActive());
    }
}
