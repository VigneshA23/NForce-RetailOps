package com.nforce.retailops.service;

import com.nforce.retailops.dto.AdminCorrectionApplyResponse;
import com.nforce.retailops.dto.AdminCorrectionEntry;
import com.nforce.retailops.dto.AdminCorrectionRequest;
import com.nforce.retailops.dto.HistoryResponseEntryResponse;
import com.nforce.retailops.entity.AdminCorrection;
import com.nforce.retailops.entity.ResponseType;
import com.nforce.retailops.entity.TaskResponseEntry;
import com.nforce.retailops.exception.InvalidTaskResponseException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.exception.TaskResponseNotFoundException;
import com.nforce.retailops.exception.UnauthorizedTaskResponseActionException;
import com.nforce.retailops.repository.AdminCorrectionRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.TaskResponseEntryRepository;
import com.nforce.retailops.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AdminCorrectionService {

    private final TaskResponseEntryRepository taskResponseEntryRepository;
    private final AdminCorrectionRepository adminCorrectionRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final UserRepository userRepository;

    public AdminCorrectionService(
        TaskResponseEntryRepository taskResponseEntryRepository,
        AdminCorrectionRepository adminCorrectionRepository,
        StoreOwnerRepository storeOwnerRepository,
        UserRepository userRepository
    ) {
        this.taskResponseEntryRepository = taskResponseEntryRepository;
        this.adminCorrectionRepository = adminCorrectionRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public AdminCorrectionApplyResponse correctResponse(
        Long responseId, Long adminUserId, AdminCorrectionRequest request
    ) {
        TaskResponseEntry entry = taskResponseEntryRepository.findById(responseId)
            .filter(TaskResponseEntry::isActive)
            .orElseThrow(() -> new TaskResponseNotFoundException("Response not found"));

        // Enforce: admin can only correct responses from their own store.
        storeOwnerRepository.findByStoreIdAndOwnerId(entry.getStore().getId(), adminUserId)
            .orElseThrow(() -> new UnauthorizedTaskResponseActionException(
                "You can only correct responses belonging to your own store"));

        AdminCorrection correction = new AdminCorrection();
        correction.setTaskResponse(entry);
        correction.setCorrectedBy(userRepository.getReferenceById(adminUserId));
        if (request.reason() != null && !request.reason().isBlank()) {
            String trimmed = request.reason().trim();
            if (trimmed.length() > 200) {
                throw new InvalidTaskResponseException("Reason must be 200 characters or fewer");
            }
            correction.setReason(trimmed);
        }

        // Capture original values before overwriting.
        correction.setOriginalValueBoolean(entry.getValueBoolean());
        correction.setOriginalValueNumeric(entry.getValueNumeric());
        correction.setOriginalValueText(entry.getValueText());

        // Validate and apply corrected value, using the same response-type rules as
        // the original submission (applyValue in TaskService).
        switch (entry.getResponseType()) {
            case YES_NO, DONE_NOT_DONE -> {
                if (request.correctedBooleanValue() == null) {
                    throw new InvalidTaskResponseException("A Yes/No response is required");
                }
                correction.setCorrectedValueBoolean(request.correctedBooleanValue());
                entry.setValueBoolean(request.correctedBooleanValue());
                entry.setValueNumeric(null);
                entry.setValueText(null);
            }
            case NUMERIC -> {
                if (request.correctedNumericValue() == null) {
                    throw new InvalidTaskResponseException("A numeric response is required");
                }
                Double min = entry.getTask().getNumericMin();
                Double max = entry.getTask().getNumericMax();
                if (min != null && request.correctedNumericValue() < min) {
                    throw new InvalidTaskResponseException("Value must be at least " + min);
                }
                if (max != null && request.correctedNumericValue() > max) {
                    throw new InvalidTaskResponseException("Value must be at most " + max);
                }
                correction.setCorrectedValueNumeric(request.correctedNumericValue());
                entry.setValueNumeric(request.correctedNumericValue());
                entry.setValueBoolean(null);
                entry.setValueText(null);
            }
            case TEXT -> {
                if (request.correctedTextValue() == null) {
                    throw new InvalidTaskResponseException("A text response is required");
                }
                Integer maxLen = entry.getTask().getTextMaxLength();
                if (maxLen != null && request.correctedTextValue().length() > maxLen) {
                    throw new InvalidTaskResponseException("Text must be " + maxLen + " characters or fewer");
                }
                correction.setCorrectedValueText(request.correctedTextValue());
                entry.setValueText(request.correctedTextValue());
                entry.setValueBoolean(null);
                entry.setValueNumeric(null);
            }
        }

        taskResponseEntryRepository.save(entry);
        AdminCorrection saved = adminCorrectionRepository.save(correction);

        AdminCorrectionEntry correctionDto = ChecklistHistoryService.toCorrectionEntry(saved);
        HistoryResponseEntryResponse updatedResponse = new HistoryResponseEntryResponse(
            entry.getId(),
            entry.getEmployee().getId(),
            entry.getEmployee().getFullName(),
            null, // empId not critical in correction response; admin already knows the employee
            entry.getValueBoolean(),
            entry.getValueNumeric(),
            entry.getValueText(),
            entry.getCreatedAt(),
            correctionDto
        );

        return new AdminCorrectionApplyResponse(updatedResponse, correctionDto);
    }

    @Transactional(readOnly = true)
    public List<AdminCorrectionEntry> getCorrectionHistory(Long responseId, Long adminUserId) {
        TaskResponseEntry entry = taskResponseEntryRepository.findById(responseId)
            .orElseThrow(() -> new TaskResponseNotFoundException("Response not found"));

        storeOwnerRepository.findByStoreIdAndOwnerId(entry.getStore().getId(), adminUserId)
            .orElseThrow(() -> new UnauthorizedTaskResponseActionException(
                "You can only view corrections for responses belonging to your own store"));

        return adminCorrectionRepository
            .findByTaskResponseIdOrderByCorrectedAtDesc(responseId)
            .stream()
            .map(ChecklistHistoryService::toCorrectionEntry)
            .toList();
    }
}
