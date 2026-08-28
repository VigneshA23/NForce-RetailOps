package com.nforce.retailops.entity;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "tasks")
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = false)
    private Category category;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "applies_to_all_stores", nullable = false)
    private boolean appliesToAllStores;

    @ManyToMany
    @JoinTable(
        name = "task_stores",
        joinColumns = @JoinColumn(name = "task_id"),
        inverseJoinColumns = @JoinColumn(name = "store_id")
    )
    private Set<Store> stores = new HashSet<>();

    @Enumerated(EnumType.STRING)
    @Column(name = "response_type", nullable = false, length = 20)
    private ResponseType responseType;

    @Column(name = "response_note", columnDefinition = "TEXT")
    private String responseNote;

    @Column(name = "numeric_unit", columnDefinition = "TEXT")
    private String numericUnit;

    @Column(name = "numeric_min")
    private Double numericMin;

    @Column(name = "numeric_max")
    private Double numericMax;

    @Column(name = "text_max_length")
    private Integer textMaxLength;

    @Enumerated(EnumType.STRING)
    @Column(name = "completion_type", nullable = false, length = 20)
    private CompletionType completionType;

    @Column(name = "max_completions")
    private Integer maxCompletions;

    @Enumerated(EnumType.STRING)
    @Column(name = "schedule_type", nullable = false, length = 20)
    private ScheduleType scheduleType;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "task_selected_days", joinColumns = @JoinColumn(name = "task_id"))
    @Column(name = "day_of_week", length = 10)
    @Enumerated(EnumType.STRING)
    private Set<DayOfWeekCode> selectedDays = new HashSet<>();

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "time_mode", nullable = false, length = 20)
    private TimeMode timeMode = TimeMode.ANYTIME;

    @Column(name = "start_time")
    private LocalTime startTime;

    @Column(name = "end_time")
    private LocalTime endTime;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public Task() {
    }

    @PrePersist
    protected void onCreate() {
        OffsetDateTime now = OffsetDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public User getOwner() {
        return owner;
    }

    public void setOwner(User owner) {
        this.owner = owner;
    }

    public Category getCategory() {
        return category;
    }

    public void setCategory(Category category) {
        this.category = category;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public boolean isAppliesToAllStores() {
        return appliesToAllStores;
    }

    public void setAppliesToAllStores(boolean appliesToAllStores) {
        this.appliesToAllStores = appliesToAllStores;
    }

    public Set<Store> getStores() {
        return stores;
    }

    public void setStores(Set<Store> stores) {
        this.stores = stores;
    }

    public ResponseType getResponseType() {
        return responseType;
    }

    public void setResponseType(ResponseType responseType) {
        this.responseType = responseType;
    }

    public String getResponseNote() {
        return responseNote;
    }

    public void setResponseNote(String responseNote) {
        this.responseNote = responseNote;
    }

    public String getNumericUnit() {
        return numericUnit;
    }

    public void setNumericUnit(String numericUnit) {
        this.numericUnit = numericUnit;
    }

    public Double getNumericMin() {
        return numericMin;
    }

    public void setNumericMin(Double numericMin) {
        this.numericMin = numericMin;
    }

    public Double getNumericMax() {
        return numericMax;
    }

    public void setNumericMax(Double numericMax) {
        this.numericMax = numericMax;
    }

    public Integer getTextMaxLength() {
        return textMaxLength;
    }

    public void setTextMaxLength(Integer textMaxLength) {
        this.textMaxLength = textMaxLength;
    }

    public CompletionType getCompletionType() {
        return completionType;
    }

    public void setCompletionType(CompletionType completionType) {
        this.completionType = completionType;
    }

    public Integer getMaxCompletions() {
        return maxCompletions;
    }

    public void setMaxCompletions(Integer maxCompletions) {
        this.maxCompletions = maxCompletions;
    }

    public ScheduleType getScheduleType() {
        return scheduleType;
    }

    public void setScheduleType(ScheduleType scheduleType) {
        this.scheduleType = scheduleType;
    }

    public Set<DayOfWeekCode> getSelectedDays() {
        return selectedDays;
    }

    public void setSelectedDays(Set<DayOfWeekCode> selectedDays) {
        this.selectedDays = selectedDays;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDate startDate) {
        this.startDate = startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public void setEndDate(LocalDate endDate) {
        this.endDate = endDate;
    }

    public TimeMode getTimeMode() {
        return timeMode;
    }

    public void setTimeMode(TimeMode timeMode) {
        this.timeMode = timeMode;
    }

    public LocalTime getStartTime() {
        return startTime;
    }

    public void setStartTime(LocalTime startTime) {
        this.startTime = startTime;
    }

    public LocalTime getEndTime() {
        return endTime;
    }

    public void setEndTime(LocalTime endTime) {
        this.endTime = endTime;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }
}
