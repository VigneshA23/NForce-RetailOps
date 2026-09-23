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
import com.nforce.retailops.service.TaskMakeupLinkService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
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
    private TaskMakeupLinkService taskMakeupLinkService;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @PersistenceContext
    private EntityManager entityManager;

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

    private void move(String token, Long taskId, LocalDate missedDate, Long storeId, LocalDate targetDate, int expectedStatus) throws Exception {
        var result = mockMvc.perform(post("/api/me/tasks/" + taskId + "/missed/" + missedDate + "/move")
                .header("Authorization", "Bearer " + token)
                .param("storeId", storeId.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"targetDate\":\"" + targetDate + "\"}"))
            .andReturn();
        assertThat(result.getResponse().getStatus()).isEqualTo(expectedStatus);
    }

    @Test
    void missedTasksListsPastUncompletedInstancesGroupedByDateDesc() throws Exception {
        User owner = createUser("mt-owner-1@nforce.test", "OWNER_ADMIN");
        Store store = createStore(owner);
        Category category = createCategory(owner, store);
        assignEmployee(store, "mt-emp-1@nforce.test", owner);
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

    // The lookback hard cap (TaskMakeupLinkService.MAX_LOOKBACK_DAYS) is enforced
    // server-side: paging all the way back must land exactly on today-MAX_LOOKBACK_DAYS
    // as the oldest missed date, never earlier, even though the task itself has been
    // active for 200 days.
    @Test
    void missedTasksNeverReachesBeyondTheLookbackCap() throws Exception {
        User owner = createUser("mt-owner-2@nforce.test", "OWNER_ADMIN");
        Store store = createStore(owner);
        Category category = createCategory(owner, store);
        assignEmployee(store, "mt-emp-2@nforce.test", owner);
        createTask(owner, category, store, CompletionType.SINGLE, LocalDate.now().minusDays(200));

        String token = login("mt-emp-2@nforce.test");

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

    @Test
    void moveCreatesAPendingMoveAndRemovesInstanceFromMissedList() throws Exception {
        User owner = createUser("mt-owner-3@nforce.test", "OWNER_ADMIN");
        Store store = createStore(owner);
        Category category = createCategory(owner, store);
        assignEmployee(store, "mt-emp-3@nforce.test", owner);
        Task task = createTask(owner, category, store, CompletionType.SINGLE, LocalDate.now().minusDays(1));
        LocalDate missedDate = LocalDate.now().minusDays(1);
        LocalDate today = LocalDate.now();

        String token = login("mt-emp-3@nforce.test");

        mockMvc.perform(post("/api/me/tasks/" + task.getId() + "/missed/" + missedDate + "/move")
                .header("Authorization", "Bearer " + token)
                .param("storeId", store.getId().toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"targetDate\":\"" + today + "\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("PENDING"))
            .andExpect(jsonPath("$.originalDueDate").value(missedDate.toString()))
            .andExpect(jsonPath("$.targetDate").value(today.toString()));

        mockMvc.perform(get("/api/me/tasks/missed")
                .header("Authorization", "Bearer " + token)
                .param("storeId", store.getId().toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.groups.length()").value(0));

        assertThat(taskMakeupLinkRepository
            .findByTaskIdAndStoreIdAndPastDateAndStatus(task.getId(), store.getId(), missedDate, MakeupLinkStatus.PENDING))
            .isPresent();
    }

    @Test
    void moveRejectsPastAndBeyondSevenDayTargetsButAcceptsTheSevenDayBoundary() throws Exception {
        User owner = createUser("mt-owner-4@nforce.test", "OWNER_ADMIN");
        Store store = createStore(owner);
        Category category = createCategory(owner, store);
        assignEmployee(store, "mt-emp-4@nforce.test", owner);
        Task task = createTask(owner, category, store, CompletionType.SINGLE, LocalDate.now().minusDays(1));
        LocalDate missedDate = LocalDate.now().minusDays(1);

        String token = login("mt-emp-4@nforce.test");

        move(token, task.getId(), missedDate, store.getId(), LocalDate.now().minusDays(1), 409);
        move(token, task.getId(), missedDate, store.getId(), LocalDate.now().plusDays(8), 409);
        assertThat(taskMakeupLinkRepository.findByTaskIdAndStoreIdAndPastDateAndStatus(
            task.getId(), store.getId(), missedDate, MakeupLinkStatus.PENDING)).isEmpty();

        move(token, task.getId(), missedDate, store.getId(), LocalDate.now().plusDays(7), 200);
    }

    @Test
    void movingAnAlreadyCompletedInstanceIsRejected() throws Exception {
        User owner = createUser("mt-owner-5@nforce.test", "OWNER_ADMIN");
        Store store = createStore(owner);
        Category category = createCategory(owner, store);
        User employee = assignEmployee(store, "mt-emp-5@nforce.test", owner);
        Task task = createTask(owner, category, store, CompletionType.SINGLE, LocalDate.now().minusDays(1));
        LocalDate missedDate = LocalDate.now().minusDays(1);

        TaskResponseEntry entry = new TaskResponseEntry();
        entry.setTask(task);
        entry.setStore(store);
        entry.setEmployee(employee);
        entry.setResponseDate(missedDate);
        entry.setResponseType(ResponseType.YES_NO);
        entry.setCompletionType(CompletionType.SINGLE);
        entry.setValueBoolean(true);
        entry.setCompletedVia(CompletedVia.NORMAL);
        taskResponseEntryRepository.save(entry);

        String token = login("mt-emp-5@nforce.test");
        move(token, task.getId(), missedDate, store.getId(), LocalDate.now(), 409);
    }

    @Test
    void moveIgnoresTaskActiveFlag() throws Exception {
        User owner = createUser("mt-owner-6@nforce.test", "OWNER_ADMIN");
        Store store = createStore(owner);
        Category category = createCategory(owner, store);
        assignEmployee(store, "mt-emp-6@nforce.test", owner);
        Task task = createTask(owner, category, store, CompletionType.SINGLE, LocalDate.now().minusDays(1));
        LocalDate missedDate = LocalDate.now().minusDays(1);
        task.setActive(false);
        taskRepository.save(task);

        String token = login("mt-emp-6@nforce.test");
        move(token, task.getId(), missedDate, store.getId(), LocalDate.now(), 200);
    }

    // Task is ALSO scheduled today (start date = 2 days ago, EVERY_DAY): moving
    // yesterday's missed instance to today must not merge with today's own normal
    // occurrence -- the checklist shows both as independent units.
    @Test
    void movedUnitAppearsOnTargetDatesChecklistAsIndependentUnitWithOriginalDueDateBadge() throws Exception {
        User owner = createUser("mt-owner-7@nforce.test", "OWNER_ADMIN");
        Store store = createStore(owner);
        Category category = createCategory(owner, store);
        assignEmployee(store, "mt-emp-7@nforce.test", owner);
        Task task = createTask(owner, category, store, CompletionType.SINGLE, LocalDate.now().minusDays(2));
        LocalDate missedDate = LocalDate.now().minusDays(1);

        String token = login("mt-emp-7@nforce.test");
        move(token, task.getId(), missedDate, store.getId(), LocalDate.now(), 200);

        String response = mockMvc.perform(get("/api/me/tasks/today")
                .header("Authorization", "Bearer " + token)
                .param("storeId", store.getId().toString()))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();

        var tasks = objectMapper.readTree(response).get("categories").get(0).get("tasks");
        assertThat(tasks).hasSize(2);
        boolean hasNormal = false;
        boolean hasMoved = false;
        for (var item : tasks) {
            if (item.get("originalDueDate").isNull()) {
                hasNormal = true;
            } else if (item.get("originalDueDate").asText().equals(missedDate.toString())) {
                hasMoved = true;
            }
        }
        assertThat(hasNormal).isTrue();
        assertThat(hasMoved).isTrue();
    }

    // 3 missed dates of one task moved to today, PLUS the task's own today
    // occurrence, yields 4 independent units -- completing one leaves the other 3
    // untouched (no auto-fulfillment fan-out).
    @Test
    void threeMovedUnitsPlusTodaysOwnOccurrenceYieldFourIndependentUnits() throws Exception {
        User owner = createUser("mt-owner-8@nforce.test", "OWNER_ADMIN");
        Store store = createStore(owner);
        Category category = createCategory(owner, store);
        assignEmployee(store, "mt-emp-8@nforce.test", owner);
        Task task = createTask(owner, category, store, CompletionType.SINGLE, LocalDate.now().minusDays(3));

        String token = login("mt-emp-8@nforce.test");
        LocalDate today = LocalDate.now();
        move(token, task.getId(), today.minusDays(1), store.getId(), today, 200);
        move(token, task.getId(), today.minusDays(2), store.getId(), today, 200);
        move(token, task.getId(), today.minusDays(3), store.getId(), today, 200);

        String response = mockMvc.perform(get("/api/me/tasks/today")
                .header("Authorization", "Bearer " + token)
                .param("storeId", store.getId().toString()))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        var tasks = objectMapper.readTree(response).get("categories").get(0).get("tasks");
        assertThat(tasks).hasSize(4);

        // Complete only the normal (today, originalDueDate == null) unit.
        mockMvc.perform(post("/api/me/tasks/" + task.getId() + "/responses")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"storeId\":" + store.getId() + ",\"booleanValue\":true}"))
            .andExpect(status().isOk());

        String afterResponse = mockMvc.perform(get("/api/me/tasks/today")
                .header("Authorization", "Bearer " + token)
                .param("storeId", store.getId().toString()))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        var afterTasks = objectMapper.readTree(afterResponse).get("categories").get(0).get("tasks");
        int completedCount = 0;
        int incompleteCount = 0;
        for (var item : afterTasks) {
            if (item.get("responses").size() > 0) {
                completedCount++;
            } else {
                incompleteCount++;
            }
        }
        assertThat(completedCount).isEqualTo(1);
        assertThat(incompleteCount).isEqualTo(3);
    }

    @Test
    void singleCompletionOfAMovedUnitTerminatesTheMoveAndAttributesTheResponseToTheOriginalDate() throws Exception {
        User owner = createUser("mt-owner-9@nforce.test", "OWNER_ADMIN");
        Store store = createStore(owner);
        Category category = createCategory(owner, store);
        assignEmployee(store, "mt-emp-9@nforce.test", owner);
        Task task = createTask(owner, category, store, CompletionType.SINGLE, LocalDate.now().minusDays(1));
        LocalDate missedDate = LocalDate.now().minusDays(1);

        String token = login("mt-emp-9@nforce.test");
        move(token, task.getId(), missedDate, store.getId(), LocalDate.now(), 200);

        mockMvc.perform(post("/api/me/tasks/" + task.getId() + "/responses")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"storeId\":" + store.getId() + ",\"booleanValue\":true,\"originalDueDate\":\"" + missedDate + "\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.originalDueDate").value(missedDate.toString()))
            .andExpect(jsonPath("$.responses[0].completedVia").value("MOVED"))
            .andExpect(jsonPath("$.canUndo").value(true));

        // The move row (already loaded once by move()'s own save()) was updated by a
        // bulk JPQL UPDATE (TaskMakeupLinkRepository.terminatePendingMove), which bypasses
        // the persistence context -- force a fresh read for the assertions below.
        entityManager.clear();

        var active = taskResponseEntryRepository
            .findByTaskIdAndStoreIdAndResponseDateAndActiveTrue(task.getId(), store.getId(), missedDate);
        assertThat(active).hasSize(1);
        assertThat(active.get(0).getCompletedVia()).isEqualTo(CompletedVia.MOVED);

        TaskMakeupLink move = taskMakeupLinkRepository
            .findByTaskIdAndStoreIdAndPastDateAndStatus(task.getId(), store.getId(), missedDate, MakeupLinkStatus.FULFILLED)
            .orElseThrow();
        assertThat(move.getStatus()).isEqualTo(MakeupLinkStatus.FULFILLED);
    }

    // The move already went FULFILLED the moment the first of two distinct
    // employees answered -- the second employee must still be able to submit.
    @Test
    void multipleMovedUnitRequiresASecondDistinctEmployeeEvenAfterTheMoveIsFulfilled() throws Exception {
        User owner = createUser("mt-owner-10@nforce.test", "OWNER_ADMIN");
        Store store = createStore(owner);
        Category category = createCategory(owner, store);
        assignEmployee(store, "mt-emp-10a@nforce.test", owner);
        assignEmployee(store, "mt-emp-10b@nforce.test", owner);
        Task task = createTask(owner, category, store, CompletionType.MULTIPLE, LocalDate.now().minusDays(1));
        LocalDate missedDate = LocalDate.now().minusDays(1);

        String tokenA = login("mt-emp-10a@nforce.test");
        String tokenB = login("mt-emp-10b@nforce.test");
        move(tokenA, task.getId(), missedDate, store.getId(), LocalDate.now(), 200);

        mockMvc.perform(post("/api/me/tasks/" + task.getId() + "/responses")
                .header("Authorization", "Bearer " + tokenA)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"storeId\":" + store.getId() + ",\"booleanValue\":true,\"originalDueDate\":\"" + missedDate + "\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.completedByCount").value(1));

        entityManager.clear();
        assertThat(taskMakeupLinkRepository
            .findByTaskIdAndStoreIdAndPastDateAndStatus(task.getId(), store.getId(), missedDate, MakeupLinkStatus.FULFILLED))
            .isPresent();

        mockMvc.perform(post("/api/me/tasks/" + task.getId() + "/responses")
                .header("Authorization", "Bearer " + tokenB)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"storeId\":" + store.getId() + ",\"booleanValue\":true,\"originalDueDate\":\"" + missedDate + "\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.completedByCount").value(2));
    }

    @Test
    void undoOfAMovedUnitResponseReturnsInstanceToMissedListAndOldMoveRowStaysTerminal() throws Exception {
        User owner = createUser("mt-owner-11@nforce.test", "OWNER_ADMIN");
        Store store = createStore(owner);
        Category category = createCategory(owner, store);
        assignEmployee(store, "mt-emp-11@nforce.test", owner);
        Task task = createTask(owner, category, store, CompletionType.SINGLE, LocalDate.now().minusDays(1));
        LocalDate missedDate = LocalDate.now().minusDays(1);

        String token = login("mt-emp-11@nforce.test");
        move(token, task.getId(), missedDate, store.getId(), LocalDate.now(), 200);

        String submitResponse = mockMvc.perform(post("/api/me/tasks/" + task.getId() + "/responses")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"storeId\":" + store.getId() + ",\"booleanValue\":true,\"originalDueDate\":\"" + missedDate + "\"}"))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        Long responseId = objectMapper.readTree(submitResponse).get("responses").get(0).get("id").asLong();

        mockMvc.perform(post("/api/me/tasks/" + task.getId() + "/responses/" + responseId + "/undo")
                .header("Authorization", "Bearer " + token)
                .param("storeId", store.getId().toString()))
            .andExpect(status().isOk());

        mockMvc.perform(get("/api/me/tasks/missed")
                .header("Authorization", "Bearer " + token)
                .param("storeId", store.getId().toString()))
            .andExpect(jsonPath("$.groups[0].date").value(missedDate.toString()))
            .andExpect(jsonPath("$.groups[0].instances[0].state").value("ACTIONABLE"));

        entityManager.clear();
        TaskMakeupLink oldMove = taskMakeupLinkRepository
            .findByTaskIdAndStoreIdAndPastDateAndStatus(task.getId(), store.getId(), missedDate, MakeupLinkStatus.FULFILLED)
            .orElseThrow();
        assertThat(oldMove.getStatus()).isEqualTo(MakeupLinkStatus.FULFILLED);

        // Re-movable: a fresh move for the same instance is allowed.
        move(token, task.getId(), missedDate, store.getId(), LocalDate.now(), 200);
    }

    // Unlike CompletedVia.LINK_FULFILLED, a MOVED response is not permanent --
    // admin resubmission-flag follows the same rules as any normal response.
    @Test
    void adminResubmissionFlagOnAMovedUnitResponseFollowsNormalNonPermanentRules() throws Exception {
        User owner = createUser("mt-owner-12@nforce.test", "OWNER_ADMIN");
        Store store = createStore(owner);
        Category category = createCategory(owner, store);
        assignEmployee(store, "mt-emp-12@nforce.test", owner);
        Task task = createTask(owner, category, store, CompletionType.SINGLE, LocalDate.now().minusDays(1));
        LocalDate missedDate = LocalDate.now().minusDays(1);

        String employeeToken = login("mt-emp-12@nforce.test");
        String ownerToken = login("mt-owner-12@nforce.test");
        move(employeeToken, task.getId(), missedDate, store.getId(), LocalDate.now(), 200);

        String submitResponse = mockMvc.perform(post("/api/me/tasks/" + task.getId() + "/responses")
                .header("Authorization", "Bearer " + employeeToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"storeId\":" + store.getId() + ",\"booleanValue\":true,\"originalDueDate\":\"" + missedDate + "\"}"))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        Long responseId = objectMapper.readTree(submitResponse).get("responses").get(0).get("id").asLong();

        mockMvc.perform(post("/api/checklist-history/responses/" + responseId + "/flag")
                .header("Authorization", "Bearer " + ownerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"Please redo this\"}"))
            .andExpect(status().isOk());

        // Resubmission on the flagged moved unit is accepted (not blocked like
        // LINK_FULFILLED would be) and produces a new active MOVED response.
        mockMvc.perform(post("/api/me/tasks/" + task.getId() + "/responses")
                .header("Authorization", "Bearer " + employeeToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"storeId\":" + store.getId() + ",\"booleanValue\":false,\"originalDueDate\":\"" + missedDate + "\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.responses[0].completedVia").value("MOVED"));
    }

    // Expiry is evaluated lazily on every missed-list/checklist read AND by the
    // nightly sweep (TaskMakeupLinkService.expireStalePendingMoves, which is also
    // exactly what /internal/jobs/nightly-maintenance calls -- exercised directly
    // here since that endpoint's shared-secret auth isn't configured for the test
    // profile). A move can never be created with a past target date via the API, so
    // the stale PENDING row is seeded directly.
    @Test
    void nightlySweepExpiresStalePendingMovesAndInstanceReturnsToMissedList() throws Exception {
        User owner = createUser("mt-owner-13@nforce.test", "OWNER_ADMIN");
        Store store = createStore(owner);
        Category category = createCategory(owner, store);
        User employee = assignEmployee(store, "mt-emp-13@nforce.test", owner);
        Task task = createTask(owner, category, store, CompletionType.SINGLE, LocalDate.now().minusDays(2));
        LocalDate missedDate = LocalDate.now().minusDays(2);
        // Constrain the task's own range to exactly missedDate, so the missed-list scan
        // below yields exactly the one instance this test is about -- otherwise the
        // task's still-open range would also surface yesterday as a second, unrelated
        // missed instance.
        task.setEndDate(missedDate);
        taskRepository.save(task);

        TaskMakeupLink staleMove = new TaskMakeupLink();
        staleMove.setTask(task);
        staleMove.setStore(store);
        staleMove.setPastDate(missedDate);
        staleMove.setLinkedDate(LocalDate.now().minusDays(1));
        staleMove.setCreatedBy(employee);
        staleMove.setStatus(MakeupLinkStatus.PENDING);
        taskMakeupLinkRepository.save(staleMove);

        String token = login("mt-emp-13@nforce.test");
        mockMvc.perform(get("/api/me/tasks/missed")
                .header("Authorization", "Bearer " + token)
                .param("storeId", store.getId().toString()))
            .andExpect(jsonPath("$.groups.length()").value(1))
            .andExpect(jsonPath("$.groups[0].date").value(missedDate.toString()));

        entityManager.clear();
        assertThat(taskMakeupLinkRepository.findById(staleMove.getId()).orElseThrow().getStatus())
            .isEqualTo(MakeupLinkStatus.EXPIRED);
    }

    // Hard-deleting a task with a PENDING move must not error, and the orphaned move row
    // is expected to be cascade-deleted with it (task_makeup_links.task_id references
    // tasks on delete cascade, V65/V66). NOTE: that FK cascade lives entirely in the
    // Flyway migration DDL. This test profile runs with Flyway disabled and the schema
    // generated by Hibernate straight from the JPA entities (see application-test.yml /
    // CLAUDE.md's backend Commands section) -- Hibernate's auto-DDL does not reproduce a
    // raw "on delete cascade" clause from a plain @JoinColumn, so the cascade itself is
    // not exercised here (the same kind of DB-level-only gap the existing SINGLE-completion
    // race is worked around for in TaskServiceTest, via a Mockito-simulated constraint
    // violation instead of a real one). What IS verified here, and does hold regardless
    // of schema-generation strategy, is that the delete itself succeeds without error
    // even though a PENDING move still references the task.
    @Test
    void hardDeletingATaskWithAPendingMoveSucceeds() throws Exception {
        User owner = createUser("mt-owner-14@nforce.test", "OWNER_ADMIN");
        Store store = createStore(owner);
        Category category = createCategory(owner, store);
        assignEmployee(store, "mt-emp-14@nforce.test", owner);
        Task task = createTask(owner, category, store, CompletionType.SINGLE, LocalDate.now().minusDays(1));
        LocalDate missedDate = LocalDate.now().minusDays(1);
        Long taskId = task.getId();

        String employeeToken = login("mt-emp-14@nforce.test");
        move(employeeToken, taskId, missedDate, store.getId(), LocalDate.now(), 200);
        assertThat(taskMakeupLinkRepository
            .findByTaskIdAndStoreIdAndPastDateAndStatus(taskId, store.getId(), missedDate, MakeupLinkStatus.PENDING))
            .isPresent();

        String ownerToken = login("mt-owner-14@nforce.test");
        mockMvc.perform(delete("/api/tasks/" + taskId)
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isNoContent());

        assertThat(taskRepository.findById(taskId)).isEmpty();
    }

    // Store-scoped like everything else: an employee assigned only to store A must
    // never see or act on store B's missed instances/moves, even by guessing IDs.
    @Test
    void missedTasksAndMoveAreStoreScoped() throws Exception {
        User ownerA = createUser("mt-owner-15a@nforce.test", "OWNER_ADMIN");
        Store storeA = createStore(ownerA);
        Category categoryA = createCategory(ownerA, storeA);
        assignEmployee(storeA, "mt-emp-15@nforce.test", ownerA);
        Task taskA = createTask(ownerA, categoryA, storeA, CompletionType.SINGLE, LocalDate.now().minusDays(1));
        LocalDate missedDate = LocalDate.now().minusDays(1);

        User ownerB = createUser("mt-owner-15b@nforce.test", "OWNER_ADMIN");
        Store storeB = createStore(ownerB);

        String token = login("mt-emp-15@nforce.test");

        mockMvc.perform(get("/api/me/tasks/missed")
                .header("Authorization", "Bearer " + token)
                .param("storeId", storeB.getId().toString()))
            .andExpect(status().isNotFound());

        mockMvc.perform(post("/api/me/tasks/" + taskA.getId() + "/missed/" + missedDate + "/move")
                .header("Authorization", "Bearer " + token)
                .param("storeId", storeB.getId().toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"targetDate\":\"" + LocalDate.now() + "\"}"))
            .andExpect(status().isNotFound());
    }

    private record LoginPayload(String email, String password) {
    }
}
