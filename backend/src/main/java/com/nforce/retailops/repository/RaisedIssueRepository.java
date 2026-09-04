package com.nforce.retailops.repository;

import com.nforce.retailops.entity.IssueStatus;
import com.nforce.retailops.entity.RaisedIssue;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface RaisedIssueRepository extends JpaRepository<RaisedIssue, Long> {

    List<RaisedIssue> findByStoreIdAndEmployeeIdAndRaisedDateOrderByCreatedAtDesc(Long storeId, Long employeeUserId, LocalDate raisedDate);

    List<RaisedIssue> findByStoreIdOrderByCreatedAtDesc(Long storeId);

    List<RaisedIssue> findByStoreIdAndStatusOrderByCreatedAtDesc(Long storeId, IssueStatus status);

    Optional<RaisedIssue> findByIdAndStoreId(Long id, Long storeId);
}
