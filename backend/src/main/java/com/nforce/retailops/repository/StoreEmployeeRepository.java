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

    // Batched form of countByStoresId, for listing many stores at once without
    // one count query per store.
    @Query("select s.id, count(se) from StoreEmployee se join se.stores s where s.id in :storeIds group by s.id")
    List<Object[]> countGroupedByStoreIds(@Param("storeIds") Collection<Long> storeIds);

    List<StoreEmployee> findDistinctByStoresIdInOrderByIdAsc(Collection<Long> storeIds);

    List<StoreEmployee> findByCreatedByOwnerId(Long ownerId);

    // Keyed on the User id, which is what the authenticated principal yields --
    // not the StoreEmployee PK.
    Optional<StoreEmployee> findByEmployeeId(Long userId);

    // Batched form of findByEmployeeId, for enriching many distinct responders at once
    // (e.g. admin checklist history) without one query per employee.
    List<StoreEmployee> findByEmployeeIdIn(Collection<Long> userIds);

    boolean existsByEmployeeIdAndStoresId(Long userId, Long storeId);
}
