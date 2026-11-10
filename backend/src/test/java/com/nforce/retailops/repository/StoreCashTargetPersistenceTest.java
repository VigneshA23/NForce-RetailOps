package com.nforce.retailops.repository;

import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreCashTarget;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

// Proves an updated target is actually written to the database. A mocked
// service test cannot: the target column is DB-defaulted and excluded from INSERT.
@SpringBootTest
@ActiveProfiles("test")
class StoreCashTargetPersistenceTest {

    @Autowired private StoreCashTargetRepository repository;
    @Autowired private StoreRepository storeRepository;
    @Autowired private TransactionTemplate tx;

    @Test
    void updatedTargetSurvivesReload() {
        Store store = new Store();
        store.setName("Cash target store");
        store.setStoreCode(987654L);
        store.setActive(true);
        Long storeId = storeRepository.save(store).getId();

        tx.executeWithoutResult(s -> {
            StoreCashTarget created = new StoreCashTarget();
            created.setStore(storeRepository.getReferenceById(storeId));
            repository.saveAndFlush(created);
        });
        assertThat(load(storeId))
            .isEqualByComparingTo("150.00");

        tx.executeWithoutResult(s -> {
            StoreCashTarget t = repository.findByStoreId(storeId).orElseThrow();
            t.setTargetAmount(new BigDecimal("250.00"));
            repository.save(t);
        });

        assertThat(load(storeId))
            .isEqualByComparingTo("250.00");
    }

    private BigDecimal load(Long storeId) {
        return tx.execute(s -> repository.findByStoreId(storeId).orElseThrow().getTargetAmount());
    }
}
