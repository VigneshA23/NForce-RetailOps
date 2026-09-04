package com.nforce.retailops.repository;

import com.nforce.retailops.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findByRecipientIdOrderByCreatedAtDesc(Long recipientUserId);

    Optional<Notification> findByIdAndRecipientId(Long id, Long recipientUserId);

    @Modifying
    @Query("update Notification n set n.read = true where n.recipient.id = :recipientUserId and n.read = false")
    int markAllReadForRecipient(@Param("recipientUserId") Long recipientUserId);
}
