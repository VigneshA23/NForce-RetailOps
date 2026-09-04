package com.nforce.retailops.service;

import com.nforce.retailops.dto.IssueResponse;
import com.nforce.retailops.dto.RaiseIssueRequest;
import com.nforce.retailops.dto.RespondIssueRequest;
import com.nforce.retailops.entity.IssueStatus;
import com.nforce.retailops.entity.RaisedIssue;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.exception.IssueNotFoundException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.RaisedIssueRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * The "Raise with Owner" feature end-to-end: an employee raises a free-text
 * issue for one of their assigned stores, and that store's owner can respond
 * to it -- which also notifies the employee (see NotificationService).
 */
@Service
public class IssueService {

    private final RaisedIssueRepository raisedIssueRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final UserRepository userRepository;
    private final UserProfileService userProfileService;
    private final NotificationService notificationService;

    public IssueService(
        RaisedIssueRepository raisedIssueRepository,
        StoreOwnerRepository storeOwnerRepository,
        UserRepository userRepository,
        UserProfileService userProfileService,
        NotificationService notificationService
    ) {
        this.raisedIssueRepository = raisedIssueRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.userRepository = userRepository;
        this.userProfileService = userProfileService;
        this.notificationService = notificationService;
    }

    // Employee-facing: requireAssignedStore enforces the store belongs to this
    // employee, the same masked-as-"not found" pattern every other /me/**
    // store-scoped endpoint uses.
    @Transactional
    public IssueResponse raiseIssue(Long employeeUserId, RaiseIssueRequest request) {
        userProfileService.requireAssignedStore(employeeUserId, request.storeId());

        RaisedIssue issue = new RaisedIssue();
        issue.setStore(storeOwnerRepository.findByStoreId(request.storeId())
            .map(StoreOwner::getStore)
            .orElseThrow(() -> new StoreNotFoundException("Store not found")));
        issue.setEmployee(userRepository.getReferenceById(employeeUserId));
        issue.setNote(request.note().trim());
        issue.setStatus(IssueStatus.OPEN);

        return IssueResponse.from(raisedIssueRepository.save(issue));
    }

    // Owner-facing: storeOwnerRepository.findByStoreIdAndOwnerId enforces the
    // store belongs to this owner, matching StoreService/EmployeeService's
    // existing ownership-check pattern.
    @Transactional(readOnly = true)
    public List<IssueResponse> listForStore(Long ownerId, Long storeId, IssueStatus statusFilter) {
        requireOwnedStore(ownerId, storeId);

        List<RaisedIssue> issues = statusFilter != null
            ? raisedIssueRepository.findByStoreIdAndStatusOrderByCreatedAtDesc(storeId, statusFilter)
            : raisedIssueRepository.findByStoreIdOrderByCreatedAtDesc(storeId);

        return issues.stream().map(IssueResponse::from).toList();
    }

    @Transactional
    public IssueResponse respondToIssue(Long ownerId, Long storeId, Long issueId, RespondIssueRequest request) {
        requireOwnedStore(ownerId, storeId);

        RaisedIssue issue = raisedIssueRepository.findByIdAndStoreId(issueId, storeId)
            .orElseThrow(() -> new IssueNotFoundException("Issue not found"));

        issue.setResponseText(request.responseText().trim());
        issue.setStatus(IssueStatus.RESOLVED);
        issue.setRespondedBy(userRepository.getReferenceById(ownerId));
        issue.setRespondedAt(OffsetDateTime.now());
        issue = raisedIssueRepository.save(issue);

        notificationService.notifyIssueResponse(issue);

        return IssueResponse.from(issue);
    }

    private void requireOwnedStore(Long ownerId, Long storeId) {
        storeOwnerRepository.findByStoreIdAndOwnerId(storeId, ownerId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
    }
}
