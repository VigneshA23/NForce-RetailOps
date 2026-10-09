package com.nforce.retailops.service;

import com.nforce.retailops.dto.EodSupplierReportResponse;
import com.nforce.retailops.dto.InventoryCountHistoryEntryResponse;
import com.nforce.retailops.dto.InventoryCountsPageResponse;
import com.nforce.retailops.entity.StockCheck;
import com.nforce.retailops.entity.StockCheckSnapshot;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.StoreInventoryItemNotFoundException;
import com.nforce.retailops.repository.StockCheckCorrectionRepository;
import com.nforce.retailops.repository.StockCheckReceiptRepository;
import com.nforce.retailops.repository.StockCheckRepository;
import com.nforce.retailops.repository.StoreInventoryItemRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static com.nforce.retailops.TestDecimals.bd;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

// RTS-304 Orders dashboard parity: Super Admin's cross-store Inventory
// Counts and End of Day Report tabs. Separate test class from
// StockCheckServiceTest, matching this codebase's convention of a dedicated
// test class per Super Admin service slice (e.g.
// StockCheckServiceSuperAdminCorrectionTest). These three methods are thin
// storeId-direct wrappers around the same private helpers the owner-scoped
// methods use, so each test just confirms the delegation works and that no
// owner-link lookup happens.
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class StockCheckServiceSuperAdminReportsTest {

    private static final Long STORE_ID = 10L;
    private static final Long ITEM_ID = 20L;

    @Mock private StoreInventoryItemRepository storeInventoryItemRepository;
    @Mock private StockCheckRepository stockCheckRepository;
    @Mock private StockCheckCorrectionRepository stockCheckCorrectionRepository;
    @Mock private StockCheckReceiptRepository stockCheckReceiptRepository;
    @Mock private UserRepository userRepository;
    @Mock private StoreOwnerRepository storeOwnerRepository;
    @Mock private StoreRepository storeRepository;
    @Mock private OrderListService orderListService;
    @Mock private UserProfileService userProfileService;
    @Mock private NotificationService notificationService;

    @InjectMocks
    private StockCheckService stockCheckService;

    private Store store;
    private StoreInventoryItem milk;

    @BeforeEach
    void setUp() {
        store = new Store();
        ReflectionTestUtils.setField(store, "id", STORE_ID);
        store.setName("Downtown");

        milk = new StoreInventoryItem();
        ReflectionTestUtils.setField(milk, "id", ITEM_ID);
        milk.setStore(store);
        milk.setName("Milk");
        milk.setUnitOfMeasurement("L");
        milk.setActive(true);
    }

    private StockCheck existingCheck(LocalDate date) {
        StockCheck check = new StockCheck();
        ReflectionTestUtils.setField(check, "id", 42L);
        check.setStore(store);
        check.setStoreInventoryItem(milk);
        check.setCheckDate(date);
        return check;
    }

    @Test
    void eodReportForSuperAdminUsesTheGivenStoreIdDirectlyWithNoOwnerLookup() {
        milk.setMinWeekday(bd(40));
        milk.setMinWeekend(bd(40));
        LocalDate day = LocalDate.of(2026, 6, 15);
        StockCheck check = existingCheck(day);
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(50), bd(2), null, OffsetDateTime.now(), false);
        check.recordSnapshot(StockCheckSnapshot.END_OF_DAY, bd(35), bd(1), null, OffsetDateTime.now(), false);
        check.setRequiredTomorrow(bd(40));
        check.setQuantityNeeded(bd(6));

        when(storeInventoryItemRepository.findByStoreIdOrderById(STORE_ID)).thenReturn(List.of(milk));
        when(stockCheckRepository.findForStoreOnDate(STORE_ID, day)).thenReturn(List.of(check));

        EodSupplierReportResponse report = stockCheckService.getEodSupplierReportForSuperAdmin(STORE_ID, day);

        assertThat(report.groups()).hasSize(1);
        assertThat(report.groups().get(0).items().get(0).quantityToOrder()).isEqualByComparingTo(bd(6));
        verifyNoInteractions(storeOwnerRepository);
    }

    @Test
    void inventoryCountsForSuperAdminUsesTheGivenStoreIdDirectlyWithNoOwnerLookup() {
        when(storeInventoryItemRepository.findByStoreIdAndActiveTrueOrderById(STORE_ID)).thenReturn(List.of(milk));
        when(stockCheckRepository.findLatestPerItemForStore(STORE_ID)).thenReturn(List.of());

        InventoryCountsPageResponse page = stockCheckService.listInventoryCountsForSuperAdmin(
            STORE_ID, null, null, null, null, null
        );

        assertThat(page.allCount()).isEqualTo(1);
        assertThat(page.rows()).extracting("name").containsExactly("Milk");
        verifyNoInteractions(storeOwnerRepository);
    }

    @Test
    void countHistoryForSuperAdminUsesTheGivenStoreIdDirectlyWithNoOwnerLookup() {
        User employee = new User();
        ReflectionTestUtils.setField(employee, "id", 2L);
        employee.setFullName("Sarah");
        StockCheck check = existingCheck(LocalDate.of(2026, 6, 15));
        check.recordSnapshot(StockCheckSnapshot.END_OF_DAY, bd(12), bd(0), employee, OffsetDateTime.now(), false);
        when(storeInventoryItemRepository.findByIdAndStoreId(ITEM_ID, STORE_ID)).thenReturn(Optional.of(milk));
        when(stockCheckRepository.findRecentForItem(eq(ITEM_ID), any(Pageable.class)))
            .thenReturn(List.of(check));

        List<InventoryCountHistoryEntryResponse> history =
            stockCheckService.getCountHistoryForSuperAdmin(STORE_ID, ITEM_ID);

        assertThat(history).hasSize(1);
        assertThat(history.get(0).count()).isEqualByComparingTo(bd(12));
        verifyNoInteractions(storeOwnerRepository);
    }

    @Test
    void countHistoryForSuperAdminThrowsWhenTheItemBelongsToAnotherStore() {
        when(storeInventoryItemRepository.findByIdAndStoreId(ITEM_ID, STORE_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> stockCheckService.getCountHistoryForSuperAdmin(STORE_ID, ITEM_ID))
            .isInstanceOf(StoreInventoryItemNotFoundException.class);
    }
}
