package com.nforce.retailops.service;

import com.nforce.retailops.entity.StoreCodeCounter;
import com.nforce.retailops.repository.StoreCodeCounterRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Component
public class StoreCodeGenerator {

    private static final int COUNTER_ROW_ID = 1;
    private static final long FIRST_STORE_CODE = 10001L;

    private final StoreCodeCounterRepository storeCodeCounterRepository;

    public StoreCodeGenerator(StoreCodeCounterRepository storeCodeCounterRepository) {
        this.storeCodeCounterRepository = storeCodeCounterRepository;
    }

    // MANDATORY: must run inside the transaction that also saves the new
    // store, so the lock held here actually covers the whole creation and a
    // rollback puts the counter back too. The row is created on first use
    // rather than assumed to exist -- the Flyway migration seeds it for a
    // real database, but a schema built straight from entities (as in tests)
    // never runs that migration.
    @Transactional(propagation = Propagation.MANDATORY)
    public long next() {
        StoreCodeCounter counter = storeCodeCounterRepository.lockTheCounter()
            .orElseGet(() -> {
                StoreCodeCounter created = new StoreCodeCounter();
                created.setId(COUNTER_ROW_ID);
                created.setNextValue(FIRST_STORE_CODE);
                return storeCodeCounterRepository.save(created);
            });

        long code = counter.getNextValue();
        counter.setNextValue(code + 1);
        storeCodeCounterRepository.save(counter);
        return code;
    }
}
