package com.nforce.retailops.service;

import com.nforce.retailops.dto.EmployeeSearchItem;
import com.nforce.retailops.dto.EmployeeSearchResponse;
import com.nforce.retailops.dto.IssueResponse;
import com.nforce.retailops.dto.TodayChecklistResponse;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.StoreNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class EmployeeSearchService {

    private final TaskService taskService;
    private final RaisedIssueService raisedIssueService;

    public EmployeeSearchService(TaskService taskService, RaisedIssueService raisedIssueService) {
        this.taskService = taskService;
        this.raisedIssueService = raisedIssueService;
    }

    public EmployeeSearchResponse search(User user, Long storeId, String q) {
        String lower = q.strip().toLowerCase();
        if (lower.isEmpty()) {
            return new EmployeeSearchResponse(List.of(), List.of());
        }

        // Search today's checklist tasks by name (scoped to this employee's store).
        // requireAssignedStore inside TaskService enforces store membership.
        List<EmployeeSearchItem> tasks;
        try {
            TodayChecklistResponse checklist =
                taskService.getTodayChecklistForEmployee(user.getId(), storeId);
            tasks = checklist.categories().stream()
                .flatMap(cat -> cat.tasks().stream()
                    .filter(t -> t.name().toLowerCase().contains(lower))
                    .map(t -> new EmployeeSearchItem(
                        t.id(),
                        t.name(),
                        cat.name(),
                        "today"
                    ))
                )
                .limit(5)
                .toList();
        } catch (StoreNotFoundException e) {
            tasks = List.of();
        }

        // Search raised issues by note or status.
        List<EmployeeSearchItem> issues;
        try {
            List<IssueResponse> allIssues =
                raisedIssueService.listForEmployee(user.getId(), storeId);
            issues = allIssues.stream()
                .filter(issue -> (issue.note() != null && issue.note().toLowerCase().contains(lower))
                    || issue.status().toLowerCase().contains(lower))
                .limit(5)
                .map(issue -> new EmployeeSearchItem(
                    issue.id(),
                    issue.note() != null && !issue.note().isBlank()
                        ? truncate(issue.note(), 50)
                        : "(no note)",
                    issue.status(),
                    "issues"
                ))
                .toList();
        } catch (StoreNotFoundException e) {
            issues = List.of();
        }

        return new EmployeeSearchResponse(tasks, issues);
    }

    private static String truncate(String s, int maxLen) {
        return s.length() <= maxLen ? s : s.substring(0, maxLen - 1) + "…";
    }
}
