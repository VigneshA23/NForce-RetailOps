package com.nforce.retailops.repository;

import com.nforce.retailops.entity.Notification;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    // User (owner / employee) notifications
    @Query("SELECT n FROM Notification n LEFT JOIN FETCH n.relatedIssue ri LEFT JOIN FETCH ri.store WHERE n.recipientUser.id = :userId ORDER BY n.createdAt DESC")
    List<Notification> findByRecipientUserIdOrderByCreatedAtDesc(@Param("userId") Long userId, Pageable pageable);

    long countByRecipientUserIdAndReadFalse(Long recipientUserId);

    Optional<Notification> findByIdAndRecipientUserId(Long id, Long recipientUserId);

    @Modifying
    @Query("UPDATE Notification n SET n.read = true WHERE n.recipientUser.id = :userId AND n.read = false")
    int markAllReadByRecipientUserId(@Param("userId") Long userId);

    // Super Admin notifications
    @Query("SELECT n FROM Notification n LEFT JOIN FETCH n.relatedIssue ri LEFT JOIN FETCH ri.store WHERE n.recipientSuperAdmin.id = :superAdminId ORDER BY n.createdAt DESC")
    List<Notification> findByRecipientSuperAdminIdOrderByCreatedAtDesc(@Param("superAdminId") Long superAdminId, Pageable pageable);

    long countByRecipientSuperAdminIdAndReadFalse(Long recipientSuperAdminId);

    Optional<Notification> findByIdAndRecipientSuperAdminId(Long id, Long recipientSuperAdminId);

    @Modifying
    @Query("UPDATE Notification n SET n.read = true WHERE n.recipientSuperAdmin.id = :superAdminId AND n.read = false")
    int markAllReadByRecipientSuperAdminId(@Param("superAdminId") Long superAdminId);

    // Dedup: prevent duplicate scheduled-job notifications for the same store+day
    boolean existsByRecipientSuperAdminIdAndDedupKey(Long recipientSuperAdminId, String dedupKey);
}
