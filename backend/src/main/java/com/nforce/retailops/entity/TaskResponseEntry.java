package com.nforce.retailops.entity;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * A single employee's answer to a Task for one store on one scheduled day.
 * Undo never deletes this row -- it is marked inactive (active=false, undoneAt set)
 * so the record/history is preserved, per the SINGLE-completion Undo requirement.
 */
@Entity
@Table(name = "task_responses")
public class TaskResponseEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id", nullable = false)
    private Task task;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_user_id", nullable = false)
    private User employee;

    @Column(name = "response_date", nullable = false)
    private LocalDate responseDate;

    // Denormalized copy of the task's response type at submission time, so a later
    // admin edit to the task's configuration can't reinterpret an already-stored answer.
    @Enumerated(EnumType.STRING)
    @Column(name = "response_type", nullable = false, length = 20)
    private ResponseType responseType;

    // Denormalized copy of the task's completion type at submission time. Backs the
    // partial unique index (V19) that enforces "first active response wins" for SINGLE
    // tasks at the database level -- a partial index's WHERE clause can't reach across
    // a join to tasks.completion_type, so it has to live on this row too.
    @Enumerated(EnumType.STRING)
    @Column(name = "completion_type", nullable = false, length = 20)
    private CompletionType completionType;

    @Column(name = "value_boolean")
    private Boolean valueBoolean;

    @Column(name = "value_numeric")
    private Double valueNumeric;

    @Column(name = "value_text", columnDefinition = "TEXT")
    private String valueText;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "undone_at")
    private OffsetDateTime undoneAt;

    // True only when this row was deactivated by the employee's own explicit Undo
    // action (TaskService.undoResponse) -- false when it was deactivated as a side
    // effect of a fresh resubmission superseding it (TaskService.submitResponse's
    // auto-supersede paths leave this false), so history can tell "the employee
    // undid this and stopped" apart from "this was immediately replaced."
    @Column(name = "undone_by_user", nullable = false)
    private boolean undoneByUser = false;

    @Column(name = "flagged_needs_correction", nullable = false)
    private boolean flaggedNeedsCorrection = false;

    @Column(name = "flag_reason", length = 500)
    private String flagReason;

    // Id of the flagged response this row replaced on resubmission, or null for a
    // response that has never been through a flag -> resubmit cycle. Plain id
    // (not a @ManyToOne) since it's only ever walked by id lookups in
    // ChecklistHistoryService.buildResubmissionHistory, never joined/fetched eagerly.
    @Column(name = "superseded_response_id")
    private Long supersededResponseId;

    // How this row came to exist -- NORMAL (default) for a same-day submission,
    // MAKEUP_NOW/LINK_FULFILLED for the "Missed Tasks" feature (see CompletedVia).
    // LINK_FULFILLED rows are permanent: TaskService.undoResponse and
    // AdminCorrectionService both reject acting on them.
    @Enumerated(EnumType.STRING)
    @Column(name = "completed_via", nullable = false, length = 20)
    private CompletedVia completedVia = CompletedVia.NORMAL;

    public TaskResponseEntry() {
    }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
    }

    public Long getId() {
        return id;
    }

    public Task getTask() {
        return task;
    }

    public void setTask(Task task) {
        this.task = task;
    }

    public Store getStore() {
        return store;
    }

    public void setStore(Store store) {
        this.store = store;
    }

    public User getEmployee() {
        return employee;
    }

    public void setEmployee(User employee) {
        this.employee = employee;
    }

    public LocalDate getResponseDate() {
        return responseDate;
    }

    public void setResponseDate(LocalDate responseDate) {
        this.responseDate = responseDate;
    }

    public ResponseType getResponseType() {
        return responseType;
    }

    public void setResponseType(ResponseType responseType) {
        this.responseType = responseType;
    }

    public CompletionType getCompletionType() {
        return completionType;
    }

    public void setCompletionType(CompletionType completionType) {
        this.completionType = completionType;
    }

    public Boolean getValueBoolean() {
        return valueBoolean;
    }

    public void setValueBoolean(Boolean valueBoolean) {
        this.valueBoolean = valueBoolean;
    }

    public Double getValueNumeric() {
        return valueNumeric;
    }

    public void setValueNumeric(Double valueNumeric) {
        this.valueNumeric = valueNumeric;
    }

    public String getValueText() {
        return valueText;
    }

    public void setValueText(String valueText) {
        this.valueText = valueText;
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

    public OffsetDateTime getUndoneAt() {
        return undoneAt;
    }

    public void setUndoneAt(OffsetDateTime undoneAt) {
        this.undoneAt = undoneAt;
    }

    public boolean isUndoneByUser() {
        return undoneByUser;
    }

    public void setUndoneByUser(boolean undoneByUser) {
        this.undoneByUser = undoneByUser;
    }

    public boolean isFlaggedNeedsCorrection() {
        return flaggedNeedsCorrection;
    }

    public void setFlaggedNeedsCorrection(boolean flaggedNeedsCorrection) {
        this.flaggedNeedsCorrection = flaggedNeedsCorrection;
    }

    public String getFlagReason() {
        return flagReason;
    }

    public void setFlagReason(String flagReason) {
        this.flagReason = flagReason;
    }

    public Long getSupersededResponseId() {
        return supersededResponseId;
    }

    public void setSupersededResponseId(Long supersededResponseId) {
        this.supersededResponseId = supersededResponseId;
    }

    public CompletedVia getCompletedVia() {
        return completedVia;
    }

    public void setCompletedVia(CompletedVia completedVia) {
        this.completedVia = completedVia;
    }
}
