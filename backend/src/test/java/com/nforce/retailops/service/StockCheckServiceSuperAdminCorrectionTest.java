package com.nforce.retailops.service;

import static com.nforce.retailops.TestDecimals.bd;
import com.nforce.retailops.dto.StockCheckCorrectionRequest;
import com.nforce.retailops.dto.StockCheckResponse;
import com.nforce.retailops.entity.StockCheck;
import com.nforce.retailops.entity.StockCheckCorrection;
import com.nforce.retailops.entity.StockCheckSnapshot;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.InvalidStockCheckException;
import com.nforce.retailops.exception.StoreInventoryItemNotFoundException;
import com.nforce.retailops.repository.StockCheckCorrectionRepository;
import com.nforce.retailops.repository.StockCheckRepository;
import com.nforce.retailops.repository.StoreInventoryItemRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// RTS-306: Super Admin's cross-store stock-check correction. Separate test
// class from StockCheckServiceTest, matching this codebase's convention of a
// dedicated test class per Super Admin service slice (e.g.
// SuperAdminOperationsServiceOutstandingOrdersTest).
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class StockCheckServiceSuperAdminCorrectionTest {

    private static final Long STORE_ID = 10L;
    private static final Long ITEM_ID = 20L;
    private static final Long CHECK_ID = 42L;
    private static final Long SUPER_ADMIN_ID = 99L;

    @Mock private StoreInventoryItemRepository storeInventoryItemRepository;
    @Mock private StockCheckRepository stockCheckRepository;
    @Mock private StockCheckCorrectionRepository stockCheckCorrectionRepository;
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
    private SuperAdmin superAdmin;

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

        superAdmin = new SuperAdmin();
        ReflectionTestUtils.setField(superAdmin, "id", SUPER_ADMIN_ID);
        superAdmin.setName("Super Admin Sam");

        when(stockCheckRepository.save(any(StockCheck.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    private StockCheck existingCheck(LocalDate date) {
        StockCheck check = new StockCheck();
        ReflectionTestUtils.setField(check, "id", CHECK_ID);
        check.setStore(store);
        check.setStoreInventoryItem(milk);
        check.setCheckDate(date);
        return check;
    }

    private StockCheckCorrectionRequest request(String reason) {
        return new StockCheckCorrectionRequest(StockCheckSnapshot.END_OF_DAY, bd(6), bd(1), reason);
    }

    @Test
    void correctsAStoreItHasNoOwnerLinkToAndAttributesTheCorrectionToTheSuperAdmin() {
        StockCheck check = existingCheck(LocalDate.of(2026, 6, 15));
        check.recordSnapshot(StockCheckSnapshot.END_OF_DAY, bd(10), bd(0), null, java.time.OffsetDateTime.now().minusDays(3), false);
        when(stockCheckRepository.findByIdAndStoreId(CHECK_ID, STORE_ID)).thenReturn(Optional.of(check));
        when(storeOwnerRepository.findByStoreIdAndActiveTrue(STORE_ID)).thenReturn(Optional.empty());

        StockCheckResponse response = stockCheckService.correctCheckForSuperAdmin(
            STORE_ID, CHECK_ID, superAdmin, request("Recounted during platform audit")
        );

        assertThat(response.id()).isEqualTo(CHECK_ID);

        ArgumentCaptor<StockCheckCorrection> captor = ArgumentCaptor.forClass(StockCheckCorrection.class);
        verify(stockCheckCorrectionRepository).save(captor.capture());
        StockCheckCorrection saved = captor.getValue();
        assertThat(saved.getCorrectedBySuperAdmin()).isEqualTo(superAdmin);
        assertThat(saved.getCorrectedByUser()).isNull();
        assertThat(saved.getReason()).isEqualTo("Recounted during platform audit");

        // No active owner -- notification is skipped, not an error.
        verify(notificationService, never()).notifyOwnerOfSuperAdminStockCheckCorrection(any(), any());
    }

    // Regression: checked_by_user_id is NOT NULL, so a Super Admin correction
    // (no users row) must not overwrite the existing checker with null.
    @Test
    void keepsTheOriginalCheckerWhenASuperAdminCorrectsARealEmployeeEntry() {
        User employee = new User();
        ReflectionTestUtils.setField(employee, "id", 5L);
        employee.setFullName("Employee Eve");
        StockCheck check = existingCheck(LocalDate.of(2026, 6, 15));
        check.recordSnapshot(StockCheckSnapshot.END_OF_DAY, bd(10), bd(0), employee, java.time.OffsetDateTime.now().minusDays(3), false);
        when(stockCheckRepository.findByIdAndStoreId(CHECK_ID, STORE_ID)).thenReturn(Optional.of(check));

        stockCheckService.correctCheckForSuperAdmin(STORE_ID, CHECK_ID, superAdmin, request("Recount"));

        assertThat(check.getCheckedBy()).isEqualTo(employee);
        assertThat(check.getEndOfDayAvailable()).isEqualByComparingTo(bd(6));
        assertThat(check.getEndOfDayDeadStock()).isEqualByComparingTo(bd(1));
    }

    @Test
    void rejectsAMissingReason() {
        StockCheck check = existingCheck(LocalDate.of(2026, 6, 15));
        check.recordSnapshot(StockCheckSnapshot.END_OF_DAY, bd(10), bd(0), null, java.time.OffsetDateTime.now().minusDays(3), false);
        when(stockCheckRepository.findByIdAndStoreId(CHECK_ID, STORE_ID)).thenReturn(Optional.of(check));

        assertThatThrownBy(() -> stockCheckService.correctCheckForSuperAdmin(STORE_ID, CHECK_ID, superAdmin, request(null)))
            .isInstanceOf(InvalidStockCheckException.class);
        assertThatThrownBy(() -> stockCheckService.correctCheckForSuperAdmin(STORE_ID, CHECK_ID, superAdmin, request("   ")))
            .isInstanceOf(InvalidStockCheckException.class);

        verify(stockCheckCorrectionRepository, never()).save(any());
    }

    @Test
    void rejectsACheckBelongingToAnotherStore() {
        when(stockCheckRepository.findByIdAndStoreId(CHECK_ID, STORE_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> stockCheckService.correctCheckForSuperAdmin(STORE_ID, CHECK_ID, superAdmin, request("Reason")))
            .isInstanceOf(StoreInventoryItemNotFoundException.class);
    }

    @Test
    void correctingTodaysEntryStillSyncsTheOrderList() {
        milk.setMinWeekday(bd(5));
        milk.setMinWeekend(bd(5));
        StockCheck check = existingCheck(LocalDate.now());
        check.recordSnapshot(StockCheckSnapshot.END_OF_DAY, bd(10), bd(0), null, java.time.OffsetDateTime.now().minusHours(1), false);
        when(stockCheckRepository.findByIdAndStoreId(CHECK_ID, STORE_ID)).thenReturn(Optional.of(check));

        // request() asks for available=6, deadStock=1 -> usable 5, meeting the minimum above.
        stockCheckService.correctCheckForSuperAdmin(STORE_ID, CHECK_ID, superAdmin, request("Recount"));

        verify(orderListService).resolveShortageIfPresent(store, milk);
    }

    @Test
    void notifiesTheActiveOwnerWhenOneExists() {
        StockCheck check = existingCheck(LocalDate.of(2026, 6, 15));
        check.recordSnapshot(StockCheckSnapshot.END_OF_DAY, bd(10), bd(0), null, java.time.OffsetDateTime.now().minusDays(3), false);
        when(stockCheckRepository.findByIdAndStoreId(CHECK_ID, STORE_ID)).thenReturn(Optional.of(check));

        User owner = new User();
        ReflectionTestUtils.setField(owner, "id", 7L);
        owner.setFullName("Owner Olivia");
        StoreOwner storeOwner = new StoreOwner();
        storeOwner.setStore(store);
        storeOwner.setOwner(owner);
        when(storeOwnerRepository.findByStoreIdAndActiveTrue(STORE_ID)).thenReturn(Optional.of(storeOwner));

        stockCheckService.correctCheckForSuperAdmin(STORE_ID, CHECK_ID, superAdmin, request("Recount"));

        verify(notificationService).notifyOwnerOfSuperAdminStockCheckCorrection(check, owner);
    }
}
