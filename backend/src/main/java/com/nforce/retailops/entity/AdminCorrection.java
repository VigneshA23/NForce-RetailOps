package com.nforce.retailops.entity;

import jakarta.persistence.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "admin_corrections")
public class AdminCorrection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_response_id", nullable = false)
    private TaskResponseEntry taskResponse;

    @Column(name = "original_value_boolean")
    private Boolean originalValueBoolean;

    @Column(name = "original_value_numeric")
    private Double originalValueNumeric;

    @Column(name = "original_value_text", columnDefinition = "TEXT")
    private String originalValueText;

    @Column(name = "corrected_value_boolean")
    private Boolean correctedValueBoolean;

    @Column(name = "corrected_value_numeric")
    private Double correctedValueNumeric;

    @Column(name = "corrected_value_text", columnDefinition = "TEXT")
    private String correctedValueText;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "corrected_by_user_id", nullable = false)
    private User correctedBy;

    @Column(name = "corrected_at", nullable = false)
    private OffsetDateTime correctedAt;

    @Column(name = "reason", length = 200)
    private String reason;

    public AdminCorrection() {
    }

    @PrePersist
    protected void onCreate() {
        if (correctedAt == null) {
            correctedAt = OffsetDateTime.now();
        }
    }

    public Long getId() { return id; }

    public TaskResponseEntry getTaskResponse() { return taskResponse; }
    public void setTaskResponse(TaskResponseEntry taskResponse) { this.taskResponse = taskResponse; }

    public Boolean getOriginalValueBoolean() { return originalValueBoolean; }
    public void setOriginalValueBoolean(Boolean originalValueBoolean) { this.originalValueBoolean = originalValueBoolean; }

    public Double getOriginalValueNumeric() { return originalValueNumeric; }
    public void setOriginalValueNumeric(Double originalValueNumeric) { this.originalValueNumeric = originalValueNumeric; }

    public String getOriginalValueText() { return originalValueText; }
    public void setOriginalValueText(String originalValueText) { this.originalValueText = originalValueText; }

    public Boolean getCorrectedValueBoolean() { return correctedValueBoolean; }
    public void setCorrectedValueBoolean(Boolean correctedValueBoolean) { this.correctedValueBoolean = correctedValueBoolean; }

    public Double getCorrectedValueNumeric() { return correctedValueNumeric; }
    public void setCorrectedValueNumeric(Double correctedValueNumeric) { this.correctedValueNumeric = correctedValueNumeric; }

    public String getCorrectedValueText() { return correctedValueText; }
    public void setCorrectedValueText(String correctedValueText) { this.correctedValueText = correctedValueText; }

    public User getCorrectedBy() { return correctedBy; }
    public void setCorrectedBy(User correctedBy) { this.correctedBy = correctedBy; }

    public OffsetDateTime getCorrectedAt() { return correctedAt; }
    public void setCorrectedAt(OffsetDateTime correctedAt) { this.correctedAt = correctedAt; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}
