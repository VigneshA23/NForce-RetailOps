package com.nforce.retailops.repository;

import com.nforce.retailops.entity.Store;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StoreRepository extends JpaRepository<Store, Long> {
}
