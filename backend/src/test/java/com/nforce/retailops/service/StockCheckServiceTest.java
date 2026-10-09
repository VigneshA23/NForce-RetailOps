package com.nforce.retailops.service;

import static com.nforce.retailops.TestDecimals.bd;
import com.nforce.retailops.dto.EodSupplierReportResponse;
import com.nforce.retailops.dto.InventoryCountHistoryEntryResponse;
import com.nforce.retailops.dto.InventoryCountRowResponse;
import com.nforce.retailops.dto.InventoryCountStatus;
import com.nforce.retailops.dto.InventoryCountsPageResponse;
import com.nforce.retailops.dto.StockCheckCorrectionRequest;
import com.nforce.retailops.dto.StockCheckResponse;
import com.nforce.retailops.dto.StockCheckSubmitRequest;
import com.nforce.retailops.entity.StockCheck;
import com.nforce.retailops.entity.StockCheckCorrection;
import com.nforce.retailops.entity.StockCheckSnapshot;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.Supplier;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.InvalidStockCheckException;
import com.nforce.retailops.exception.StoreInventoryItemNotFoundException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.StockCheckCorrectionRepository;
import com.nforce.retailops.repository.StockCheckRepository;
import com.nforce.retailops.repository.StoreInventoryItemRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.assertj.core.groups.Tuple;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class StockCheckServiceTest {

    private static final Long OWNER_ID = 1L;
    private static final Long EMPLOYEE_ID = 2L;
    private static final Long STORE_ID = 10L;
    private static final Long ITEM_ID = 20L;
    private static final Long CHECK_ID = 42L;

    @Mock private StoreInventoryItemRepository storeInventoryItemRepository;
    @Mock private StockCheckRepository stockCheckRepository;
    @Mock private StockCheckCorrectionRepository stockCheckCorrectionRepository;
    @Mock private UserRepository userRepository;
    @Mock private StoreOwnerRepository storeOwnerRepository;
    @Mock private OrderListService orderListService;
    @Mock private UserProfileService userProfileService;

    @InjectMocks
    private StockCheckService stockCheckService;

    private Store store;
    private StoreInventoryItem milk;
    private User employee;
    private User owner;

    @BeforeEach
    void setUp() {
        store = new Store();
        ReflectionTestUtils.setField(store, "id", STORE_ID);

        milk = new StoreInventoryItem();
        ReflectionTestUtils.setField(milk, "id", ITEM_ID);
        milk.setStore(store);
        milk.setName("Milk");
        milk.setUnitOfMeasurement("L");
        milk.setActive(true);

        employee = user(EMPLOYEE_ID, "Sarah");
        owner = user(OWNER_ID, "Owner Olivia");

        when(storeInventoryItemRepository.findById(ITEM_ID)).thenReturn(Optional.of(milk));
        when(userRepository.getReferenceById(EMPLOYEE_ID)).thenReturn(employee);
        when(userRepository.getReferenceById(OWNER_ID)).thenReturn(owner);
        when(stockCheckRepository.save(any(StockCheck.class))).thenAnswer(invocation -> invocation.getArgument(0));

        StoreOwner storeOwner = new StoreOwner();
        storeOwner.setStore(store);
        when(storeOwnerRepository.findByOwnerId(OWNER_ID)).thenReturn(List.of(storeOwner));
    }

    private static User user(Long id, String name) {
        User user = new User();
        ReflectionTestUtils.setField(user, "id", id);
        user.setFullName(name);
        return user;
    }

    private StockCheck existingCheck(LocalDate date) {
        StockCheck check = new StockCheck();
        ReflectionTestUtils.setField(check, "id", CHECK_ID);
        check.setStore(store);
        check.setStoreInventoryItem(milk);
        check.setCheckDate(date);
        return check;
    }

    private StockCheckSubmitRequest submit(StockCheckSnapshot snapshot, int available, int dead) {
        return new StockCheckSubmitRequest(STORE_ID, ITEM_ID, snapshot, bd(available), bd(dead));
    }

    @Test
    void anotherEmployeeCannotOverwriteAnAlreadySubmittedSnapshot() {
        StockCheck check = existingCheck(LocalDate.now());
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(10), bd(0), user(99L, "Alex"), OffsetDateTime.now(), false);
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now()))
            .thenReturn(Optional.of(check));

        assertThatThrownBy(() -> stockCheckService.submitCheck(EMPLOYEE_ID, submit(StockCheckSnapshot.START_OF_DAY, 50, 2)))
            .isInstanceOf(com.nforce.retailops.exception.StockCheckLockedException.class);
        assertThat(check.availableFor(StockCheckSnapshot.START_OF_DAY)).isEqualByComparingTo(bd(10));
        verify(stockCheckRepository, never()).save(any(StockCheck.class));
    }

    @Test
    void firstStartOfDaySaveCreatesTheDaysRecordWithNoAuditRowAndNoOrder() {
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now()))
            .thenReturn(Optional.empty());

        StockCheckResponse response = stockCheckService.submitCheck(EMPLOYEE_ID, submit(StockCheckSnapshot.START_OF_DAY, 50, 2));

        ArgumentCaptor<StockCheck> captor = ArgumentCaptor.forClass(StockCheck.class);
        verify(stockCheckRepository).save(captor.capture());
        StockCheck saved = captor.getValue();
        assertThat(saved.getStore()).isEqualTo(store);
        assertThat(saved.getCheckDate()).isEqualTo(LocalDate.now());
        assertThat(saved.getStartOfDayEnteredBy()).isEqualTo(employee);
        assertThat(saved.getEndOfDayAvailable()).isNull();

        assertThat(response.startOfDay().available()).isEqualByComparingTo(bd(50));
        assertThat(response.startOfDay().deadStock()).isEqualByComparingTo(bd(2));
        assertThat(response.startOfDay().usable()).isEqualByComparingTo(bd(48));
        assertThat(response.startOfDay().edited()).isFalse();
        assertThat(response.endOfDay()).isNull();
        assertThat(response.stockUsed()).isNull();
        assertThat(response.quantityToOrder()).isNull();

        verify(stockCheckCorrectionRepository, never()).save(any());
        verifyNoInteractions(orderListService);
    }

    @Test
    void originalEntererResavingStartOfDayUpdatesTheSameRecordAndAuditsThePreviousValue() {
        StockCheck check = existingCheck(LocalDate.now());
        User john = employee;
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(50), bd(2), john, OffsetDateTime.now().minusHours(3), false);
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now()))
            .thenReturn(Optional.of(check));

        StockCheckResponse response = stockCheckService.submitCheck(EMPLOYEE_ID, submit(StockCheckSnapshot.START_OF_DAY, 48, 2));

        // Same row, updated in place -- not a second SOD record.
        verify(stockCheckRepository).save(check);
        assertThat(response.id()).isEqualTo(CHECK_ID);
        assertThat(check.getStartOfDayAvailable()).isEqualByComparingTo(bd(48));
        assertThat(check.getStartOfDayEnteredBy()).isEqualTo(john);
        assertThat(check.getStartOfDayCheckedBy()).isEqualTo(employee);
        assertThat(response.startOfDay().enteredByName()).isEqualTo("Sarah");
        assertThat(response.startOfDay().lastUpdatedByName()).isEqualTo("Sarah");
        assertThat(response.startOfDay().edited()).isTrue();

        ArgumentCaptor<StockCheckCorrection> captor = ArgumentCaptor.forClass(StockCheckCorrection.class);
        verify(stockCheckCorrectionRepository).save(captor.capture());
        StockCheckCorrection audit = captor.getValue();
        assertThat(audit.getSnapshot()).isEqualTo(StockCheckSnapshot.START_OF_DAY);
        assertThat(audit.getOriginalCount()).isEqualByComparingTo(bd(50));
        assertThat(audit.getOriginalDeadStock()).isEqualByComparingTo(bd(2));
        assertThat(audit.getCorrectedCount()).isEqualByComparingTo(bd(48));
        assertThat(audit.getCorrectedByUser()).isEqualTo(employee);
    }

    @Test
    void endOfDayComputesUsageAndOrdersAgainstTomorrowsMinimum() {
        milk.setMinWeekday(bd(40));
        milk.setMinWeekend(bd(40));
        StockCheck check = existingCheck(LocalDate.now());
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(50), bd(2), employee, OffsetDateTime.now().minusHours(9), false);
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now()))
            .thenReturn(Optional.of(check));

        StockCheckResponse response = stockCheckService.submitCheck(EMPLOYEE_ID, submit(StockCheckSnapshot.END_OF_DAY, 35, 1));

        // Start usable 48, end usable 34.
        assertThat(response.stockUsed()).isEqualByComparingTo(bd(14));
        assertThat(response.requiredTomorrow()).isEqualByComparingTo(bd(40));
        assertThat(response.quantityToOrder()).isEqualByComparingTo(bd(6));
        assertThat(check.getCurrentCount()).isEqualByComparingTo(bd(34));
        verify(orderListService).upsertShortage(eq(store), eq(milk), eq(bd(6)), isNull(), eq(false), eq(employee), isNull());
        // SOD was untouched and EOD was a first entry -- nothing to audit.
        verify(stockCheckCorrectionRepository, never()).save(any());
    }

    @Test
    void deadStockAboveAvailableIsRejected() {
        assertThatThrownBy(() -> stockCheckService.submitCheck(EMPLOYEE_ID, submit(StockCheckSnapshot.END_OF_DAY, 3, 5)))
            .isInstanceOf(InvalidStockCheckException.class);
        verify(stockCheckRepository, never()).save(any());
    }

    @Test
    void listHistoricalChecksThrowsStoreNotFoundForAnOwnerWithoutAnOwnedStore() {
        when(storeOwnerRepository.findByOwnerId(OWNER_ID)).thenReturn(List.of());

        assertThatThrownBy(() ->
            stockCheckService.listHistoricalChecks(
                OWNER_ID, LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 7), null, null
            )
        ).isInstanceOf(StoreNotFoundException.class);
    }

    @Test
    void listHistoricalChecksForEmployeeChecksStoreAssignmentBeforeQuerying() {
        org.springframework.data.domain.Page<StockCheck> emptyPage =
            new org.springframework.data.domain.PageImpl<>(List.of());
        when(stockCheckRepository.findForStoreInRange(eq(STORE_ID), any(), any(), any())).thenReturn(emptyPage);

        stockCheckService.listHistoricalChecksForEmployee(
            EMPLOYEE_ID, STORE_ID, LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 7), null, null
        );

        verify(userProfileService).requireAssignedStore(EMPLOYEE_ID, STORE_ID);
    }

    @Test
    void listHistoricalChecksForEmployeeRejectsAStoreTheEmployeeIsntAssignedTo() {
        org.mockito.Mockito.doThrow(new StoreNotFoundException("Store not found"))
            .when(userProfileService).requireAssignedStore(EMPLOYEE_ID, STORE_ID);

        assertThatThrownBy(() ->
            stockCheckService.listHistoricalChecksForEmployee(
                EMPLOYEE_ID, STORE_ID, LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 7), null, null
            )
        ).isInstanceOf(StoreNotFoundException.class);
        verify(stockCheckRepository, never()).findForStoreInRange(any(), any(), any(), any());
    }

    @Test
    void correctingAPastEndOfDayAuditsItAndLeavesTheOrderListAlone() {
        milk.setMinWeekday(bd(40));
        milk.setMinWeekend(bd(40));
        StockCheck check = existingCheck(LocalDate.of(2026, 6, 15));
        check.recordSnapshot(StockCheckSnapshot.END_OF_DAY, bd(10), bd(0), employee, OffsetDateTime.now().minusDays(3), false);
        when(stockCheckRepository.findByIdAndStoreId(CHECK_ID, STORE_ID)).thenReturn(Optional.of(check));

        stockCheckService.correctCheck(OWNER_ID, CHECK_ID,
            new StockCheckCorrectionRequest(StockCheckSnapshot.END_OF_DAY, bd(6), bd(1), "Recount after delivery"));

        ArgumentCaptor<StockCheckCorrection> captor = ArgumentCaptor.forClass(StockCheckCorrection.class);
        verify(stockCheckCorrectionRepository).save(captor.capture());
        StockCheckCorrection saved = captor.getValue();
        assertThat(saved.getOriginalCount()).isEqualByComparingTo(bd(10));
        assertThat(saved.getCorrectedCount()).isEqualByComparingTo(bd(6));
        assertThat(saved.getCorrectedDeadStock()).isEqualByComparingTo(bd(1));
        assertThat(saved.getCorrectedByUser()).isEqualTo(owner);
        assertThat(saved.getReason()).isEqualTo("Recount after delivery");

        assertThat(check.getEndOfDayEnteredBy()).isEqualTo(employee);
        assertThat(check.getEndOfDayCheckedBy()).isEqualTo(owner);
        // A past day's shortage never reaches today's order queue.
        verifyNoInteractions(orderListService);
    }

    @Test
    void eodReportKeepsSupplierRecordedOnTheDayAfterPreferredSupplierChanges() {
        Supplier oldSupplier = new Supplier();
        ReflectionTestUtils.setField(oldSupplier, "id", 5L);
        ReflectionTestUtils.setField(oldSupplier, "name", "Old Co");
        Supplier newSupplier = new Supplier();
        ReflectionTestUtils.setField(newSupplier, "id", 6L);
        ReflectionTestUtils.setField(newSupplier, "name", "New Co");

        LocalDate day = LocalDate.of(2026, 6, 15);
        StockCheck milkCheck = existingCheck(day);
        milkCheck.setSupplier(oldSupplier);
        milk.setPreferredSupplier(newSupplier);

        when(storeInventoryItemRepository.findByStoreIdOrderById(STORE_ID)).thenReturn(List.of(milk));
        when(stockCheckRepository.findForStoreOnDate(STORE_ID, day)).thenReturn(List.of(milkCheck));

        EodSupplierReportResponse report = stockCheckService.getEodSupplierReport(OWNER_ID, day);

        assertThat(report.groups()).extracting(EodSupplierReportResponse.Group::supplierName)
            .containsExactly("Old Co");
    }

    @Test
    void eodReportGroupsBySupplierWithNoSupplierLastAndResolvesEachStatus() {
        Supplier dairy = new Supplier();
        ReflectionTestUtils.setField(dairy, "id", 5L);
        ReflectionTestUtils.setField(dairy, "name", "Dairy Co");

        milk.setMinWeekday(bd(40));
        milk.setMinWeekend(bd(40));
        milk.setPreferredSupplier(dairy);

        StoreInventoryItem bread = new StoreInventoryItem();
        ReflectionTestUtils.setField(bread, "id", 21L);
        bread.setStore(store);
        bread.setName("Bread");
        bread.setActive(true);
        bread.setMinWeekday(bd(10));
        bread.setMinWeekend(bd(10));

        StoreInventoryItem retired = new StoreInventoryItem();
        ReflectionTestUtils.setField(retired, "id", 22L);
        retired.setStore(store);
        retired.setName("Retired Item");
        retired.setActive(false);

        LocalDate day = LocalDate.of(2026, 6, 15);
        StockCheck milkCheck = existingCheck(day);
        milkCheck.setSupplier(dairy);
        milkCheck.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(50), bd(2), employee, OffsetDateTime.now(), false);
        milkCheck.recordSnapshot(StockCheckSnapshot.END_OF_DAY, bd(35), bd(1), employee, OffsetDateTime.now(), false);
        milkCheck.setRequiredTomorrow(bd(40));
        milkCheck.setQuantityNeeded(bd(6));

        when(storeInventoryItemRepository.findByStoreIdOrderById(STORE_ID)).thenReturn(List.of(milk, bread, retired));
        when(stockCheckRepository.findForStoreOnDate(STORE_ID, day)).thenReturn(List.of(milkCheck));

        EodSupplierReportResponse report = stockCheckService.getEodSupplierReport(OWNER_ID, day);

        assertThat(report.groups()).extracting(EodSupplierReportResponse.Group::supplierName)
            .containsExactly("Dairy Co", "No Supplier");
        EodSupplierReportResponse.Row milkRow = report.groups().get(0).items().get(0);
        assertThat(milkRow.startOfDayAvailable()).isEqualByComparingTo(bd(50));
        assertThat(milkRow.endOfDayAvailable()).isEqualByComparingTo(bd(35));
        assertThat(milkRow.stockUsed()).isEqualByComparingTo(bd(14));
        assertThat(milkRow.endOfDayDeadStock()).isEqualByComparingTo(bd(1));
        assertThat(milkRow.quantityToOrder()).isEqualByComparingTo(bd(6));
        assertThat(milkRow.status()).isEqualTo(EodSupplierReportResponse.Status.NEEDS_TO_ORDER);

        // Bread is active but uncounted; the inactive, uncounted item is left out.
        List<EodSupplierReportResponse.Row> noSupplier = report.groups().get(1).items();
        assertThat(noSupplier).extracting(EodSupplierReportResponse.Row::itemName).containsExactly("Bread");
        assertThat(noSupplier.get(0).status()).isEqualTo(EodSupplierReportResponse.Status.END_OF_DAY_PENDING);
        assertThat(noSupplier.get(0).requiredTomorrow()).isEqualByComparingTo(bd(10));

        assertThat(report.itemsNeedingOrder()).isEqualTo(1);
        assertThat(report.itemsPendingEndOfDay()).isEqualTo(1);
    }

    @Test
    void eodReportRejectsAFutureDate() {
        assertThatThrownBy(() -> stockCheckService.getEodSupplierReport(OWNER_ID, LocalDate.now().plusDays(1)))
            .isInstanceOf(InvalidStockCheckException.class);
    }

    @Test
    void endOfDayAtOrAboveTomorrowsMinimumResolvesAnyOutstandingOrder() {
        milk.setMinWeekday(bd(20));
        milk.setMinWeekend(bd(20));
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now()))
            .thenReturn(Optional.empty());

        StockCheckResponse response = stockCheckService.submitCheck(EMPLOYEE_ID, submit(StockCheckSnapshot.END_OF_DAY, 25, 0));

        assertThat(response.quantityToOrder()).isEqualByComparingTo(bd(0));
        verify(orderListService, never()).upsertShortage(any(), any(), any(java.math.BigDecimal.class), any(), anyBoolean(), any(), any());
        verify(orderListService).resolveShortageIfPresent(store, milk);
    }

    @Test
    void startOfDayNeverTouchesTheOrderList() {
        milk.setMinWeekday(bd(20));
        milk.setMinWeekend(bd(20));
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now()))
            .thenReturn(Optional.empty());

        stockCheckService.submitCheck(EMPLOYEE_ID, submit(StockCheckSnapshot.START_OF_DAY, 5, 0));

        verifyNoInteractions(orderListService);
    }

    @Test
    void correctingTodaysEndOfDayToMeetTheMinimumResolvesAnyOutstandingOrder() {
        milk.setMinWeekday(bd(20));
        milk.setMinWeekend(bd(20));
        StockCheck check = existingCheck(LocalDate.now());
        check.recordSnapshot(StockCheckSnapshot.END_OF_DAY, bd(15), bd(0), employee, OffsetDateTime.now().minusHours(1), false);
        check.setQuantityNeeded(bd(5));
        when(stockCheckRepository.findByIdAndStoreId(CHECK_ID, STORE_ID)).thenReturn(Optional.of(check));

        stockCheckService.correctCheck(OWNER_ID, CHECK_ID,
            new StockCheckCorrectionRequest(StockCheckSnapshot.END_OF_DAY, bd(20), bd(0), "Recounted"));

        verify(orderListService).resolveShortageIfPresent(store, milk);
        verify(orderListService, never()).upsertShortage(any(), any(), any(java.math.BigDecimal.class), any(), anyBoolean(), any(), any());
    }

    @Test
    void correctingTheSameCheckTwiceProducesTwoSeparateAuditRows() {
        StockCheck check = existingCheck(LocalDate.of(2026, 6, 15));
        check.recordSnapshot(StockCheckSnapshot.END_OF_DAY, bd(10), bd(0), employee, OffsetDateTime.now().minusDays(3), false);
        when(stockCheckRepository.findByIdAndStoreId(CHECK_ID, STORE_ID)).thenReturn(Optional.of(check));

        stockCheckService.correctCheck(OWNER_ID, CHECK_ID,
            new StockCheckCorrectionRequest(StockCheckSnapshot.END_OF_DAY, bd(6), bd(1), "First correction"));
        stockCheckService.correctCheck(OWNER_ID, CHECK_ID,
            new StockCheckCorrectionRequest(StockCheckSnapshot.END_OF_DAY, bd(8), bd(0), "Second correction"));

        ArgumentCaptor<StockCheckCorrection> captor = ArgumentCaptor.forClass(StockCheckCorrection.class);
        verify(stockCheckCorrectionRepository, times(2)).save(captor.capture());
        List<StockCheckCorrection> saved = captor.getAllValues();
        assertThat(saved).hasSize(2);
        assertThat(saved.get(0).getOriginalCount()).isEqualByComparingTo(bd(10));
        assertThat(saved.get(0).getCorrectedCount()).isEqualByComparingTo(bd(6));
        assertThat(saved.get(0).getReason()).isEqualTo("First correction");
        assertThat(saved.get(1).getOriginalCount()).isEqualByComparingTo(bd(6));
        assertThat(saved.get(1).getCorrectedCount()).isEqualByComparingTo(bd(8));
        assertThat(saved.get(1).getReason()).isEqualTo("Second correction");
    }

    @Test
    void correctCheckRejectsAnotherStoresCheck() {
        when(stockCheckRepository.findByIdAndStoreId(CHECK_ID, STORE_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> stockCheckService.correctCheck(OWNER_ID, CHECK_ID,
            new StockCheckCorrectionRequest(StockCheckSnapshot.END_OF_DAY, bd(6), bd(1), "Recount")))
            .isInstanceOf(StoreInventoryItemNotFoundException.class);
    }

    // ---- RTS-69: correcting a snapshot that was never recorded -------------

    @Test
    void correctingANeverRecordedSnapshotAuditsItWithNoOriginalValueAndDoesNotClaimEnteredBy() {
        StockCheck check = existingCheck(LocalDate.of(2026, 6, 15));
        when(stockCheckRepository.findByIdAndStoreId(CHECK_ID, STORE_ID)).thenReturn(Optional.of(check));

        stockCheckService.correctCheck(OWNER_ID, CHECK_ID,
            new StockCheckCorrectionRequest(StockCheckSnapshot.START_OF_DAY, bd(12), bd(0), "Backfilled missed count"));

        ArgumentCaptor<StockCheckCorrection> captor = ArgumentCaptor.forClass(StockCheckCorrection.class);
        verify(stockCheckCorrectionRepository).save(captor.capture());
        StockCheckCorrection saved = captor.getValue();
        assertThat(saved.getOriginalCount()).isNull();
        assertThat(saved.getCorrectedCount()).isEqualByComparingTo(bd(12));
        assertThat(saved.getCorrectedByUser()).isEqualTo(owner);

        // A correction never claims credit for the original entry -- there
        // wasn't one.
        assertThat(check.getStartOfDayEnteredBy()).isNull();
        assertThat(check.getStartOfDayEnteredAt()).isNull();
        assertThat(check.getStartOfDayAvailable()).isEqualByComparingTo(bd(12));
    }

    @Test
    void anEmployeeEnteringTheRealCountAfterAnAdminBackfillGetsCreditedAsTheEnterer() {
        StockCheck check = existingCheck(LocalDate.now());
        when(stockCheckRepository.findByIdAndStoreId(CHECK_ID, STORE_ID)).thenReturn(Optional.of(check));
        stockCheckService.correctCheck(OWNER_ID, CHECK_ID,
            new StockCheckCorrectionRequest(StockCheckSnapshot.START_OF_DAY, bd(12), bd(0), "Backfilled missed count"));

        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now()))
            .thenReturn(Optional.of(check));

        stockCheckService.submitCheck(EMPLOYEE_ID,
            new StockCheckSubmitRequest(STORE_ID, ITEM_ID, StockCheckSnapshot.START_OF_DAY, bd(15), bd(1)));

        assertThat(check.getStartOfDayEnteredBy()).isEqualTo(employee);
        assertThat(check.getStartOfDayEnteredAt()).isNotNull();
        assertThat(check.getStartOfDayAvailable()).isEqualByComparingTo(bd(15));

        ArgumentCaptor<StockCheckCorrection> captor = ArgumentCaptor.forClass(StockCheckCorrection.class);
        verify(stockCheckCorrectionRepository, times(2)).save(captor.capture());
        StockCheckCorrection employeeEntry = captor.getAllValues().get(1);
        assertThat(employeeEntry.getOriginalCount()).isEqualByComparingTo(bd(12));
        assertThat(employeeEntry.getCorrectedCount()).isEqualByComparingTo(bd(15));
        assertThat(employeeEntry.getCorrectedByUser()).isEqualTo(employee);
    }

    @Test
    void correctCheckReturnsItsOwnUpdatedEditsWithoutARefetch() {
        StockCheck check = existingCheck(LocalDate.of(2026, 6, 15));
        check.recordSnapshot(StockCheckSnapshot.END_OF_DAY, bd(10), bd(0), employee, OffsetDateTime.now().minusDays(3), false);
        when(stockCheckRepository.findByIdAndStoreId(CHECK_ID, STORE_ID)).thenReturn(Optional.of(check));

        StockCheckCorrection correction = new StockCheckCorrection();
        correction.setStockCheck(check);
        correction.setSnapshot(StockCheckSnapshot.END_OF_DAY);
        correction.setOriginalCount(bd(10));
        correction.setCorrectedCount(bd(6));
        correction.setCorrectedByUser(owner);
        correction.setCorrectedAt(OffsetDateTime.now());
        when(stockCheckCorrectionRepository.findWithEditorByStockCheckIds(List.of(CHECK_ID)))
            .thenReturn(List.of(correction));

        StockCheckResponse response = stockCheckService.correctCheck(OWNER_ID, CHECK_ID,
            new StockCheckCorrectionRequest(StockCheckSnapshot.END_OF_DAY, bd(6), bd(1), "Recount"));

        assertThat(response.edits()).hasSize(1);
        assertThat(response.edits().get(0).newAvailable()).isEqualByComparingTo(bd(6));
    }

    // ---- Inventory Counts (live per-item status) ---------------------------

    private StockCheck checkWithCount(StoreInventoryItem item, LocalDate date, int available, int dead) {
        StockCheck check = new StockCheck();
        check.setStore(store);
        check.setStoreInventoryItem(item);
        check.setCheckDate(date);
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(available), bd(dead), employee, OffsetDateTime.now(), false);
        return check;
    }

    @Test
    void inventoryCountsClassifiesEachRowByFreshnessThenStockLevel() {
        milk.setMinWeekday(bd(10));
        milk.setMinWeekend(bd(10));
        StockCheck staleButWouldBeOutOfStock = checkWithCount(milk, LocalDate.now().minusDays(1), 0, 0);

        StoreInventoryItem eggs = new StoreInventoryItem();
        ReflectionTestUtils.setField(eggs, "id", 23L);
        eggs.setStore(store);
        eggs.setName("Eggs");
        eggs.setMinWeekday(bd(10));
        eggs.setMinWeekend(bd(10));
        StockCheck outToday = checkWithCount(eggs, LocalDate.now(), 0, 0);

        StoreInventoryItem bread = new StoreInventoryItem();
        ReflectionTestUtils.setField(bread, "id", 24L);
        bread.setStore(store);
        bread.setName("Bread");
        bread.setMinWeekday(bd(10));
        bread.setMinWeekend(bd(10));
        StockCheck lowToday = checkWithCount(bread, LocalDate.now(), 5, 0);

        StoreInventoryItem butter = new StoreInventoryItem();
        ReflectionTestUtils.setField(butter, "id", 25L);
        butter.setStore(store);
        butter.setName("Butter");
        butter.setMinWeekday(bd(10));
        butter.setMinWeekend(bd(10));
        StockCheck healthyToday = checkWithCount(butter, LocalDate.now(), 20, 0);

        when(storeInventoryItemRepository.findByStoreIdAndActiveTrueOrderById(STORE_ID))
            .thenReturn(List.of(milk, eggs, bread, butter));
        when(stockCheckRepository.findLatestPerItemForStore(STORE_ID))
            .thenReturn(List.of(staleButWouldBeOutOfStock, outToday, lowToday, healthyToday));
        when(stockCheckRepository.findRecentForItem(any(), any(Pageable.class))).thenReturn(List.of());

        InventoryCountsPageResponse page = stockCheckService.listInventoryCounts(OWNER_ID, null, null, null, null, null);

        assertThat(page.rows()).extracting(InventoryCountRowResponse::name, InventoryCountRowResponse::status)
            .containsExactlyInAnyOrder(
                Tuple.tuple("Milk", InventoryCountStatus.STALE),
                Tuple.tuple("Eggs", InventoryCountStatus.OUT_OF_STOCK),
                Tuple.tuple("Bread", InventoryCountStatus.LOW),
                Tuple.tuple("Butter", InventoryCountStatus.HEALTHY)
            );
        assertThat(page.allCount()).isEqualTo(4);
        assertThat(page.outCount()).isEqualTo(1);
        assertThat(page.lowCount()).isEqualTo(1);
        assertThat(page.staleCount()).isEqualTo(1);
    }

    @Test
    void inventoryCountsShowsAnItemWithNoCheckAtAllAsStaleWithNullStock() {
        when(storeInventoryItemRepository.findByStoreIdAndActiveTrueOrderById(STORE_ID)).thenReturn(List.of(milk));
        when(stockCheckRepository.findLatestPerItemForStore(STORE_ID)).thenReturn(List.of());

        InventoryCountsPageResponse page = stockCheckService.listInventoryCounts(OWNER_ID, null, null, null, null, null);

        InventoryCountRowResponse row = page.rows().get(0);
        assertThat(row.status()).isEqualTo(InventoryCountStatus.STALE);
        assertThat(row.currentStock()).isNull();
        assertThat(row.lastUpdatedAt()).isNull();
        assertThat(row.latestCheckId()).isNull();
    }

    @Test
    void inventoryCountsComputesChangeAgainstThePreviousCount() {
        StockCheck today = checkWithCount(milk, LocalDate.now(), 30, 0);
        StockCheck yesterday = checkWithCount(milk, LocalDate.now().minusDays(1), 24, 0);

        when(storeInventoryItemRepository.findByStoreIdAndActiveTrueOrderById(STORE_ID)).thenReturn(List.of(milk));
        when(stockCheckRepository.findLatestPerItemForStore(STORE_ID)).thenReturn(List.of(today));
        when(stockCheckRepository.findRecentForItem(eq(ITEM_ID), any(Pageable.class))).thenReturn(List.of(today, yesterday));

        InventoryCountRowResponse row = stockCheckService.listInventoryCounts(OWNER_ID, null, null, null, null, null)
            .rows().get(0);

        assertThat(row.change()).isEqualByComparingTo(bd(6));
        assertThat(row.changeFromDate()).isEqualTo(LocalDate.now().minusDays(1));
    }

    @Test
    void inventoryCountsFiltersBySearchCategoryAndLevelWithoutChangingKpiCounts() {
        milk.setCategory("DAIRY");
        StockCheck milkCheck = checkWithCount(milk, LocalDate.now(), 0, 0);

        StoreInventoryItem apples = new StoreInventoryItem();
        ReflectionTestUtils.setField(apples, "id", 26L);
        apples.setStore(store);
        apples.setName("Apples");
        apples.setCategory("FRUITS");
        StockCheck applesCheck = checkWithCount(apples, LocalDate.now(), 50, 0);

        when(storeInventoryItemRepository.findByStoreIdAndActiveTrueOrderById(STORE_ID)).thenReturn(List.of(milk, apples));
        when(stockCheckRepository.findLatestPerItemForStore(STORE_ID)).thenReturn(List.of(milkCheck, applesCheck));
        when(stockCheckRepository.findRecentForItem(any(), any(Pageable.class))).thenReturn(List.of());

        InventoryCountsPageResponse byName = stockCheckService.listInventoryCounts(OWNER_ID, "milk", null, null, null, null);
        assertThat(byName.rows()).extracting(InventoryCountRowResponse::name).containsExactly("Milk");
        assertThat(byName.allCount()).isEqualTo(2);

        InventoryCountsPageResponse byCategory = stockCheckService.listInventoryCounts(
            OWNER_ID, null, "FRUITS", null, null, null);
        assertThat(byCategory.rows()).extracting(InventoryCountRowResponse::name).containsExactly("Apples");

        InventoryCountsPageResponse byLevel = stockCheckService.listInventoryCounts(OWNER_ID, null, null, "out", null, null);
        assertThat(byLevel.rows()).extracting(InventoryCountRowResponse::name).containsExactly("Milk");
        assertThat(byLevel.allCount()).isEqualTo(2);
        assertThat(byLevel.outCount()).isEqualTo(1);
    }

    @Test
    void inventoryCountsPaginatesTheFilteredRows() {
        StoreInventoryItem apples = new StoreInventoryItem();
        ReflectionTestUtils.setField(apples, "id", 26L);
        apples.setStore(store);
        apples.setName("Apples");

        when(storeInventoryItemRepository.findByStoreIdAndActiveTrueOrderById(STORE_ID)).thenReturn(List.of(milk, apples));
        when(stockCheckRepository.findLatestPerItemForStore(STORE_ID)).thenReturn(List.of());
        when(stockCheckRepository.findRecentForItem(any(), any(Pageable.class))).thenReturn(List.of());

        InventoryCountsPageResponse page = stockCheckService.listInventoryCounts(OWNER_ID, null, null, null, 2, 1);

        assertThat(page.rows()).hasSize(1);
        assertThat(page.page()).isEqualTo(2);
        assertThat(page.totalPages()).isEqualTo(2);
        assertThat(page.totalElements()).isEqualTo(2);
    }

    @Test
    void countHistoryReturnsNewestFirstWithDeltaAgainstTheNextOlderEntry() {
        StockCheck newest = checkWithCount(milk, LocalDate.now(), 30, 0);
        StockCheck middle = checkWithCount(milk, LocalDate.now().minusDays(1), 24, 0);
        StockCheck oldest = checkWithCount(milk, LocalDate.now().minusDays(2), 20, 0);
        when(storeInventoryItemRepository.findByIdAndStoreId(ITEM_ID, STORE_ID)).thenReturn(Optional.of(milk));
        when(stockCheckRepository.findRecentForItem(eq(ITEM_ID), any(Pageable.class)))
            .thenReturn(List.of(newest, middle, oldest));

        List<InventoryCountHistoryEntryResponse> history = stockCheckService.getCountHistory(OWNER_ID, ITEM_ID);

        assertThat(history).hasSize(3);
        assertThat(history.get(0).count()).isEqualByComparingTo(bd(30));
        assertThat(history.get(0).delta()).isEqualByComparingTo(bd(6));
        assertThat(history.get(1).delta()).isEqualByComparingTo(bd(4));
        assertThat(history.get(2).delta()).isNull();
    }

    @Test
    void countHistoryThrowsWhenTheItemBelongsToAnotherStore() {
        when(storeInventoryItemRepository.findByIdAndStoreId(ITEM_ID, STORE_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> stockCheckService.getCountHistory(OWNER_ID, ITEM_ID))
            .isInstanceOf(StoreInventoryItemNotFoundException.class);
    }

    @Test
    void decimalQuantitiesRoundTripThroughSubmitAndDriveTheOrderQuantity() {
        milk.setMinWeekday(bd("3.00"));
        milk.setMinWeekend(bd("3.00"));
        StockCheck check = existingCheck(LocalDate.now());
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd("5.00"), bd("0.50"), employee,
            OffsetDateTime.now().minusHours(9), false);
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now()))
            .thenReturn(Optional.of(check));

        StockCheckResponse response = stockCheckService.submitCheck(EMPLOYEE_ID,
            new StockCheckSubmitRequest(STORE_ID, ITEM_ID, StockCheckSnapshot.END_OF_DAY, bd("1.50"), bd("0.25")));

        assertThat(response.endOfDay().available()).isEqualByComparingTo("1.50");
        assertThat(response.endOfDay().deadStock()).isEqualByComparingTo("0.25");
        assertThat(response.endOfDay().usable()).isEqualByComparingTo("1.25");
        // SOD usable 4.50 - EOD usable 1.25
        assertThat(response.stockUsed()).isEqualByComparingTo("3.25");
        assertThat(response.requiredTomorrow()).isEqualByComparingTo("3.00");
        assertThat(response.quantityToOrder()).isEqualByComparingTo("1.75");
        verify(orderListService).upsertShortage(eq(store), eq(milk),
            org.mockito.ArgumentMatchers.argThat(q -> q != null && q.compareTo(bd("1.75")) == 0),
            isNull(), eq(false), eq(employee), isNull());
    }

    @Test
    void resavingIdenticalValuesIsRejectedAndWritesNoAuditRow() {
        StockCheck check = existingCheck(LocalDate.now());
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd("10.00"), bd("1.00"), employee,
            OffsetDateTime.now().minusHours(3), false);
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now()))
            .thenReturn(Optional.of(check));

        // Different scale, same value -- compareTo-equal must count as unchanged.
        assertThatThrownBy(() -> stockCheckService.submitCheck(EMPLOYEE_ID,
            new StockCheckSubmitRequest(STORE_ID, ITEM_ID, StockCheckSnapshot.START_OF_DAY, bd("10"), bd("1"))))
            .isInstanceOf(InvalidStockCheckException.class)
            .hasMessage("No changes to save - the values are the same as the current ones");

        verify(stockCheckCorrectionRepository, never()).save(any());
        verify(stockCheckRepository, never()).save(any(StockCheck.class));
    }

    @Test
    void correctingWithIdenticalValuesIsRejectedAndWritesNoAuditRow() {
        StockCheck check = existingCheck(LocalDate.of(2026, 6, 15));
        check.recordSnapshot(StockCheckSnapshot.END_OF_DAY, bd("10.00"), bd("0.00"), employee,
            OffsetDateTime.now().minusDays(3), false);
        when(stockCheckRepository.findByIdAndStoreId(CHECK_ID, STORE_ID)).thenReturn(Optional.of(check));

        // Omitted dead stock on a previously-zero snapshot is unchanged too.
        assertThatThrownBy(() -> stockCheckService.correctCheck(OWNER_ID, CHECK_ID,
            new StockCheckCorrectionRequest(StockCheckSnapshot.END_OF_DAY, bd("10.00"), bd("0"), "Same")))
            .isInstanceOf(InvalidStockCheckException.class);

        verify(stockCheckCorrectionRepository, never()).save(any());
    }
}
