package com.nforce.retailops.service;

import com.nforce.retailops.dto.IssueResponse;
import com.nforce.retailops.dto.RaiseIssueRequest;
import com.nforce.retailops.dto.UpdateIssueStatusRequest;
import com.nforce.retailops.entity.RaisedIssue;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.InvalidIssueTransitionException;
import com.nforce.retailops.exception.IssueAlreadyResolvedException;
import com.nforce.retailops.exception.IssueNotFoundException;
import com.nforce.retailops.exception.NudgeCooldownException;
import com.nforce.retailops.exception.StoreHasNoActiveOwnerException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.RaisedIssueRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.UserRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
public class RaisedIssueService {

    // Issues only move forward: OPEN -> ACKNOWLEDGED -> RESOLVED, or straight
    // from OPEN to RESOLVED. A resolved issue is final (no reopen).
    private static final Map<String, Set<String>> ALLOWED_TRANSITIONS = Map.of(
        "OPEN", Set.of("ACKNOWLEDGED", "RESOLVED"),
        "ACKNOWLEDGED", Set.of("RESOLVED"),
        "RESOLVED", Set.of()
    );

    static final long NUDGE_COOLDOWN_HOURS = 24;

    private final RaisedIssueRepository raisedIssueRepository;
    private final StoreRepository storeRepository;
    private final UserRepository userRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final UserProfileService userProfileService;
    private final NotificationService notificationService;
    private final ActivityLogService activityLogService;

    public RaisedIssueService(
        RaisedIssueRepository raisedIssueRepository,
        StoreRepository storeRepository,
        UserRepository userRepository,
        StoreOwnerRepository storeOwnerRepository,
        UserProfileService userProfileService,
        NotificationService notificationService,
        ActivityLogService activityLogService
    ) {
        this.raisedIssueRepository = raisedIssueRepository;
        this.storeRepository = storeRepository;
        this.userRepository = userRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.userProfileService = userProfileService;
        this.notificationService = notificationService;
        this.activityLogService = activityLogService;
    }

