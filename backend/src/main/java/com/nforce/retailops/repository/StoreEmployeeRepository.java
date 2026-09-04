package com.nforce.retailops.repository;

import com.nforce.retailops.entity.StoreEmployee;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface StoreEmployeeRepository extends JpaRepository<StoreEmployee, Long> {

    int countByStoresId(Long storeId);

    // Y in the "X/Y Completed By" checklist status: only employees whose User
    // account is still active count toward the store's headcount.
    int countByStoresIdAndEmployeeActiveTrue(Long storeId);

    // Batched form of countByStoresId, for listing many stores at once without
    // one count query per store.
    @Query("select s.id, count(se) from StoreEmployee se join se.stores s where s.id in :storeIds group by s.id")
    List<Object[]> countGroupedByStoreIds(@Param("storeIds") Collection<Long> storeIds);

    List<StoreEmployee> findDistinctByStoresIdInOrderByIdAsc(Collection<Long> storeIds);

    List<StoreEmployee> findByCreatedByOwnerId(Long ownerId);

    // Fetch-joined forms of the two finders above, for listEmployees: the User
    // side of the one-to-one is required by every row of the response, so
    // fetch it up front instead of one lazy-load query per employee.
    @Query("select distinct se from StoreEmployee se join fetch se.employee join se.stores s where s.id in :storeIds order by se.id asc")
    List<StoreEmployee> findDistinctByStoresIdInOrderByIdAscFetchEmployee(@Param("storeIds") Collection<Long> storeIds);

    @Query("select se from StoreEmployee se join fetch se.employee where se.createdByOwner.id = :ownerId")
    List<StoreEmployee> findByCreatedByOwnerIdFetchEmployee(@Param("ownerId") Long ownerId);

    // Super Admin's cross-owner employee directory: every employee platform-wide,
    // with its User and creating owner fetched up front (left join -- a legacy row
    // could in principle have no recorded creator) to avoid a lazy-load per row.
    @Query("select se from StoreEmployee se join fetch se.employee left join fetch se.createdByOwner")
    List<StoreEmployee> findAllFetchEmployeeAndCreatedByOwner();

    // Batched form of StoreEmployee.stores, for listing many employees at once
    // without one query per employee for their (lazy, many-to-many) store list.
    @Query("select se.id, s.id, s.name from StoreEmployee se join se.stores s where se.id in :employeeIds order by s.name asc")
    List<Object[]> findStoreRowsGroupedByEmployeeIds(@Param("employeeIds") Collection<Long> employeeIds);

    // Keyed on the User id, which is what the authenticated principal yields --
    // not the StoreEmployee PK.
    Optional<StoreEmployee> findByEmployeeId(Long userId);

    // Batched form of findByEmployeeId, for enriching many distinct responders at once
    // (e.g. admin checklist history) without one query per employee.
    List<StoreEmployee> findByEmployeeIdIn(Collection<Long> userIds);

    boolean existsByEmployeeIdAndStoresId(Long userId, Long storeId);
}
