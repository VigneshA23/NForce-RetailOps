package com.nforce.retailops.repository;

import com.nforce.retailops.entity.StoreEmployee;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StoreEmployeeRepository extends JpaRepository<StoreEmployee, Long> {

<<<<<<< Updated upstream
    int countByStoreId(Long storeId);

    void deleteByStoreId(Long storeId);

    List<StoreEmployee> findByStoreIdOrderByIdAsc(Long storeId);

    Optional<StoreEmployee> findByIdAndStoreId(Long id, Long storeId);
=======
    Optional<StoreEmployee> findByEmployee_Id(Long employeeId);

    List<StoreEmployee> findByStore_IdIn(List<Long> storeIds);

    long countByStore_Id(Long storeId);
>>>>>>> Stashed changes
}
