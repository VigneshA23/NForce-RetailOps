package com.nforce.retailops.repository;

import com.nforce.retailops.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    @Query("select u from User u left join fetch u.roles where lower(u.email) = lower(:email)")
    Optional<User> findByEmailWithRoles(@Param("email") String email);

    @Query("select distinct u from User u join u.roles r where r.name = 'OWNER_ADMIN' order by u.id")
    List<User> findAllOwners();
}
