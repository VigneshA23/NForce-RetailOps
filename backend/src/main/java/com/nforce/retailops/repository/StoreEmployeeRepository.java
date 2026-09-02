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

    // Keyed on the User id, which is what the authenticated principal yields --
    // not the StoreEmployee PK.
    Optional<StoreEmployee> findByEmployeeId(Long userId);

    boolean existsByEmployeeIdAndStoresId(Long userId, Long storeId);
}
