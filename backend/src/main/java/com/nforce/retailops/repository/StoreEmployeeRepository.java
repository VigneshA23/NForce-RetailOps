package com.nforce.retailops.repository;

import com.nforce.retailops.entity.StoreEmployee;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StoreEmployeeRepository extends JpaRepository<StoreEmployee, Long> {

    int countByStoreId(Long storeId);

    void deleteByStoreId(Long storeId);
}
