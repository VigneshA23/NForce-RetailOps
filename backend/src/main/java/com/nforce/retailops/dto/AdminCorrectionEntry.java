package com.nforce.retailops.dto;

import java.time.OffsetDateTime;

public record AdminCorrectionEntry(
    Long id,
    Boolean originalValueBoolean,
    Double originalValueNumeric,
    String originalValueText,
    Boolean correctedValueBoolean,
    Double correctedValueNumeric,
    String correctedValueText,
    String correctedByFullName,
    OffsetDateTime correctedAt,
    String reason,
    // 'DIRECT' = admin edited value in place; 'FLAG_TO_EMPLOYEE' = sent back to employee for correction.
    String correctionType
) {
}
