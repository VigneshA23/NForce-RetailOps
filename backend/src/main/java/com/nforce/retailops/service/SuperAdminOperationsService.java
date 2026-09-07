package com.nforce.retailops.service;

import com.nforce.retailops.dto.PlatformStatsResponse;
import com.nforce.retailops.dto.StoreOperationsSummaryResponse;
import com.nforce.retailops.dto.TrendDataPoint;
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
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
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

    @Transactional(readOnly = true)
    public List<TrendDataPoint> getPlatformTrend(int days) {
        int cappedDays = Math.min(Math.max(days, 1), 90);
        LocalDate today = LocalDate.now();
        LocalDate startDate = today.minusDays(cappedDays - 1);

        List<StoreOwner> activeLinks = storeOwnerRepository.findAllWithStoreAndOwner().stream()
            .filter(so -> so.isActive() && so.getOwner() != null)
            .toList();

        if (activeLinks.isEmpty()) {
            return buildEmptyTrend(startDate, today);
        }
        return computeTrend(activeLinks, startDate, today);
    }

    @Transactional(readOnly = true)
    public List<TrendDataPoint> getStoreTrend(long storeId, int days) {
        int cappedDays = Math.min(Math.max(days, 1), 90);
        LocalDate today = LocalDate.now();
        LocalDate startDate = today.minusDays(cappedDays - 1);

        List<StoreOwner> links = storeOwnerRepository.findAllWithStoreAndOwner().stream()
            .filter(so -> so.getStore().getId() == storeId && so.getOwner() != null)
            .toList();

        if (links.isEmpty()) {
            return buildEmptyTrend(startDate, today);
        }
        return computeTrend(links, startDate, today);
    }

    private List<TrendDataPoint> computeTrend(List<StoreOwner> links, LocalDate startDate, LocalDate today) {
        // Per-store task lists, one query per unique store
        Map<Long, List<Task>> tasksByStore = new HashMap<>();
        for (StoreOwner link : links) {
            Long sid = link.getStore().getId();
            if (!tasksByStore.containsKey(sid)) {
                tasksByStore.put(sid,
                    taskRepository.findActiveForStoresAndDateRange(
                        link.getOwner().getId(), List.of(sid), startDate, today
                    )
                );
            }
        }

        // One round-trip for all response tuples (date, storeId, taskId)
        List<Long> allStoreIds = links.stream().map(so -> so.getStore().getId()).distinct().toList();
        List<Object[]> tuples = taskResponseEntryRepository.findDateStoreTaskIdTuples(allStoreIds, startDate, today);

        // Group: Map<date, Map<storeId, Set<taskId>>>
        Map<LocalDate, Map<Long, Set<Long>>> respondedByDateAndStore = new HashMap<>();
        for (Object[] row : tuples) {
            LocalDate date = (LocalDate) row[0];
            Long sid = (Long) row[1];
            Long tid = (Long) row[2];
            respondedByDateAndStore
                .computeIfAbsent(date, k -> new HashMap<>())
                .computeIfAbsent(sid, k -> new HashSet<>())
                .add(tid);
        }

        List<TrendDataPoint> points = new ArrayList<>();
        for (LocalDate d = startDate; !d.isAfter(today); d = d.plusDays(1)) {
            int totalUnion = 0;
            int totalCompleted = 0;
            final LocalDate date = d;

            for (StoreOwner link : links) {
                Long sid = link.getStore().getId();
                List<Task> storeTasks = tasksByStore.getOrDefault(sid, List.of());

                Set<Long> eligibleIds = storeTasks.stream()
                    .filter(t -> !t.getStartDate().isAfter(date)
                        && (t.getEndDate() == null || !t.getEndDate().isBefore(date))
                        && TaskScheduleMatcher.matches(t, date))
                    .map(Task::getId)
                    .collect(Collectors.toSet());

                Set<Long> respondedIds = respondedByDateAndStore
                    .getOrDefault(date, Map.of())
                    .getOrDefault(sid, Set.of());

                Set<Long> union = new HashSet<>(eligibleIds);
                union.addAll(respondedIds);

                totalUnion += union.size();
                totalCompleted += respondedIds.size();
            }

            int percent = totalUnion == 0 ? 0 : Math.round((totalCompleted * 100f) / totalUnion);
            points.add(new TrendDataPoint(date.toString(), percent));
        }

        return points;
    }

    private List<TrendDataPoint> buildEmptyTrend(LocalDate startDate, LocalDate today) {
        List<TrendDataPoint> points = new ArrayList<>();
        for (LocalDate d = startDate; !d.isAfter(today); d = d.plusDays(1)) {
            points.add(new TrendDataPoint(d.toString(), 0));
        }
        return points;
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
