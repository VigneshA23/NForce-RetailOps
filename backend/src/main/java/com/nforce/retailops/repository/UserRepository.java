package com.nforce.retailops.repository;

import com.nforce.retailops.entity.User;
import org.springframework.data.domain.Pageable;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    @Query("select u from User u left join fetch u.roles where lower(u.email) = lower(:email)")
    Optional<User> findByEmailWithRoles(@Param("email") String email);

    // Row lock used to serialise per-account work (e.g. the password-reset rate
    // limit). No fetch join: Postgres rejects FOR UPDATE on an outer join.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where lower(u.email) = lower(:email)")
    Optional<User> findByEmailForUpdate(@Param("email") String email);

    @Query("select distinct u from User u join u.roles r where r.name = 'OWNER_ADMIN' order by u.id")
    List<User> findAllOwners();

    // Super Admin top-right command palette (SACommandPalette): matches
    // owners by name, email, or their admin code (`ADM007`). The admin
    // code is derived from the user id (`"ADM" + lpad(id, 3)`), so the
    // service parses the query and passes a non-null `codeId` only when
    // the query is of the form `ADM\d+` or pure digits; otherwise codeId
    // is null and the condition collapses.
    @Query("select distinct u from User u join u.roles r where r.name = 'OWNER_ADMIN' "
        + "and (lower(u.fullName) like lower(concat('%', :q, '%')) "
        + "or lower(u.email) like lower(concat('%', :q, '%')) "
        + "or (:codeId is not null and u.id = :codeId)) "
        + "order by u.fullName")
    List<User> searchOwnersByNameEmailOrAdminCode(@Param("q") String q, @Param("codeId") Long codeId, Pageable pageable);
}
