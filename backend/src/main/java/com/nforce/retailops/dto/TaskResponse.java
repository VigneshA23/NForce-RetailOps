package com.nforce.retailops.dto;

import com.nforce.retailops.entity.CompletionType;
import com.nforce.retailops.entity.DayOfWeekCode;
import com.nforce.retailops.entity.ResponseType;
import com.nforce.retailops.entity.ScheduleType;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.Task;
import com.nforce.retailops.entity.TimeMode;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;

public record TaskResponse(
    Long id,
    String name,
    String description,
    Long categoryId,
    String categoryName,
    int displayOrder,
    boolean appliesToAllStores,
    List<StoreOptionResponse> stores,
    ResponseType responseType,
    String responseNote,
    String numericUnit,
    Double numericMin,
    Double numericMax,
    Integer textMaxLength,
    CompletionType completionType,
    Integer maxCompletions,
    ScheduleType scheduleType,
    List<DayOfWeekCode> selectedDays,
    LocalDate startDate,
    LocalDate endDate,
    TimeMode timeMode,
    LocalTime startTime,
    LocalTime endTime,
    boolean active,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
    public static TaskResponse from(Task task) {
        List<StoreOptionResponse> storeOptions = task.getStores().stream()
            .sorted(Comparator.comparing(Store::getName))
            .map(StoreOptionResponse::from)
            .toList();

        List<DayOfWeekCode> days = task.getSelectedDays().stream()
            .sorted()
            .toList();

        return new TaskResponse(
            task.getId(),
            task.getName(),
            task.getDescription(),
            task.getCategory().getId(),
            task.getCategory().getName(),
            task.getDisplayOrder(),
            task.isAppliesToAllStores(),
            storeOptions,
            task.getResponseType(),
            task.getResponseNote(),
            task.getNumericUnit(),
            task.getNumericMin(),
            task.getNumericMax(),
            task.getTextMaxLength(),
            task.getCompletionType(),
            task.getMaxCompletions(),
            task.getScheduleType(),
            days,
            task.getStartDate(),
            task.getEndDate(),
            task.getTimeMode(),
            task.getStartTime(),
            task.getEndTime(),
            task.isActive(),
            task.getCreatedAt(),
            task.getUpdatedAt()
        );
    }
}
