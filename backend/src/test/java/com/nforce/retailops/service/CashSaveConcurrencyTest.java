package com.nforce.retailops.service;

import com.nforce.retailops.dto.DailyCashEntryRequest;
import com.nforce.retailops.dto.DailyCashEntryResponse;
import com.nforce.retailops.dto.StoreCashTargetRequest;
import com.nforce.retailops.dto.StoreCashTargetResponse;
import com.nforce.retailops.entity.DailyCashEntry;
import com.nforce.retailops.entity.DailyCashEntryCorrection;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.repository.DailyCashEntryCorrectionRepository;
import com.nforce.retailops.repository.DailyCashEntryRepository;
import com.nforce.retailops.repository.StoreCashTargetRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.SuperAdminRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class CashSaveConcurrencyTest {

    @Autowired private DailyCashEntryService dailyCashEntryService;
    @Autowired private StoreCashTargetService storeCashTargetService;
    @Autowired private DailyCashEntryRepository dailyCashEntryRepository;
    @Autowired private DailyCashEntryCorrectionRepository correctionRepository;
    @Autowired private StoreCashTargetRepository targetRepository;
    @Autowired private StoreRepository storeRepository;
    @Autowired private SuperAdminRepository superAdminRepository;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private PlatformTransactionManager transactionManager;

    @Test
    void concurrentUpdatesToExistingDailyEntryKeepEveryPriorValue() throws Exception {
        Fixture fixture = createFixture();
        LocalDate date = LocalDate.now();
        dailyCashEntryService.saveForSuperAdmin(fixture.superAdminId(), fixture.storeId(), cashRequest(date, "100"));

        runTogether(List.of(
            () -> dailyCashEntryService.saveForSuperAdmin(
                fixture.superAdminId(), fixture.storeId(), cashRequest(date, "200")),
            () -> dailyCashEntryService.saveForSuperAdmin(
                fixture.superAdminId(), fixture.storeId(), cashRequest(date, "300"))));

        DailyCashEntry entry = dailyCashEntryRepository
            .findByStoreIdAndBusinessDate(fixture.storeId(), date).orElseThrow();
        List<DailyCashEntryCorrection> corrections =
            correctionRepository.findByEntryIdOrderByCorrectedAtAscIdAsc(entry.getId());

        assertThat(corrections).hasSize(2);
        assertThat(corrections.get(0).getPreviousTotalCashSales()).isEqualByComparingTo("100");
        assertThat(corrections.get(1).getPreviousTotalCashSales())
            .isIn(new BigDecimal("200.00"), new BigDecimal("300.00"));
        assertThat(entry.getTotalCashSales()).isIn(new BigDecimal("200.00"), new BigDecimal("300.00"))
            .isNotEqualByComparingTo(corrections.get(1).getPreviousTotalCashSales());
    }

    @Test
    void concurrentFirstDailyEntrySavesCreateOneEntryAndAuditTheAppliedCorrection() throws Exception {
        Fixture fixture = createFixture();
        LocalDate date = LocalDate.now();

        runTogether(List.of(
            () -> dailyCashEntryService.saveForSuperAdmin(
                fixture.superAdminId(), fixture.storeId(), cashRequest(date, "210")),
            () -> dailyCashEntryService.saveForSuperAdmin(
                fixture.superAdminId(), fixture.storeId(), cashRequest(date, "310"))));

        DailyCashEntry entry = dailyCashEntryRepository
            .findByStoreIdAndBusinessDate(fixture.storeId(), date).orElseThrow();
        List<DailyCashEntryCorrection> corrections =
            correctionRepository.findByEntryIdOrderByCorrectedAtAscIdAsc(entry.getId());

        assertThat(corrections).hasSize(1);
        assertThat(corrections.get(0).getPreviousTotalCashSales())
            .isIn(new BigDecimal("210.00"), new BigDecimal("310.00"));
        assertThat(entry.getTotalCashSales()).isIn(new BigDecimal("210.00"), new BigDecimal("310.00"))
            .isNotEqualByComparingTo(corrections.get(0).getPreviousTotalCashSales());
    }

    @Test
    void concurrentUpdatesToExistingTargetKeepContinuousChangeHistory() throws Exception {
        Fixture fixture = createFixture();
        storeCashTargetService.getForSuperAdmin(fixture.storeId());

        runTogether(List.of(
            () -> storeCashTargetService.updateForSuperAdmin(
                fixture.superAdminId(), fixture.storeId(), targetRequest("250")),
            () -> storeCashTargetService.updateForSuperAdmin(
                fixture.superAdminId(), fixture.storeId(), targetRequest("350"))));

        assertContinuousTargetHistory(fixture.storeId(), "250", "350");
    }

    @Test
    void concurrentFirstTargetUpdatesCreateOneTargetAndAuditBothChanges() throws Exception {
        Fixture fixture = createFixture();

        runTogether(List.of(
            () -> storeCashTargetService.updateForSuperAdmin(
                fixture.superAdminId(), fixture.storeId(), targetRequest("450")),
            () -> storeCashTargetService.updateForSuperAdmin(
                fixture.superAdminId(), fixture.storeId(), targetRequest("550"))));

        assertThat(targetRepository.findByStoreId(fixture.storeId())).isPresent();
        assertContinuousTargetHistory(fixture.storeId(), "450", "550");
    }

    @Test
    void concurrentFirstTargetReadsCreateOneDefaultWithoutChangeHistory() throws Exception {
        Fixture fixture = createFixture();

        List<StoreCashTargetResponse> responses = runTogether(List.of(
            () -> storeCashTargetService.getForSuperAdmin(fixture.storeId()),
            () -> storeCashTargetService.getForSuperAdmin(fixture.storeId())));

        assertThat(responses).extracting(StoreCashTargetResponse::targetAmount)
            .containsExactly(new BigDecimal("150.00"), new BigDecimal("150.00"));
        assertThat(targetRepository.findByStoreId(fixture.storeId())).isPresent();
        assertThat(changeRowsFor(fixture.storeId())).isEmpty();
    }

    private void assertContinuousTargetHistory(Long storeId, String first, String second) {
        List<TargetChange> changes = changeRowsFor(storeId);
        assertThat(changes).hasSize(2);

        TargetChange firstChange = changes.get(0);
        TargetChange secondChange = changes.get(1);
        assertThat(firstChange.previousAmount()).isEqualByComparingTo("150.00");
        assertThat(firstChange.newAmount()).isIn(
            new BigDecimal(first).setScale(2), new BigDecimal(second).setScale(2));
        assertThat(secondChange.previousAmount()).isEqualByComparingTo(firstChange.newAmount());
        assertThat(secondChange.newAmount()).isIn(
            new BigDecimal(first).setScale(2), new BigDecimal(second).setScale(2))
            .isNotEqualByComparingTo(firstChange.newAmount());
        assertThat(targetRepository.findByStoreId(storeId).orElseThrow().getTargetAmount())
            .isEqualByComparingTo(secondChange.newAmount());
    }

    private List<TargetChange> changeRowsFor(Long storeId) {
        return jdbcTemplate.query(
            "select previous_amount, new_amount from store_cash_target_changes where store_id = ? order by id",
            (resultSet, rowNumber) ->
                new TargetChange(resultSet.getBigDecimal("previous_amount"), resultSet.getBigDecimal("new_amount")),
            storeId);
    }

    private Fixture createFixture() {
        return new TransactionTemplate(transactionManager).execute(status -> {
            String suffix = UUID.randomUUID().toString();
            Store store = new Store();
            store.setName("Cash concurrency " + suffix);
            store.setStoreCode(Math.abs(UUID.randomUUID().getMostSignificantBits()));
            store.setActive(true);
            store = storeRepository.save(store);

            SuperAdmin superAdmin = new SuperAdmin();
            superAdmin.setName("Cash concurrency test");
            superAdmin.setEmail("cash-concurrency-" + suffix + "@nforce.test");
            superAdmin.setPasswordHash("test-password-hash");
            superAdmin = superAdminRepository.save(superAdmin);
            return new Fixture(store.getId(), superAdmin.getId());
        });
    }

    private static DailyCashEntryRequest cashRequest(LocalDate date, String totalCashSales) {
        return new DailyCashEntryRequest(date, new BigDecimal(totalCashSales), new BigDecimal("100"),
            new BigDecimal("10"), new BigDecimal("90"), new BigDecimal("5"), new BigDecimal("20"),
            BigDecimal.ZERO);
    }

    private static StoreCashTargetRequest targetRequest(String amount) {
        return new StoreCashTargetRequest(new BigDecimal(amount));
    }

    private static <T> List<T> runTogether(List<Callable<T>> tasks) throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(tasks.size());
        CountDownLatch ready = new CountDownLatch(tasks.size());
        CountDownLatch start = new CountDownLatch(1);
        List<Future<T>> futures = new ArrayList<>();
        try {
            for (Callable<T> task : tasks) {
                futures.add(executor.submit(() -> {
                    ready.countDown();
                    if (!start.await(10, TimeUnit.SECONDS)) {
                        throw new IllegalStateException("Timed out waiting to start concurrent cash save");
                    }
                    return task.call();
                }));
            }
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            List<T> results = new ArrayList<>();
            for (Future<T> future : futures) {
                results.add(future.get(30, TimeUnit.SECONDS));
            }
            return results;
        } finally {
            start.countDown();
            executor.shutdownNow();
            executor.awaitTermination(10, TimeUnit.SECONDS);
        }
    }

    private record Fixture(Long storeId, Long superAdminId) {
    }

    private record TargetChange(BigDecimal previousAmount, BigDecimal newAmount) {
    }
}