    @Transactional
    public IssueResponse createIssue(Long employeeUserId, RaiseIssueRequest request) {
        // Throws StoreNotFoundException (404) if employee not assigned to this store
        userProfileService.requireAssignedStore(employeeUserId, request.storeId());

        Store store = storeRepository.findById(request.storeId())
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
        User employee = userRepository.findById(employeeUserId)
            .orElseThrow(() -> new StoreNotFoundException("User not found"));

        RaisedIssue issue = new RaisedIssue();
        issue.setStore(store);
        issue.setEmployeeUser(employee);
        issue.setNote(request.note().trim());

        RaisedIssue saved = raisedIssueRepository.save(issue);

        // Notify the store's current active owner, if one exists.
        activeOwner(request.storeId())
            .ifPresent(owner -> notificationService.createForIssue(saved, owner));

        activityLogService.log(
            "ISSUE_REPORTED", employee.getFullName(), "EMPLOYEE",
            store.getId(), store.getName(), "ISSUE", null,
            "Reported an issue"
        );

        return IssueResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<IssueResponse> listForEmployee(Long employeeUserId, Long storeId) {
        userProfileService.requireAssignedStore(employeeUserId, storeId);
        return raisedIssueRepository.findByStoreIdAndEmployeeUserIdOrderByCreatedAtDesc(storeId, employeeUserId)
            .stream().map(IssueResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<IssueResponse> listForOwner(Long ownerId, Long storeId, String status) {
        storeOwnerRepository.findByStoreIdAndOwnerIdAndActiveTrue(storeId, ownerId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
        List<RaisedIssue> issues = (status != null && !status.isBlank())
            ? raisedIssueRepository.findByStoreIdAndStatusOrderByCreatedAtDesc(storeId, status)
            : raisedIssueRepository.findByStoreIdOrderByCreatedAtDesc(storeId);
        return issues.stream().map(IssueResponse::from).toList();
    }

    @Transactional
    public IssueResponse updateStatus(Long issueId, Long ownerId, UpdateIssueStatusRequest request) {
        RaisedIssue issue = raisedIssueRepository.findByIdWithEmployee(issueId)
            .orElseThrow(() -> new IssueNotFoundException("Issue not found"));

        // An inactive (revoked) link no longer grants access to the store's issues.
        storeOwnerRepository.findByStoreIdAndOwnerIdAndActiveTrue(issue.getStore().getId(), ownerId)
            .orElseThrow(() -> new AccessDeniedException("You do not own this store"));

        if (!applyTransition(issue, request)) {
            return IssueResponse.from(issue);
        }

        User owner = userRepository.findById(ownerId)
            .orElseThrow(() -> new AccessDeniedException("You do not own this store"));
        issue.setRespondedByUser(owner);
        issue.setRespondedBySuperAdmin(null);

        RaisedIssue saved = raisedIssueRepository.save(issue);
        notificationService.createForIssueUpdate(saved, request.status());

        activityLogService.log(
            issueStatusActionType(request.status()), owner.getFullName(), "OWNER_ADMIN",
            issue.getStore().getId(), issue.getStore().getName(), "ISSUE", null,
            issueStatusDescription(request.status())
        );

        return IssueResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<IssueResponse> listAllForSuperAdmin(String status) {
        List<RaisedIssue> issues = (status != null && !status.isBlank())
            ? raisedIssueRepository.findAllByStatusOrderByCreatedAtDesc(status)
            : raisedIssueRepository.findAllOrderByCreatedAtDesc();
        return issues.stream().map(IssueResponse::from).toList();
    }

    @Transactional
    public IssueResponse updateStatusForSuperAdmin(Long issueId, SuperAdmin superAdmin, UpdateIssueStatusRequest request) {
        RaisedIssue issue = raisedIssueRepository.findByIdWithEmployee(issueId)
            .orElseThrow(() -> new IssueNotFoundException("Issue not found"));

        if (!applyTransition(issue, request)) {
            return IssueResponse.from(issue);
        }

        issue.setRespondedByUser(null);
        issue.setRespondedBySuperAdmin(superAdmin);

        RaisedIssue saved = raisedIssueRepository.save(issue);
        notificationService.createForIssueUpdate(saved, request.status());
        activeOwner(issue.getStore().getId())
            .ifPresent(owner -> notificationService.notifyOwnerOfSuperAdminIssueUpdate(saved, owner, request.status()));

        activityLogService.log(
            issueStatusActionType(request.status()), superAdminName(superAdmin), "SUPER_ADMIN",
            issue.getStore().getId(), issue.getStore().getName(), "ISSUE", null,
            issueStatusDescription(request.status())
        );

        return IssueResponse.from(saved);
    }

    @Transactional
    public void nudgeOwner(Long issueId) {
        RaisedIssue issue = raisedIssueRepository.findByIdWithEmployee(issueId)
            .orElseThrow(() -> new IssueNotFoundException("Issue not found"));

        if ("RESOLVED".equals(issue.getStatus())) {
            throw new IssueAlreadyResolvedException("This issue is already resolved.");
        }

        User owner = activeOwner(issue.getStore().getId())
            .orElseThrow(() -> new StoreHasNoActiveOwnerException(
                issue.getStore().getName() + " has no active owner to nudge."));

        OffsetDateTime since = OffsetDateTime.now().minusHours(NUDGE_COOLDOWN_HOURS);
        if (notificationService.issueNudgedSince(issueId, since)) {
            throw new NudgeCooldownException(
                "The owner was already nudged about this issue in the last " + NUDGE_COOLDOWN_HOURS + " hours.");
        }

        notificationService.nudgeOwnerForIssue(issue, owner);
    }

    @Scheduled(cron = "0 0 3 * * *")
    @Transactional
    public void purgeOldResolvedIssues() {
        OffsetDateTime cutoff = OffsetDateTime.now().minusDays(7);
        raisedIssueRepository.deleteResolvedBefore(cutoff);
    }

    // Validates and applies a status change shared by the owner and Super Admin
    // paths. Returns false for a same-status request (a no-op: nothing saved,
    // no notification or activity log), so a double-click can't fan out
    // duplicate notifications.
    private boolean applyTransition(RaisedIssue issue, UpdateIssueStatusRequest request) {
        String current = issue.getStatus();
        String target = request.status();
        if (current.equals(target)) {
            return false;
        }
        if (!ALLOWED_TRANSITIONS.getOrDefault(current, Set.of()).contains(target)) {
            throw new InvalidIssueTransitionException(
                "Cannot change an issue from " + current + " to " + target + ".");
        }

        issue.setStatus(target);
        if (request.responseText() != null && !request.responseText().isBlank()) {
            issue.setResponseText(request.responseText().trim());
        }
        issue.setRespondedAt(OffsetDateTime.now());
        return true;
    }

    // The store's current active owner -- a link can be active yet ownerless
    // (see StoreOwner.owner), which counts as no owner.
    private Optional<User> activeOwner(Long storeId) {
        return storeOwnerRepository.findByStoreIdAndActiveTrue(storeId)
            .map(StoreOwner::getOwner);
    }

    private String superAdminName(SuperAdmin superAdmin) {
        return superAdmin != null && superAdmin.getName() != null ? superAdmin.getName() : "Super Admin";
    }

    private String issueStatusActionType(String status) {
        return "RESOLVED".equals(status) ? "ISSUE_RESOLVED"
            : "ACKNOWLEDGED".equals(status) ? "ISSUE_ACKNOWLEDGED"
            : "ISSUE_UPDATED";
    }

    private String issueStatusDescription(String status) {
        return "RESOLVED".equals(status) ? "Resolved an issue"
            : "ACKNOWLEDGED".equals(status) ? "Acknowledged an issue"
            : "Updated an issue";
    }
}
