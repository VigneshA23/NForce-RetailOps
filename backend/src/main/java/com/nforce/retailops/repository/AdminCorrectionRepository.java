package com.nforce.retailops.repository;

import com.nforce.retailops.entity.AdminCorrection;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public interface AdminCorrectionRepository extends JpaRepository<AdminCorrection, Long> {

    List<AdminCorrection> findByTaskResponseIdOrderByCorrectedAtDesc(Long taskResponseId);

    List<AdminCorrection> findByTaskResponseIdIn(Iterable<Long> taskResponseIds);

    default Map<Long, AdminCorrection> findLatestByResponseIds(Iterable<Long> responseIds) {
        return findByTaskResponseIdIn(responseIds).stream()
            .collect(Collectors.toMap(
                c -> c.getTaskResponse().getId(),
                c -> c,
                (a, b) -> a.getCorrectedAt().isAfter(b.getCorrectedAt()) ? a : b
            ));
    }
}
