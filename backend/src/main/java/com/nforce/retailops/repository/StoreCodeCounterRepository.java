package com.nforce.retailops.repository;

import com.nforce.retailops.entity.StoreCodeCounter;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface StoreCodeCounterRepository extends JpaRepository<StoreCodeCounter, Integer> {

    // Row-level lock on the single counter row: whichever transaction gets
    // here first holds it until commit, serializing concurrent store
    // creations so two stores can never be handed the same code.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from StoreCodeCounter c where c.id = 1")
    Optional<StoreCodeCounter> lockTheCounter();
}
