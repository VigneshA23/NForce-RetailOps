package com.nforce.retailops.service;

import com.nforce.retailops.dto.IssueResponse;
import com.nforce.retailops.dto.RaiseIssueRequest;
import com.nforce.retailops.dto.UpdateIssueStatusRequest;
import com.nforce.retailops.entity.RaisedIssue;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.IssueNotFoundException;
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

@Service
public class RaisedIssueService {

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
        storeOwnerRepository.findByStoreIdAndActiveTrue(request.storeId())
            .map(storeOwner -> storeOwner.getOwner())
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
        storeOwnerRepository.findByStoreIdAndOwnerId(storeId, ownerId)
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

        storeOwnerRepository.findByStoreIdAndOwnerId(issue.getStore().getId(), ownerId)
            .orElseThrow(() -> new AccessDeniedException("You do not own this store"));

        issue.setStatus(request.status());
        if (request.responseText() != null && !request.responseText().isBlank()) {
            issue.setResponseText(request.responseText().trim());
        }
        if ("RESOLVED".equals(request.status())) {
            User admin = userRepository.findById(ownerId)
                .orElseThrow(() -> new StoreNotFoundException("User not found"));
            issue.setRespondedByUser(admin);
            issue.setRespondedAt(OffsetDateTime.now());
        }

        RaisedIssue saved = raisedIssueRepository.save(issue);
        notificationService.createForIssueUpdate(saved, request.status());

        // Best-effort name lookup for the log entry only -- a missing user record
        // must never abort the status update itself, so this never throws.
        String ownerName = userRepository.findById(ownerId).map(User::getFullName).orElse("Admin");
        activityLogService.log(
            issueStatusActionType(request.status()), ownerName, "OWNER_ADMIN",
            issue.getStore().getId(), issue.getStore().getName(), "ISSUE", null,
            issueStatusDescription(request.status())
        );

        return IssueResponse.from(saved);
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

    @Transactional(readOnly = true)
    public List<IssueResponse> listAllForSuperAdmin(String status) {
        List<RaisedIssue> issues = (status != null && !status.isBlank())
            ? raisedIssueRepository.findAllByStatusOrderByCreatedAtDesc(status)
            : raisedIssueRepository.findAllOrderByCreatedAtDesc();
        return issues.stream().map(IssueResponse::from).toList();
    }

    @Transactional
    public IssueResponse updateStatusForSuperAdmin(Long issueId, UpdateIssueStatusRequest request) {
        RaisedIssue issue = raisedIssueRepository.findByIdWithEmployee(issueId)
            .orElseThrow(() -> new IssueNotFoundException("Issue not found"));

        issue.setStatus(request.status());
        if (request.responseText() != null && !request.responseText().isBlank()) {
            issue.setResponseText(request.responseText().trim());
        }
        if ("RESOLVED".equals(request.status()) || "ACKNOWLEDGED".equals(request.status())) {
            issue.setRespondedAt(OffsetDateTime.now());
        }

        RaisedIssue saved = raisedIssueRepository.save(issue);
        notificationService.createForIssueUpdate(saved, request.status());

        activityLogService.log(
            issueStatusActionType(request.status()), "Super Admin", "SUPER_ADMIN",
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
            throw new IllegalStateException("Issue is already resolved");
        }

        storeOwnerRepository.findByStoreIdAndActiveTrue(issue.getStore().getId())
            .map(so -> so.getOwner())
            .ifPresent(owner -> notificationService.nudgeOwnerForIssue(issue, owner));
    }

    @Scheduled(cron = "0 0 3 * * *")
    @Transactional
    public void purgeOldResolvedIssues() {
        OffsetDateTime cutoff = OffsetDateTime.now().minusDays(7);
        raisedIssueRepository.deleteResolvedBefore(cutoff);
    }
}
