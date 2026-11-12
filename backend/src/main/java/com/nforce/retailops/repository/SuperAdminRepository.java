package com.nforce.retailops.repository;

import com.nforce.retailops.entity.SuperAdmin;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SuperAdminRepository extends JpaRepository<SuperAdmin, Long> {

    @Query("select s from SuperAdmin s where lower(s.email) = lower(:email)")
    Optional<SuperAdmin> findByEmailIgnoreCase(@Param("email") String email);

    List<SuperAdmin> findAllByOrderByNameAscIdAsc();

    // Row-locks every active Super Admin for the rest of the transaction, so
    // two Super Admins deactivating each other at the same moment can't both
    // succeed and leave nobody active (SuperAdminAccountService).
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from SuperAdmin s where s.active = true")
    List<SuperAdmin> findAllActiveForUpdate();
}
