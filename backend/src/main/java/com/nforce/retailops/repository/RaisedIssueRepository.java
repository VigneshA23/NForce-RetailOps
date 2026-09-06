package com.nforce.retailops.repository;

import com.nforce.retailops.entity.RaisedIssue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RaisedIssueRepository extends JpaRepository<RaisedIssue, Long> {

    @Query("SELECT r FROM RaisedIssue r JOIN FETCH r.employeeUser JOIN FETCH r.store WHERE r.id = :id")
    Optional<RaisedIssue> findByIdWithEmployee(@Param("id") Long id);

    @Query("SELECT r FROM RaisedIssue r JOIN FETCH r.employeeUser LEFT JOIN FETCH r.respondedByUser WHERE r.store.id = :storeId ORDER BY r.createdAt DESC")
    List<RaisedIssue> findByStoreIdOrderByCreatedAtDesc(@Param("storeId") Long storeId);

    @Query("SELECT r FROM RaisedIssue r JOIN FETCH r.employeeUser LEFT JOIN FETCH r.respondedByUser WHERE r.store.id = :storeId AND r.status = :status ORDER BY r.createdAt DESC")
    List<RaisedIssue> findByStoreIdAndStatusOrderByCreatedAtDesc(@Param("storeId") Long storeId, @Param("status") String status);

    @Query("SELECT r FROM RaisedIssue r JOIN FETCH r.employeeUser LEFT JOIN FETCH r.respondedByUser WHERE r.store.id = :storeId AND r.employeeUser.id = :employeeUserId ORDER BY r.createdAt DESC")
    List<RaisedIssue> findByStoreIdAndEmployeeUserIdOrderByCreatedAtDesc(@Param("storeId") Long storeId, @Param("employeeUserId") Long employeeUserId);

    long countByStoreIdAndStatus(Long storeId, String status);

    long countByStoreIdAndStatusAndCreatedAtBefore(Long storeId, String status, java.time.OffsetDateTime cutoff);
}
