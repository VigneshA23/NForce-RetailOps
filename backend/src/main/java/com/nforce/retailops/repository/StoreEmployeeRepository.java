package com.nforce.retailops.repository;

import com.nforce.retailops.entity.StoreEmployee;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface StoreEmployeeRepository extends JpaRepository<StoreEmployee, Long> {

    int countByStoresId(Long storeId);

    List<StoreEmployee> findDistinctByStoresIdInOrderByIdAsc(Collection<Long> storeIds);

    List<StoreEmployee> findByCreatedByOwnerId(Long ownerId);

    // Keyed on the User id, which is what the authenticated principal yields --
    // not the StoreEmployee PK.
    Optional<StoreEmployee> findByEmployeeId(Long userId);

    boolean existsByEmployeeIdAndStoresId(Long userId, Long storeId);
}
