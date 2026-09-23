package com.nforce.retailops.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nforce.retailops.entity.Category;
import com.nforce.retailops.entity.CompletedVia;
import com.nforce.retailops.entity.CompletionType;
import com.nforce.retailops.entity.MakeupLinkStatus;
import com.nforce.retailops.entity.ResponseType;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.ScheduleType;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreEmployee;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.Task;
import com.nforce.retailops.entity.TaskMakeupLink;
import com.nforce.retailops.entity.TaskResponseEntry;
import com.nforce.retailops.entity.TimeMode;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.CategoryRepository;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.TaskMakeupLinkRepository;
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
import java.time.OffsetDateTime;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class MissedTasksControllerTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RoleRepository roleRepository;
    @Autowired
    private StoreRepository storeRepository;
    @Autowired
    private StoreOwnerRepository storeOwnerRepository;
    @Autowired
    private StoreEmployeeRepository storeEmployeeRepository;
    @Autowired
    private CategoryRepository categoryRepository;
    @Autowired
    private TaskRepository taskRepository;
    @Autowired
    private TaskResponseEntryRepository taskResponseEntryRepository;
    @Autowired
    private TaskMakeupLinkRepository taskMakeupLinkRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private static final AtomicLong STORE_CODE = new AtomicLong(900_000);

    private Role role(String name) {
        return roleRepository.findByName(name).orElseGet(() -> {
            Role role = new Role();
            role.setName(name);
            return roleRepository.save(role);
        });
    }

    private User createUser(String email, String role) {
        User user = new User();
        user.setFullName(email);
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode("password123"));
        user.getRoles().add(role(role));
        return userRepository.save(user);
    }

    private Store createStore(User owner) {
        Store store = new Store();
        store.setName("Store for " + owner.getEmail());
        store.setStoreCode(STORE_CODE.incrementAndGet());
        store.setActive(true);
        store = storeRepository.save(store);

        StoreOwner storeOwner = new StoreOwner();
        storeOwner.setStore(store);
        storeOwner.setOwner(owner);
        storeOwner.setActive(true);
        storeOwnerRepository.save(storeOwner);
        return store;
    }

    private User assignEmployee(Store store, String email, User createdByOwner) {
        User user = createUser(email, "EMPLOYEE");
        StoreEmployee se = new StoreEmployee();
        se.setEmployee(user);
        se.setCreatedByOwner(createdByOwner);
        se.setPhone("555-0100");
        se.setEmployeeType("FULL_TIME");
        se.setGender("OTHER");
        se.getStores().add(store);
        storeEmployeeRepository.save(se);
        return user;
    }

    private Category createCategory(User owner, Store store) {
        Category category = new Category();
        category.setOwner(owner);
        category.setName("General");
        category.setDisplayOrder(0);
        category.setActive(true);
        category.getStores().add(store);
        return categoryRepository.save(category);
    }

    private Task createTask(User owner, Category category, Store store, CompletionType completionType, LocalDate startDate) {
        Task task = new Task();
        task.setOwner(owner);
        task.setCategory(category);
        task.setName("Sweep the floor");
        task.setDisplayOrder(0);
        task.setAppliesToAllStores(false);
        task.getStores().add(store);
        task.setResponseType(ResponseType.YES_NO);
        task.setCompletionType(completionType);
        task.setScheduleType(ScheduleType.EVERY_DAY);
        task.setStartDate(startDate);
        task.setTimeMode(TimeMode.ANYTIME);
        task.setActive(true);
        return taskRepository.save(task);
    }

    private String login(String email) throws Exception {
        String body = objectMapper.writeValueAsString(new LoginPayload(email, "password123"));
        String response = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("token").asText();
    }

    @Test
    void missedTasksListsPastUncompletedInstancesGroupedByDateDesc() throws Exception {
        User owner = createUser("mt-owner-1@nforce.test", "OWNER_ADMIN");
        Store store = createStore(owner);
        Category category = createCategory(owner, store);
        User employee = assignEmployee(store, "mt-emp-1@nforce.test", owner);
        createTask(owner, category, store, CompletionType.SINGLE, LocalDate.now().minusDays(3));

        String token = login("mt-emp-1@nforce.test");

        mockMvc.perform(get("/api/me/tasks/missed")
                .header("Authorization", "Bearer " + token)
                .param("storeId", store.getId().toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.groups.length()").value(3))
            .andExpect(jsonPath("$.groups[0].date").value(LocalDate.now().minusDays(1).toString()))
            .andExpect(jsonPath("$.groups[0].instances[0].state").value("ACTIONABLE"))
            .andExpect(jsonPath("$.nextCursor").doesNotExist());
    }

    @Test
    void completeNowInsertsAMakeupResponseAndRemovesTheInstanceFromTheMissedList() throws Exception {
        User owner = createUser("mt-owner-2@nforce.test", "OWNER_ADMIN");
        Store store = createStore(owner);
        Category category = createCategory(owner, store);
        User employee = assignEmployee(store, "mt-emp-2@nforce.test", owner);
        Task task = createTask(owner, category, store, CompletionType.SINGLE, LocalDate.now().minusDays(1));
        LocalDate missedDate = LocalDate.now().minusDays(1);

        String token = login("mt-emp-2@nforce.test");

        mockMvc.perform(post("/api/me/tasks/" + task.getId() + "/missed/" + missedDate + "/complete-now")
                .header("Authorization", "Bearer " + token)
                .param("storeId", store.getId().toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"storeId\":" + store.getId() + ",\"booleanValue\":true}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.responses[0].completedVia").value("MAKEUP_NOW"))
            .andExpect(jsonPath("$.canUndo").value(true));

        mockMvc.perform(get("/api/me/tasks/missed")
                .header("Authorization", "Bearer " + token)
                .param("storeId", store.getId().toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.groups.length()").value(0));
    }

    @Test
    void completeNowIsRejectedOnceASingleTaskInstanceIsAlreadyCompleted() throws Exception {
        User owner = createUser("mt-owner-3@nforce.test", "OWNER_ADMIN");
        Store store = createStore(owner);
        Category category = createCategory(owner, store);
        assignEmployee(store, "mt-emp-3a@nforce.test", owner);
        assignEmployee(store, "mt-emp-3b@nforce.test", owner);
        Task task = createTask(owner, category, store, CompletionType.SINGLE, LocalDate.now().minusDays(1));
        LocalDate missedDate = LocalDate.now().minusDays(1);

        String tokenA = login("mt-emp-3a@nforce.test");
        String tokenB = login("mt-emp-3b@nforce.test");

        mockMvc.perform(post("/api/me/tasks/" + task.getId() + "/missed/" + missedDate + "/complete-now")
                .header("Authorization", "Bearer " + tokenA)
                .param("storeId", store.getId().toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"storeId\":" + store.getId() + ",\"booleanValue\":true}"))
            .andExpect(status().isOk());

        mockMvc.perform(post("/api/me/tasks/" + task.getId() + "/missed/" + missedDate + "/complete-now")
                .header("Authorization", "Bearer " + tokenB)
                .param("storeId", store.getId().toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"storeId\":" + store.getId() + ",\"booleanValue\":true}"))
            .andExpect(status().isConflict());
    }

    // A MULTIPLE task's missed instance needs two distinct employees, exactly like the
    // live checklist: the first responder sees WAITING_ON_SECOND (no buttons), any other
    // employee still sees it as ACTIONABLE.
    @Test
    void multipleCompletionTypeShowsWaitingOnSecondPersonAfterOneEmployeeRespondsButRemainsActionableForOthers() throws Exception {
        User owner = createUser("mt-owner-4@nforce.test", "OWNER_ADMIN");
        Store store = createStore(owner);
        Category category = createCategory(owner, store);
        assignEmployee(store, "mt-emp-4a@nforce.test", owner);
        assignEmployee(store, "mt-emp-4b@nforce.test", owner);
        Task task = createTask(owner, category, store, CompletionType.MULTIPLE, LocalDate.now().minusDays(1));
        LocalDate missedDate = LocalDate.now().minusDays(1);

        String tokenA = login("mt-emp-4a@nforce.test");
        String tokenB = login("mt-emp-4b@nforce.test");

        mockMvc.perform(post("/api/me/tasks/" + task.getId() + "/missed/" + missedDate + "/complete-now")
                .header("Authorization", "Bearer " + tokenA)
                .param("storeId", store.getId().toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"storeId\":" + store.getId() + ",\"booleanValue\":true}"))
            .andExpect(status().isOk());

        mockMvc.perform(get("/api/me/tasks/missed")
                .header("Authorization", "Bearer " + tokenA)
                .param("storeId", store.getId().toString()))
            .andExpect(jsonPath("$.groups[0].instances[0].state").value("WAITING_ON_SECOND"));

        mockMvc.perform(get("/api/me/tasks/missed")
                .header("Authorization", "Bearer " + tokenB)
                .param("storeId", store.getId().toString()))
            .andExpect(jsonPath("$.groups[0].instances[0].state").value("ACTIONABLE"));

        mockMvc.perform(post("/api/me/tasks/" + task.getId() + "/missed/" + missedDate + "/complete-now")
                .header("Authorization", "Bearer " + tokenB)
                .param("storeId", store.getId().toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"storeId\":" + store.getId() + ",\"booleanValue\":true}"))
            .andExpect(status().isOk());

        mockMvc.perform(get("/api/me/tasks/missed")
                .header("Authorization", "Bearer " + tokenA)
                .param("storeId", store.getId().toString()))
            .andExpect(jsonPath("$.groups.length()").value(0));
    }

    // Link-to-today, then completing TODAY'S occurrence of the same task fulfils the
    // link in the same transaction: the past date gets an auto-generated
    // LINK_FULFILLED response, and it can never be undone.
    @Test
    void linkingToTodayThenCompletingTodayAutoCompletesThePastInstancePermanently() throws Exception {
        User owner = createUser("mt-owner-5@nforce.test", "OWNER_ADMIN");
        Store store = createStore(owner);
        Category category = createCategory(owner, store);
        assignEmployee(store, "mt-emp-5@nforce.test", owner);
        // Task must also be scheduled today for the link to be eligible. startDate is
        // exactly yesterday so there's a single missed instance, not two, keeping the
        // "groups[0]" assertions below unambiguous.
        Task task = createTask(owner, category, store, CompletionType.SINGLE, LocalDate.now().minusDays(1));
        LocalDate missedDate = LocalDate.now().minusDays(1);

        String token = login("mt-emp-5@nforce.test");

        String linkResponse = mockMvc.perform(post("/api/me/tasks/" + task.getId() + "/missed/" + missedDate + "/link-to-today")
                .header("Authorization", "Bearer " + token)
                .param("storeId", store.getId().toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("PENDING"))
            .andReturn().getResponse().getContentAsString();
        assertThat(objectMapper.readTree(linkResponse).get("linkedDate").asText()).isEqualTo(LocalDate.now().toString());

        mockMvc.perform(get("/api/me/tasks/missed")
                .header("Authorization", "Bearer " + token)
                .param("storeId", store.getId().toString()))
            .andExpect(jsonPath("$.groups[0].instances[0].state").value("LINKED"))
            .andExpect(jsonPath("$.groups[0].instances[0].canUnlink").value(true));

        // Completing TODAY'S instance fulfils the link inside the same transaction.
        mockMvc.perform(post("/api/me/tasks/" + task.getId() + "/responses")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"storeId\":" + store.getId() + ",\"booleanValue\":true}"))
            .andExpect(status().isOk());

        var fulfilledResponse = taskResponseEntryRepository
            .findByTaskIdAndStoreIdAndResponseDateAndActiveTrue(task.getId(), store.getId(), missedDate);
        assertThat(fulfilledResponse).hasSize(1);
        TaskResponseEntry fulfilled = fulfilledResponse.get(0);
        assertThat(fulfilled.getCompletedVia()).isEqualTo(CompletedVia.LINK_FULFILLED);

        TaskMakeupLink link = taskMakeupLinkRepository
            .findByTaskIdAndStoreIdAndPastDateAndStatus(task.getId(), store.getId(), missedDate, MakeupLinkStatus.FULFILLED)
            .orElseThrow();
        assertThat(link.getStatus()).isEqualTo(MakeupLinkStatus.FULFILLED);

        // Permanent: the fulfilled makeup row can never be undone.
        mockMvc.perform(post("/api/me/tasks/" + task.getId() + "/responses/" + fulfilled.getId() + "/undo")
                .header("Authorization", "Bearer " + token)
                .param("storeId", store.getId().toString()))
            .andExpect(status().isConflict());

        mockMvc.perform(get("/api/me/tasks/missed")
                .header("Authorization", "Bearer " + token)
                .param("storeId", store.getId().toString()))
            .andExpect(jsonPath("$.groups.length()").value(0));
    }

    @Test
    void unlinkIsRejectedForAnyoneOtherThanTheLinkCreator() throws Exception {
        User owner = createUser("mt-owner-6@nforce.test", "OWNER_ADMIN");
        Store store = createStore(owner);
        Category category = createCategory(owner, store);
        assignEmployee(store, "mt-emp-6a@nforce.test", owner);
        assignEmployee(store, "mt-emp-6b@nforce.test", owner);
        Task task = createTask(owner, category, store, CompletionType.SINGLE, LocalDate.now().minusDays(1));
        LocalDate missedDate = LocalDate.now().minusDays(1);

        String tokenA = login("mt-emp-6a@nforce.test");
        String tokenB = login("mt-emp-6b@nforce.test");

        mockMvc.perform(post("/api/me/tasks/" + task.getId() + "/missed/" + missedDate + "/link-to-today")
                .header("Authorization", "Bearer " + tokenA)
                .param("storeId", store.getId().toString()))
            .andExpect(status().isOk());

        mockMvc.perform(delete("/api/me/tasks/" + task.getId() + "/missed/" + missedDate + "/link")
                .header("Authorization", "Bearer " + tokenB)
                .param("storeId", store.getId().toString()))
            .andExpect(status().isForbidden());

        mockMvc.perform(delete("/api/me/tasks/" + task.getId() + "/missed/" + missedDate + "/link")
                .header("Authorization", "Bearer " + tokenA)
                .param("storeId", store.getId().toString()))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/me/tasks/missed")
                .header("Authorization", "Bearer " + tokenA)
                .param("storeId", store.getId().toString()))
            .andExpect(jsonPath("$.groups[0].instances[0].state").value("ACTIONABLE"));
    }

    // The lookback hard cap (TaskMakeupLinkService.MAX_LOOKBACK_DAYS, TEMPORARILY 7
    // instead of 90 -- see that constant's comment) is enforced server-side: paging
    // all the way back must land exactly on today-cap as the oldest missed date,
    // never earlier, even though the task itself has been active for 200 days.
    @Test
    void missedTasksNeverReachesBeyondTheLookbackCap() throws Exception {
        User owner = createUser("mt-owner-7@nforce.test", "OWNER_ADMIN");
        Store store = createStore(owner);
        Category category = createCategory(owner, store);
        assignEmployee(store, "mt-emp-7@nforce.test", owner);
        createTask(owner, category, store, CompletionType.SINGLE, LocalDate.now().minusDays(200));

        String token = login("mt-emp-7@nforce.test");

        String cursor = null;
        LocalDate oldestSeen = null;
        int totalGroups = 0;
        for (int page = 0; page < 10; page++) {
            var requestBuilder = get("/api/me/tasks/missed")
                .header("Authorization", "Bearer " + token)
                .param("storeId", store.getId().toString())
                .param("limit", "30");
            if (cursor != null) {
                requestBuilder = requestBuilder.param("cursor", cursor);
            }
            String response = mockMvc.perform(requestBuilder)
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

            var json = objectMapper.readTree(response);
            for (var group : json.get("groups")) {
                LocalDate date = LocalDate.parse(group.get("date").asText());
                if (oldestSeen == null || date.isBefore(oldestSeen)) {
                    oldestSeen = date;
                }
                totalGroups++;
            }
            cursor = json.get("nextCursor").isNull() ? null : json.get("nextCursor").asText();
            if (cursor == null) {
                break;
            }
        }

        assertThat(oldestSeen).isEqualTo(LocalDate.now().minusDays(7));
        assertThat(totalGroups).isEqualTo(7);
    }

    private record LoginPayload(String email, String password) {
    }
}
