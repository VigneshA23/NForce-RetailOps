package com.nforce.retailops.repository;

import com.nforce.retailops.entity.TaskResponseEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TaskResponseEntryRepository extends JpaRepository<TaskResponseEntry, Long> {

    List<TaskResponseEntry> findByTaskIdAndStoreIdAndResponseDateAndActiveTrue(
        Long taskId, Long storeId, LocalDate responseDate
    );

    // Batched form of the above, for building an entire day's checklist without one
    // query per task.
    List<TaskResponseEntry> findByTaskIdInAndStoreIdAndResponseDateAndActiveTrue(
        Collection<Long> taskIds, Long storeId, LocalDate responseDate
    );

    Optional<TaskResponseEntry> findByIdAndTaskIdAndStoreId(Long id, Long taskId, Long storeId);
}
