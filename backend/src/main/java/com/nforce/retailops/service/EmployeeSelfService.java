package com.nforce.retailops.service;

import com.nforce.retailops.dto.EmployeeChecklistCategoryResponse;
import com.nforce.retailops.dto.EmployeeStoreResponse;
import com.nforce.retailops.dto.EmployeeTaskItemResponse;
import com.nforce.retailops.entity.Category;
import com.nforce.retailops.entity.DayOfWeekCode;
import com.nforce.retailops.entity.ScheduleType;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreEmployee;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.Task;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Read-only, employee-scoped view onto stores and tasks. Deliberately
 * separate from the Owner/Admin-only StoreService/TaskService — this never
 * exposes another owner's data and never lets an employee act outside the
 * store(s) they're actually assigned to.
 */
@Service
public class EmployeeSelfService {

    private final StoreEmployeeRepository storeEmployeeRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final TaskRepository taskRepository;

    public EmployeeSelfService(
        StoreEmployeeRepository storeEmployeeRepository,
        StoreOwnerRepository storeOwnerRepository,
        TaskRepository taskRepository
    ) {
        this.storeEmployeeRepository = storeEmployeeRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.taskRepository = taskRepository;
    }

    @Transactional(readOnly = true)
    public List<EmployeeStoreResponse> listMyStores(Long employeeUserId) {
        return storeEmployeeRepository.findByEmployeeId(employeeUserId)
            .map(StoreEmployee::getStores)
            .orElse(Set.of())
            .stream()
            .filter(Store::isActive)
            .sorted(Comparator.comparing(Store::getName))
            .map(EmployeeStoreResponse::from)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<EmployeeChecklistCategoryResponse> getChecklist(Long employeeUserId, Long storeId) {
        StoreEmployee storeEmployee = storeEmployeeRepository.findByEmployeeId(employeeUserId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));

        boolean hasAccess = storeEmployee.getStores().stream()
            .anyMatch(store -> store.getId().equals(storeId));
        if (!hasAccess) {
            throw new StoreNotFoundException("Store not found");
        }

        StoreOwner storeOwner = storeOwnerRepository.findByStoreId(storeId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));

        LocalDate today = LocalDate.now();
        DayOfWeek todayOfWeek = today.getDayOfWeek();

        List<Task> eligibleTasks = taskRepository
            .findEligibleForEmployeeStore(storeOwner.getOwner().getId(), storeId, today)
            .stream()
            .filter(task -> isDueToday(task, todayOfWeek))
            .toList();

        Map<Category, List<EmployeeTaskItemResponse>> byCategory = new LinkedHashMap<>();
        for (Task task : eligibleTasks) {
            byCategory
                .computeIfAbsent(task.getCategory(), key -> new ArrayList<>())
                .add(new EmployeeTaskItemResponse(task.getId(), task.getName(), task.getDescription()));
        }

        return byCategory.entrySet().stream()
            .map(entry -> new EmployeeChecklistCategoryResponse(
                entry.getKey().getId(),
                entry.getKey().getName(),
                entry.getValue()
            ))
            .toList();
    }

    private static boolean isDueToday(Task task, DayOfWeek today) {
        ScheduleType scheduleType = task.getScheduleType();
        return switch (scheduleType) {
            case EVERY_DAY -> true;
            case WEEKDAYS -> today != DayOfWeek.SATURDAY && today != DayOfWeek.SUNDAY;
            case WEEKENDS -> today == DayOfWeek.SATURDAY || today == DayOfWeek.SUNDAY;
            case SELECTED_DAYS -> task.getSelectedDays().contains(toDayCode(today));
        };
    }

    private static DayOfWeekCode toDayCode(DayOfWeek dayOfWeek) {
        return DayOfWeekCode.valueOf(dayOfWeek.name().substring(0, 3));
    }
}
