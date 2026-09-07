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
    @JoinColumn(name = "corrected_by_user_id", nullable = true)
    private User correctedBy;

    // Set when correctedBy is null (Super Admin, who has no row in the users table).
    @Column(name = "corrected_by_name", columnDefinition = "TEXT")
    private String correctedByName;

    @Column(name = "corrected_at", nullable = false)
    private OffsetDateTime correctedAt;

    @Column(name = "reason", length = 200)
    private String reason;

    // 'DIRECT' = admin edited the value; 'FLAG_TO_EMPLOYEE' = flagged back for employee to re-answer.
    @Column(name = "correction_type", nullable = false, length = 30)
    private String correctionType = "DIRECT";

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

    public String getCorrectedByName() { return correctedByName; }
    public void setCorrectedByName(String correctedByName) { this.correctedByName = correctedByName; }

    public OffsetDateTime getCorrectedAt() { return correctedAt; }
    public void setCorrectedAt(OffsetDateTime correctedAt) { this.correctedAt = correctedAt; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public String getCorrectionType() { return correctionType; }
    public void setCorrectionType(String correctionType) { this.correctionType = correctionType; }
}
