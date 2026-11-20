package com.nforce.retailops.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nforce.retailops.entity.DailyCashEntry;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreEmployee;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.DailyCashEntryRepository;
import com.nforce.retailops.repository.NotificationRepository;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.StoreEmployeeRepository;
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

import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// RTS-556 / 557 / 558 end to end: an Owner/Admin flags the entry an employee
// made, only that employee is told and may fix it, the fix resolves the flag,
// and the history lists every step.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class CashFlagLifecycleTest {

    private static final String PASSWORD = "correct-horse-battery-staple";
    private static final String FLAG_COMMENT = "Cash removed looks too high for a Tuesday";

    @Autowired private MockMvc mockMvc;
    @Autowired private RoleRepository roleRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private StoreRepository storeRepository;
    @Autowired private StoreOwnerRepository storeOwnerRepository;
    @Autowired private StoreEmployeeRepository storeEmployeeRepository;
    @Autowired private NotificationRepository notificationRepository;
    @Autowired private DailyCashEntryRepository entryRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private Store store;
    private Store otherStore;
    private User owner;
    private User author;
    private User colleague;
    private String ownerToken;
    private String authorToken;
    private String colleagueToken;
    private final LocalDate today = LocalDate.now();

    private Role role(String name) {
        return roleRepository.findByName(name).orElseGet(() -> {
            Role r = new Role();
            r.setName(name);
            r.setDescription(name);
            return roleRepository.save(r);
        });
    }

    private User user(String email, String name, String roleName) {
        User u = new User();
        u.setEmail(email);
        u.setPasswordHash(passwordEncoder.encode(PASSWORD));
        u.setFullName(name);
        u.getRoles().add(role(roleName));
        return userRepository.save(u);
    }

    private Store store(String name, long code) {
        Store s = new Store();
        s.setName(name);
        s.setStoreCode(code);
        s.setActive(true);
        return storeRepository.save(s);
    }

    private User employeeAt(String email, String name, Store s) {
        User e = user(email, name, "EMPLOYEE");
        StoreEmployee se = new StoreEmployee();
        se.setEmployee(e);
        se.setPhone("555-0100");
        se.setEmployeeType("Full-time");
        se.setGender("Other");
        se.setStores(new HashSet<>(Set.of(s)));
        storeEmployeeRepository.save(se);
        return e;
    }

    private String login(String email) throws Exception {
        String json = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new Login(email, PASSWORD))))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(json).get("token").asText();
    }

    private record Login(String email, String password) {}

    @BeforeEach
    void setUp() throws Exception {
        store = store("Flag Store", 9601L);
        otherStore = store("Other Flag Store", 9602L);
        owner = user("flag-owner@nforce.test", "Olive Owner", "OWNER_ADMIN");
        StoreOwner link = new StoreOwner();
        link.setStore(store);
        link.setOwner(owner);
        link.setActive(true);
        storeOwnerRepository.save(link);
        author = employeeAt("flag-author@nforce.test", "Erin Author", store);
        colleague = employeeAt("flag-colleague@nforce.test", "Cole Colleague", store);
        ownerToken = login("flag-owner@nforce.test");
        authorToken = login("flag-author@nforce.test");
        colleagueToken = login("flag-colleague@nforce.test");
    }

    private static String body(LocalDate date, String removed, String note) {
        return "{\"businessDate\":\"" + date + "\",\"openingDrawerCash\":100.00,"
            + "\"cashRemoved\":" + removed + ",\"cashRemaining\":90.00,\"otherAdjustments\":0"
            + (note == null ? "" : ",\"correctionReason\":\"" + note + "\"") + "}";
    }

    private ResultActions employeePut(String token, String body) throws Exception {
        return mockMvc.perform(put("/api/me/cash").param("storeId", store.getId().toString())
            .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private ResultActions employeeGet(String token) throws Exception {
        return mockMvc.perform(get("/api/me/cash").param("storeId", store.getId().toString())
            .header("Authorization", "Bearer " + token));
    }

    private long entryId() throws Exception {
        String json = employeeGet(authorToken).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(json).get("id").asLong();
    }

    private ResultActions ownerFlag(long entryId, String comment) throws Exception {
        return mockMvc.perform(post("/api/stores/cash/entries/" + entryId + "/flag")
            .header("Authorization", "Bearer " + ownerToken).contentType(MediaType.APPLICATION_JSON)
            .content("{\"comment\":\"" + comment + "\"}"));
    }

    @Test
    void flagNotifiesOnlyTheEnteringEmployeeAndLocksTheEntryToThem() throws Exception {
        employeePut(authorToken, body(today, "10.00", null)).andExpect(status().isOk());
        long id = entryId();
        long before = notificationRepository.count();

        ownerFlag(id, FLAG_COMMENT).andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("Flagged"))
            .andExpect(jsonPath("$.flag.comment").value(FLAG_COMMENT))
            .andExpect(jsonPath("$.flag.flaggedByName").value("Olive Owner"))
            .andExpect(jsonPath("$.flag.flaggedAt").exists());

        // One notification, to the author, linking to the flagged date.
        assertThat(notificationRepository.count()).isEqualTo(before + 1);
        assertThat(notificationRepository.findAll()).anySatisfy(n -> {
            assertThat(n.getRecipientUser().getId()).isEqualTo(author.getId());
            assertThat(n.getLinkPath()).isEqualTo("/cash?date=" + today);
        });

        // The author sees the comment and may edit; a colleague sees it read-only (403 on write).
        employeeGet(authorToken).andExpect(jsonPath("$.canEdit").value(true))
            .andExpect(jsonPath("$.flag.comment").value(FLAG_COMMENT));
        employeeGet(colleagueToken).andExpect(jsonPath("$.canEdit").value(false));
        employeePut(colleagueToken, body(today, "11.00", null)).andExpect(status().isForbidden());

        // Already flagged: a second flag is refused.
        ownerFlag(id, "Another comment that is long enough").andExpect(status().isConflict());
    }

    @Test
    void authorFixingAFlaggedEntryResolvesItAndHistoryListsEveryStep() throws Exception {
        employeePut(authorToken, body(today, "10.00", null)).andExpect(status().isOk());
        long id = entryId();
        ownerFlag(id, FLAG_COMMENT).andExpect(status().isOk());

        employeePut(authorToken, body(today, "12.00", "Recounted the drawer"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("Corrected"))
            .andExpect(jsonPath("$.flag").doesNotExist())
            .andExpect(jsonPath("$.resolvedFlag.resolution").value("EMPLOYEE_FIXED"))
            .andExpect(jsonPath("$.resolvedFlag.resolvedByName").value("Erin Author"))
            .andExpect(jsonPath("$.resolvedFlag.resolutionNote").value("Recounted the drawer"))
            .andExpect(jsonPath("$.correctedByName").value("Erin Author"))
            .andExpect(jsonPath("$.correctedByRole").value("EMPLOYEE"))
            .andExpect(jsonPath("$.expectedCashOnHand").doesNotExist());

        // The admin sees the resolved flag and can flag again.
        mockMvc.perform(get("/api/stores/cash").param("date", today.toString())
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.resolvedFlag.resolution").value("EMPLOYEE_FIXED"))
            .andExpect(jsonPath("$.expectedCashOnHand").value(90.00));
        ownerFlag(id, "Still looks wrong to me today").andExpect(status().isOk());

        mockMvc.perform(get("/api/stores/cash/history").header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.events[?(@.type=='CREATED')].actorName").value("Erin Author"))
            .andExpect(jsonPath("$.events[?(@.type=='EMPLOYEE_EDIT')].comment").value("Recounted the drawer"))
            .andExpect(jsonPath("$.events[?(@.type=='EMPLOYEE_EDIT')].previous.cashRemoved").value(10.00))
            .andExpect(jsonPath("$.events[?(@.type=='EMPLOYEE_EDIT')].current.cashRemoved").value(12.00))
            .andExpect(jsonPath("$.events[?(@.type=='FLAGGED')]", org.hamcrest.Matchers.hasSize(2)))
            .andExpect(jsonPath("$.events[?(@.type=='FLAG_RESOLVED')].actorName").value("Erin Author"));

        // Status filter: one open flag now, so OPEN keeps the entry and RESOLVED does too (it has a resolved one).
        mockMvc.perform(get("/api/stores/cash/history").param("status", "OPEN")
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(jsonPath("$.events.length()").value(org.hamcrest.Matchers.greaterThan(0)));
    }

    @Test
    void ownerCanEditAndRemoveTheFlagAndBothAreInHistory() throws Exception {
        employeePut(authorToken, body(today, "10.00", null)).andExpect(status().isOk());
        long id = entryId();
        ownerFlag(id, FLAG_COMMENT).andExpect(status().isOk());

        mockMvc.perform(patch("/api/stores/cash/entries/" + id + "/flag")
                .header("Authorization", "Bearer " + ownerToken).contentType(MediaType.APPLICATION_JSON)
                .content("{\"comment\":\"Please recount cash removed and expenses\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.flag.comment").value("Please recount cash removed and expenses"));
        mockMvc.perform(delete("/api/stores/cash/entries/" + id + "/flag")
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("Entered"))
            .andExpect(jsonPath("$.flag").doesNotExist());

        // Unflagged again: any store employee may edit today's entry.
        employeePut(colleagueToken, body(today, "9.00", null)).andExpect(status().isOk());

        mockMvc.perform(get("/api/stores/cash/history").param("status", "RESOLVED")
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(jsonPath("$.events[?(@.type=='FLAG_EDITED')]", org.hamcrest.Matchers.hasSize(1)))
            .andExpect(jsonPath("$.events[?(@.type=='FLAG_REMOVED')].actorName").value("Olive Owner"));
    }

    @Test
    void flagIsRefusedWhenTheEnteringEmployeeIsUnknownOrHasLeftTheStore() throws Exception {
        // Entered by the Owner/Admin themself (not an employee): nobody to notify.
        mockMvc.perform(put("/api/stores/cash").header("Authorization", "Bearer " + ownerToken)
                .contentType(MediaType.APPLICATION_JSON).content(body(today.minusDays(1), "1.00", null)))
            .andExpect(status().isOk());
        String json = mockMvc.perform(get("/api/stores/cash").param("date", today.minusDays(1).toString())
                .header("Authorization", "Bearer " + ownerToken)).andReturn().getResponse().getContentAsString();
        long ownerEntry = objectMapper.readTree(json).get("id").asLong();
        ownerFlag(ownerEntry, FLAG_COMMENT).andExpect(status().isConflict());

        // The author leaves the store.
        employeePut(authorToken, body(today, "10.00", null)).andExpect(status().isOk());
        long id = entryId();
        StoreEmployee se = storeEmployeeRepository.findByEmployeeId(author.getId()).orElseThrow();
        se.setStores(new HashSet<>());
        storeEmployeeRepository.save(se);
        ownerFlag(id, FLAG_COMMENT).andExpect(status().isConflict())
            .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("no longer assigned")));
    }

    @Test
    void flagRequiresANonEmptyComment() throws Exception {
        employeePut(authorToken, body(today, "10.00", null)).andExpect(status().isOk());
        long id = entryId();
        ownerFlag(id, "   ").andExpect(status().isBadRequest());
        ownerFlag(id, "too short").andExpect(status().isOk());
    }

    @Test
    void flaggedPastEntryIsEditableByItsAuthorButUnflaggedPastEntryIsNot() throws Exception {
        LocalDate past = today.minusDays(2);
        // An unflagged entry from the past can't be created or changed by an employee.
        employeePut(authorToken, body(past, "10.00", null)).andExpect(status().isForbidden());

        // A past entry the author made (seeded directly) that the owner flags.
        DailyCashEntry old = new DailyCashEntry();
        old.setStore(store);
        old.setBusinessDate(past);
        old.setOpeningDrawerCash(new java.math.BigDecimal("100"));
        old.setCashRemoved(new java.math.BigDecimal("10"));
        old.setCashRemaining(new java.math.BigDecimal("90"));
        old.setOtherAdjustments(java.math.BigDecimal.ZERO);
        old.setDailyExpectedCash(new java.math.BigDecimal("90"));
        old.setEnteredByUser(author);
        old.setUpdatedByUser(author);
        old.setEnteredAt(java.time.OffsetDateTime.now().minusDays(2));
        old.setUpdatedAt(java.time.OffsetDateTime.now().minusDays(2));
        old = entryRepository.save(old);
        ownerFlag(old.getId(), FLAG_COMMENT).andExpect(status().isOk());

        // Only the author may fix it, on its own (past) date.
        employeePut(colleagueToken, body(past, "11.00", null)).andExpect(status().isForbidden());
        employeePut(authorToken, body(past, "11.00", null)).andExpect(status().isBadRequest());
        employeePut(authorToken, body(past, "11.00", "Fixed the figure")).andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("Corrected"))
            .andExpect(jsonPath("$.canEdit").value(true));

        // Resolved: back to read-only for everyone, as it is a past day.
        employeePut(authorToken, body(past, "12.00", null)).andExpect(status().isForbidden());
    }

    @Test
    void ownerCannotFlagAnEntryOfAnotherStore() throws Exception {
        User otherEmployee = employeeAt("flag-other@nforce.test", "Otto Other", otherStore);
        String t = login("flag-other@nforce.test");
        mockMvc.perform(put("/api/me/cash").param("storeId", otherStore.getId().toString())
                .header("Authorization", "Bearer " + t).contentType(MediaType.APPLICATION_JSON)
                .content(body(today, "10.00", null)))
            .andExpect(status().isOk());
        String json = mockMvc.perform(get("/api/me/cash").param("storeId", otherStore.getId().toString())
                .header("Authorization", "Bearer " + t)).andReturn().getResponse().getContentAsString();
        long otherEntry = objectMapper.readTree(json).get("id").asLong();
        assertThat(otherEmployee.getId()).isNotNull();
        ownerFlag(otherEntry, FLAG_COMMENT).andExpect(status().isNotFound());
    }

    @Test
    void employeesHaveNoCashHistoryEndpoint() throws Exception {
        mockMvc.perform(get("/api/me/cash/history").param("storeId", store.getId().toString())
                .header("Authorization", "Bearer " + authorToken))
            .andExpect(status().is4xxClientError());
    }

    @Test
    void expectedAsOfWorksForADayWithNoEntry() throws Exception {
        employeePut(authorToken, body(today, "10.00", null)).andExpect(status().isOk());
        mockMvc.perform(get("/api/stores/cash/expected-as-of").param("date", today.plusDays(0).toString())
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(jsonPath("$.expectedCashOnHand").value(90.00));
        mockMvc.perform(get("/api/stores/cash/expected-as-of").param("date", today.minusDays(5).toString())
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(jsonPath("$.expectedCashOnHand").value(0));
    }
}
