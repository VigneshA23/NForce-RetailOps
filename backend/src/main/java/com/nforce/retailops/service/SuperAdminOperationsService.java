package com.nforce.retailops.service;

import com.nforce.retailops.dto.PlatformStatsResponse;
import com.nforce.retailops.dto.StoreOperationsSummaryResponse;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.Task;
import com.nforce.retailops.entity.TaskResponseEntry;
import com.nforce.retailops.repository.RaisedIssueRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.TaskRepository;
import com.nforce.retailops.repository.TaskResponseEntryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class SuperAdminOperationsService {

    private final StoreOwnerRepository storeOwnerRepository;
    private final TaskRepository taskRepository;
    private final TaskResponseEntryRepository taskResponseEntryRepository;
    private final RaisedIssueRepository raisedIssueRepository;

    public SuperAdminOperationsService(
        StoreOwnerRepository storeOwnerRepository,
        TaskRepository taskRepository,
        TaskResponseEntryRepository taskResponseEntryRepository,
        RaisedIssueRepository raisedIssueRepository
    ) {
        this.storeOwnerRepository = storeOwnerRepository;
        this.taskRepository = taskRepository;
        this.taskResponseEntryRepository = taskResponseEntryRepository;
        this.raisedIssueRepository = raisedIssueRepository;
    }

    @Transactional(readOnly = true)
    public List<StoreOperationsSummaryResponse> getOperationsOverview(LocalDate date) {
        List<StoreOwner> activeLinks = storeOwnerRepository.findAllWithStoreAndOwner().stream()
            .filter(so -> so.isActive() && so.getOwner() != null)
            .toList();

        return activeLinks.stream()
            .map(link -> buildStoreSummary(link, date))
            .sorted(Comparator.comparingInt(StoreOperationsSummaryResponse::completionPercent))
            .toList();
    }

    @Transactional(readOnly = true)
    public PlatformStatsResponse getPlatformStats(LocalDate date) {
        List<StoreOwner> activeLinks = storeOwnerRepository.findAllWithStoreAndOwner().stream()
            .filter(so -> so.isActive() && so.getOwner() != null)
            .toList();

        int totalStores = activeLinks.size();
        int totalTasks = 0;
        int completedTasks = 0;
        long totalOpenIssues = 0;
        int storesWithActivity = 0;

        for (StoreOwner link : activeLinks) {
            long storeId = link.getStore().getId();
            long ownerId = link.getOwner().getId();

            List<Task> eligible = taskRepository.findActiveForStoreAndDate(ownerId, storeId, date).stream()
                .filter(t -> TaskScheduleMatcher.matches(t, date))
                .toList();

            List<TaskResponseEntry> responses = taskResponseEntryRepository
                .findByStoreIdAndResponseDateAndActiveTrue(storeId, date);

            Set<Long> respondedIds = responses.stream()
                .map(r -> r.getTask().getId())
                .collect(Collectors.toSet());

            Set<Long> unionIds = eligible.stream().map(Task::getId).collect(Collectors.toSet());
            unionIds.addAll(respondedIds);

            totalTasks += unionIds.size();
            completedTasks += respondedIds.size();

            if (!responses.isEmpty()) storesWithActivity++;

            totalOpenIssues += raisedIssueRepository.countByStoreIdAndStatus(storeId, "OPEN");
        }

        int platformPercent = totalTasks == 0 ? 0 : Math.round((completedTasks * 100f) / totalTasks);
        return new PlatformStatsResponse(platformPercent, totalOpenIssues, totalStores, storesWithActivity);
    }

    private StoreOperationsSummaryResponse buildStoreSummary(StoreOwner link, LocalDate date) {
        long storeId = link.getStore().getId();
        long ownerId = link.getOwner().getId();

        List<Task> eligible = taskRepository.findActiveForStoreAndDate(ownerId, storeId, date).stream()
            .filter(t -> TaskScheduleMatcher.matches(t, date))
            .toList();

        List<TaskResponseEntry> responses = taskResponseEntryRepository
            .findByStoreIdAndResponseDateAndActiveTrue(storeId, date);

        Set<Long> respondedIds = responses.stream()
            .map(r -> r.getTask().getId())
            .collect(Collectors.toSet());

        Set<Long> unionIds = eligible.stream().map(Task::getId).collect(Collectors.toSet());
        unionIds.addAll(respondedIds);

        int total = unionIds.size();
        int completed = respondedIds.size();
        int percent = total == 0 ? 0 : Math.round((completed * 100f) / total);

        long openIssues = raisedIssueRepository.countByStoreIdAndStatus(storeId, "OPEN");

        OffsetDateTime lastActivity = responses.isEmpty()
            ? null
            : taskResponseEntryRepository.findMaxCreatedAtByStoreIdAndResponseDate(storeId, date);

        return new StoreOperationsSummaryResponse(
            storeId,
            link.getStore().getName(),
            link.getOwner().getFullName(),
            total,
            completed,
            percent,
            openIssues,
            lastActivity
        );
    }
}
