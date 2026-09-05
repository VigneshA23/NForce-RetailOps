package com.nforce.retailops.repository;

import com.nforce.retailops.entity.RaisedIssue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface RaisedIssueRepository extends JpaRepository<RaisedIssue, Long> {

    @Query("SELECT r FROM RaisedIssue r JOIN FETCH r.employeeUser LEFT JOIN FETCH r.respondedByUser WHERE r.store.id = :storeId ORDER BY r.createdAt DESC")
    List<RaisedIssue> findByStoreIdOrderByCreatedAtDesc(@Param("storeId") Long storeId);
}
