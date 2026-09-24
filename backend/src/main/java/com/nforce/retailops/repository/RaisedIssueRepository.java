package com.nforce.retailops.repository;

import com.nforce.retailops.entity.RaisedIssue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface RaisedIssueRepository extends JpaRepository<RaisedIssue, Long> {

    @Query("SELECT r FROM RaisedIssue r JOIN FETCH r.employeeUser JOIN FETCH r.store WHERE r.id = :id")
    Optional<RaisedIssue> findByIdWithEmployee(@Param("id") Long id);

    @Query("SELECT r FROM RaisedIssue r JOIN FETCH r.employeeUser LEFT JOIN FETCH r.respondedByUser LEFT JOIN FETCH r.respondedBySuperAdmin WHERE r.store.id = :storeId ORDER BY r.createdAt DESC")
    List<RaisedIssue> findByStoreIdOrderByCreatedAtDesc(@Param("storeId") Long storeId);

    @Query("SELECT r FROM RaisedIssue r JOIN FETCH r.employeeUser LEFT JOIN FETCH r.respondedByUser LEFT JOIN FETCH r.respondedBySuperAdmin WHERE r.store.id = :storeId AND r.status = :status ORDER BY r.createdAt DESC")
    List<RaisedIssue> findByStoreIdAndStatusOrderByCreatedAtDesc(@Param("storeId") Long storeId, @Param("status") String status);

    @Query("SELECT r FROM RaisedIssue r JOIN FETCH r.employeeUser LEFT JOIN FETCH r.respondedByUser LEFT JOIN FETCH r.respondedBySuperAdmin WHERE r.store.id = :storeId AND r.employeeUser.id = :employeeUserId ORDER BY r.createdAt DESC")
    List<RaisedIssue> findByStoreIdAndEmployeeUserIdOrderByCreatedAtDesc(@Param("storeId") Long storeId, @Param("employeeUserId") Long employeeUserId);

    @Query("SELECT r FROM RaisedIssue r JOIN FETCH r.employeeUser LEFT JOIN FETCH r.respondedByUser LEFT JOIN FETCH r.respondedBySuperAdmin WHERE r.store.id = :storeId AND r.employeeUser.id = :employeeUserId AND r.raisedDate = :raisedDate ORDER BY r.createdAt DESC")
    List<RaisedIssue> findByStoreIdAndEmployeeIdAndRaisedDateOrderByCreatedAtDesc(@Param("storeId") Long storeId, @Param("employeeUserId") Long employeeUserId, @Param("raisedDate") java.time.LocalDate raisedDate);

    // Store-wide (all employees) version of the above -- for the Owner/Admin
    // and Super Admin checklist history detail view, which shows every issue
    // raised that day, not just the calling employee's own.
    @Query("SELECT r FROM RaisedIssue r JOIN FETCH r.employeeUser LEFT JOIN FETCH r.respondedByUser LEFT JOIN FETCH r.respondedBySuperAdmin WHERE r.store.id = :storeId AND r.raisedDate = :raisedDate ORDER BY r.createdAt DESC")
    List<RaisedIssue> findByStoreIdAndRaisedDateOrderByCreatedAtDesc(@Param("storeId") Long storeId, @Param("raisedDate") java.time.LocalDate raisedDate);

    @Query("SELECT r FROM RaisedIssue r JOIN FETCH r.employeeUser JOIN FETCH r.store LEFT JOIN FETCH r.respondedByUser LEFT JOIN FETCH r.respondedBySuperAdmin ORDER BY r.createdAt DESC")
    List<RaisedIssue> findAllOrderByCreatedAtDesc();

    @Query("SELECT r FROM RaisedIssue r JOIN FETCH r.employeeUser JOIN FETCH r.store LEFT JOIN FETCH r.respondedByUser LEFT JOIN FETCH r.respondedBySuperAdmin WHERE r.status = :status ORDER BY r.createdAt DESC")
    List<RaisedIssue> findAllByStatusOrderByCreatedAtDesc(@Param("status") String status);

    long countByStoreIdAndStatus(Long storeId, String status);

    long countByStoreIdAndStatusAndCreatedAtBefore(Long storeId, String status, java.time.OffsetDateTime cutoff);

    long countByStoreIdAndStatusInAndCreatedAtBefore(Long storeId, java.util.Collection<String> statuses, java.time.OffsetDateTime cutoff);

    @Modifying
    @Query("DELETE FROM RaisedIssue r WHERE r.status = 'RESOLVED' AND r.respondedAt < :cutoff")
    int deleteResolvedBefore(@Param("cutoff") OffsetDateTime cutoff);
}
