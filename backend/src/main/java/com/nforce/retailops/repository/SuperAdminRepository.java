package com.nforce.retailops.repository;

import com.nforce.retailops.entity.SuperAdmin;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface SuperAdminRepository extends JpaRepository<SuperAdmin, Long> {

    @Query("select s from SuperAdmin s where lower(s.email) = lower(:email)")
    Optional<SuperAdmin> findByEmailIgnoreCase(@Param("email") String email);
}
