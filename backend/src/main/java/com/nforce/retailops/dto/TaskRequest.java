package com.nforce.retailops.dto;

import com.nforce.retailops.entity.CompletionType;
import com.nforce.retailops.entity.DayOfWeekCode;
import com.nforce.retailops.entity.ResponseType;
import com.nforce.retailops.entity.ScheduleType;
import com.nforce.retailops.entity.TimeMode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public record TaskRequest(
    @NotBlank(message = "Task name is required")
    @Size(max = 150, message = "Task name must be 150 characters or fewer")
    String name,

    @Size(max = 2000, message = "Description must be 2000 characters or fewer")
    String description,

    @NotNull(message = "Category is required")
    Long categoryId,

    // Null means "auto-assign to the end of this category's list" (mirrors Category's
    // own auto-increment behavior); a value lets the admin explicitly set/change order.
    @PositiveOrZero(message = "Display Order cannot be negative")
    Integer displayOrder,

    boolean appliesToAllStores,

    List<Long> storeIds,

    @NotNull(message = "Response type is required")
    ResponseType responseType,

    @Size(max = 25, message = "Short Text response must be 25 characters or fewer")
    String responseNote,

    String numericUnit,
    Double numericMin,
    Double numericMax,
    Integer textMaxLength,

    @NotNull(message = "Completion type is required")
    CompletionType completionType,

    Integer maxCompletions,

    @NotNull(message = "Schedule is required")
    ScheduleType scheduleType,

    List<DayOfWeekCode> selectedDays,

    @NotNull(message = "Start date is required")
    LocalDate startDate,

    LocalDate endDate,

    @NotNull(message = "Time configuration is required")
    TimeMode timeMode,

    LocalTime startTime,
    LocalTime endTime,

    boolean active
) {
}
