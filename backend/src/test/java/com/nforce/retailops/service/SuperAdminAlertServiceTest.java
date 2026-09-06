package com.nforce.retailops.service;

import com.nforce.retailops.entity.Category;
import com.nforce.retailops.entity.CompletionType;
import com.nforce.retailops.entity.RaisedIssue;
import com.nforce.retailops.entity.ResponseType;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.ScheduleType;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.entity.Task;
import com.nforce.retailops.entity.TaskResponseEntry;
import com.nforce.retailops.entity.TimeMode;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.CategoryRepository;
import com.nforce.retailops.repository.NotificationRepository;
import com.nforce.retailops.repository.RaisedIssueRepository;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.SuperAdminRepository;
import com.nforce.retailops.repository.TaskRepository;
import com.nforce.retailops.repository.TaskResponseEntryRepository;
import com.nforce.retailops.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class SuperAdminAlertServiceTest {

    @Autowired private SuperAdminAlertService superAdminAlertService;
    @Autowired private NotificationRepository notificationRepository;
    @Autowired private StoreRepository storeRepository;
    @Autowired private SuperAdminRepository superAdminRepository;
    @Autowired private TaskResponseEntryRepository taskResponseEntryRepository;
    @Autowired private TaskRepository taskRepository;
    @Autowired private CategoryRepository categoryRepository;
    @Autowired private RaisedIssueRepository raisedIssueRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private SuperAdmin createSuperAdmin(String email) {
        SuperAdmin sa = new SuperAdmin();
        sa.setName("Test SA");
        sa.setEmail(email);
        sa.setPasswordHash(passwordEncoder.encode("password"));
        return superAdminRepository.save(sa);
    }

    private Store createActiveStore(String name, long code) {
        Store s = new Store();
        s.setName(name);
        s.setStoreCode(code);
        s.setActive(true);
        return storeRepository.save(s);
    }

    private User createEmployee(String email) {
        Role role = roleRepository.findByName("EMPLOYEE").orElseGet(() -> {
            Role r = new Role(); r.setName("EMPLOYEE"); r.setDescription("Employee");
            return roleRepository.save(r);
        });
        User u = new User();
        u.setEmail(email);
        u.setPasswordHash(passwordEncoder.encode("password"));
        u.setFullName("Test Employee");
        u.getRoles().add(role);
        return userRepository.save(u);
    }

    private Task createTask(User owner, Store store) {
        Category cat = new Category();
        cat.setOwner(owner);
        cat.setName("Alert Test Cat " + System.nanoTime());
        cat.setDisplayOrder(0);
        cat.setActive(true);
        cat = categoryRepository.save(cat);

        Task t = new Task();
        t.setOwner(owner);
        t.setCategory(cat);
        t.setName("Alert Test Task " + System.nanoTime());
        t.setDisplayOrder(0);
        t.setAppliesToAllStores(false);
        t.getStores().add(store);
        t.setResponseType(ResponseType.YES_NO);
        t.setCompletionType(CompletionType.SINGLE);
        t.setScheduleType(ScheduleType.EVERY_DAY);
        t.setTimeMode(TimeMode.ANYTIME);
        t.setStartDate(LocalDate.now().minusDays(1));
        t.setActive(true);
        return taskRepository.save(t);
    }

    private void createResponse(Store store, User employee, LocalDate date) {
        Role ownerRole = roleRepository.findByName("OWNER_ADMIN").orElseGet(() -> {
            Role r = new Role(); r.setName("OWNER_ADMIN"); r.setDescription("Owner");
            return roleRepository.save(r);
        });
        User owner = new User();
        owner.setEmail("owner-resp-" + System.nanoTime() + "@nforce.test");
        owner.setPasswordHash(passwordEncoder.encode("password"));
        owner.setFullName("Resp Owner");
        owner.getRoles().add(ownerRole);
        owner = userRepository.save(owner);

        Task task = createTask(owner, store);

        TaskResponseEntry r = new TaskResponseEntry();
        r.setTask(task);
        r.setStore(store);
        r.setEmployee(employee);
        r.setResponseDate(date);
        r.setResponseType(ResponseType.YES_NO);
        r.setCompletionType(CompletionType.SINGLE);
        r.setValueBoolean(true);
        r.setActive(true);
        taskResponseEntryRepository.save(r);
    }

    // ── Trigger 1: Zero Activity ─────────────────────────────────────────────

    @Test
    @Transactional
    void zeroActivityCheck_storeWithNoResponses_notifiesAllSuperAdmins() {
        SuperAdmin sa = createSuperAdmin("sa-alert-zero-1@nforce.test");
        Store store = createActiveStore("Zero Store 1", 8100L);
        LocalDate today = LocalDate.now();

        superAdminAlertService.runZeroActivityCheck(today);

        List<?> notifications = notificationRepository
            .findByRecipientSuperAdminIdOrderByCreatedAtDesc(sa.getId(), org.springframework.data.domain.PageRequest.of(0, 50));
        assertThat(notifications).hasSize(1);
        var n = (com.nforce.retailops.entity.Notification) notifications.get(0);
        assertThat(n.getCategory()).isEqualTo("STORE_ZERO_ACTIVITY");
        assertThat(n.getTitle()).contains("Zero Store 1");
    }

    @Test
    @Transactional
    void zeroActivityCheck_storeWithResponses_doesNotNotify() {
        SuperAdmin sa = createSuperAdmin("sa-alert-zero-2@nforce.test");
        Store store = createActiveStore("Active Store 2", 8101L);
        User emp = createEmployee("emp-alert-zero-2@nforce.test");
        LocalDate today = LocalDate.now();
        createResponse(store, emp, today);

        superAdminAlertService.runZeroActivityCheck(today);

        List<?> notifications = notificationRepository
            .findByRecipientSuperAdminIdOrderByCreatedAtDesc(sa.getId(), org.springframework.data.domain.PageRequest.of(0, 50));
        // May contain notifications from the zero-response stores created by other tests in same run;
        // none should be for the "Active Store 2" that has activity.
        boolean hasZeroAlert = notifications.stream()
            .anyMatch(o -> ((com.nforce.retailops.entity.Notification) o).getTitle().contains("Active Store 2"));
        assertThat(hasZeroAlert).isFalse();
    }

    @Test
    @Transactional
    void zeroActivityCheck_runTwiceSameDay_noDuplicateNotification() {
        SuperAdmin sa = createSuperAdmin("sa-alert-zero-3@nforce.test");
        createActiveStore("Dedup Store 3", 8102L);
        LocalDate today = LocalDate.now();

        superAdminAlertService.runZeroActivityCheck(today);
        superAdminAlertService.runZeroActivityCheck(today);

        List<?> notifications = notificationRepository
            .findByRecipientSuperAdminIdOrderByCreatedAtDesc(sa.getId(), org.springframework.data.domain.PageRequest.of(0, 50));
        long dedupCount = notifications.stream()
            .filter(o -> ((com.nforce.retailops.entity.Notification) o).getTitle().contains("Dedup Store 3"))
            .count();
        assertThat(dedupCount).isEqualTo(1);
    }

    // ── Trigger 2: Overdue Issues ─────────────────────────────────────────────

    @Test
    @Transactional
    void overdueIssuesCheck_storeWithOverdueIssues_notifiesWithCount() {
        SuperAdmin sa = createSuperAdmin("sa-alert-overdue-1@nforce.test");
        Store store = createActiveStore("Overdue Store 1", 8200L);
        User emp = createEmployee("emp-overdue-1@nforce.test");

        // Create 2 issues older than 48 hours
        for (int i = 0; i < 2; i++) {
            RaisedIssue issue = new RaisedIssue();
            issue.setStore(store);
            issue.setEmployeeUser(emp);
            issue.setNote("Overdue issue " + i);
            issue.setStatus("OPEN");
            raisedIssueRepository.save(issue);
        }

        OffsetDateTime now = OffsetDateTime.now();
        // Pass a 'now' that is 49h after creation — issues are older than 48h
        superAdminAlertService.runOverdueIssuesCheck(now.plusHours(49));

        List<?> notifications = notificationRepository
            .findByRecipientSuperAdminIdOrderByCreatedAtDesc(sa.getId(), org.springframework.data.domain.PageRequest.of(0, 50));
        assertThat(notifications).isNotEmpty();
        boolean hasOverdueAlert = notifications.stream()
            .anyMatch(o -> {
                var notif = (com.nforce.retailops.entity.Notification) o;
                return "ISSUES_OVERDUE".equals(notif.getCategory())
                    && notif.getTitle().contains("Overdue Store 1")
                    && notif.getMessage().contains("2 issue");
            });
        assertThat(hasOverdueAlert).isTrue();
    }

    @Test
    @Transactional
    void overdueIssuesCheck_issuesUnder48h_doesNotNotify() {
        SuperAdmin sa = createSuperAdmin("sa-alert-overdue-2@nforce.test");
        Store store = createActiveStore("Fresh Store 2", 8201L);
        User emp = createEmployee("emp-overdue-fresh-2@nforce.test");

        RaisedIssue issue = new RaisedIssue();
        issue.setStore(store);
        issue.setEmployeeUser(emp);
        issue.setNote("Recent issue");
        issue.setStatus("OPEN");
        raisedIssueRepository.save(issue);

        // Check at 'now' — the issue was just created (<48h)
        superAdminAlertService.runOverdueIssuesCheck(OffsetDateTime.now());

        List<?> notifications = notificationRepository
            .findByRecipientSuperAdminIdOrderByCreatedAtDesc(sa.getId(), org.springframework.data.domain.PageRequest.of(0, 50));
        boolean hasOverdueAlert = notifications.stream()
            .anyMatch(o -> {
                var notif = (com.nforce.retailops.entity.Notification) o;
                return "ISSUES_OVERDUE".equals(notif.getCategory())
                    && notif.getTitle().contains("Fresh Store 2");
            });
        assertThat(hasOverdueAlert).isFalse();
    }

    @Test
    @Transactional
    void overdueIssuesCheck_runTwiceSameDay_noDuplicateNotification() {
        SuperAdmin sa = createSuperAdmin("sa-alert-overdue-3@nforce.test");
        Store store = createActiveStore("Dedup Overdue Store 3", 8202L);
        User emp = createEmployee("emp-overdue-dedup-3@nforce.test");

        RaisedIssue issue = new RaisedIssue();
        issue.setStore(store);
        issue.setEmployeeUser(emp);
        issue.setNote("Dedup overdue issue");
        issue.setStatus("OPEN");
        raisedIssueRepository.save(issue);

        OffsetDateTime future = OffsetDateTime.now().plusHours(49);
        superAdminAlertService.runOverdueIssuesCheck(future);
        superAdminAlertService.runOverdueIssuesCheck(future);

        List<?> notifications = notificationRepository
            .findByRecipientSuperAdminIdOrderByCreatedAtDesc(sa.getId(), org.springframework.data.domain.PageRequest.of(0, 50));
        long count = notifications.stream()
            .filter(o -> {
                var notif = (com.nforce.retailops.entity.Notification) o;
                return "ISSUES_OVERDUE".equals(notif.getCategory())
                    && notif.getTitle().contains("Dedup Overdue Store 3");
            })
            .count();
        assertThat(count).isEqualTo(1);
    }
}
