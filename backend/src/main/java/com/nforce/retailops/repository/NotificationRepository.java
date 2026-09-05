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

    @Query("SELECT n FROM Notification n LEFT JOIN FETCH n.relatedIssue ri LEFT JOIN FETCH ri.store WHERE n.recipientUser.id = :userId ORDER BY n.createdAt DESC")
    List<Notification> findByRecipientUserIdOrderByCreatedAtDesc(@Param("userId") Long userId, Pageable pageable);

    long countByRecipientUserIdAndReadFalse(Long recipientUserId);

    Optional<Notification> findByIdAndRecipientUserId(Long id, Long recipientUserId);

    @Modifying
    @Query("UPDATE Notification n SET n.read = true WHERE n.recipientUser.id = :userId AND n.read = false")
    int markAllReadByRecipientUserId(@Param("userId") Long userId);
}
