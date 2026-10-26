package com.nforce.retailops.service;

import static com.nforce.retailops.TestDecimals.bd;
import com.nforce.retailops.dto.EodSupplierReportResponse;
import com.nforce.retailops.dto.InventoryCountHistoryEntryResponse;
import com.nforce.retailops.dto.InventoryCountRowResponse;
import com.nforce.retailops.dto.InventoryCountStatus;
import com.nforce.retailops.dto.InventoryCountsPageResponse;
import com.nforce.retailops.dto.InventoryCountSource;
import com.nforce.retailops.dto.OrderListEntryResponse;
import com.nforce.retailops.dto.StockCheckCorrectionRequest;
import com.nforce.retailops.dto.StockCheckResponse;
import com.nforce.retailops.dto.StockCheckSubmitRequest;
import com.nforce.retailops.entity.StockCheck;
import com.nforce.retailops.entity.StockCheckCorrection;
import com.nforce.retailops.entity.StockCheckReceipt;
import com.nforce.retailops.entity.StockCheckSnapshot;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.Supplier;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.dto.AdHocShortageRequest;
import com.nforce.retailops.exception.InvalidStockCheckException;
import com.nforce.retailops.exception.StockCheckLockedException;
import com.nforce.retailops.exception.StoreInventoryItemNotFoundException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.StockCheckCorrectionRepository;
import com.nforce.retailops.repository.StockCheckReceiptRepository;
import com.nforce.retailops.repository.StockCheckRepository;
import com.nforce.retailops.repository.StockReceiptRequestRepository;
import com.nforce.retailops.repository.StockShortageReportRepository;
import com.nforce.retailops.entity.OrderListEntry;
import com.nforce.retailops.entity.OrderStatus;
import com.nforce.retailops.entity.StockReceiptRequest;
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
import java.util.Map;
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
    @Mock private StockCheckReceiptRepository stockCheckReceiptRepository;
    @Mock private UserRepository userRepository;
    @Mock private StoreOwnerRepository storeOwnerRepository;
    @Mock private OrderListService orderListService;
    @Mock private UserProfileService userProfileService;
    @Mock private StockReceiptRequestRepository stockReceiptRequestRepository;
    @Mock private StockShortageReportRepository stockShortageReportRepository;
    @Mock private NotificationService notificationService;

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
        // Reconciled with no shortage: nothing raised.
        verify(orderListService).reconcileStartOfDayShortage(
            eq(store), eq(milk), org.mockito.ArgumentMatchers.argThat(q -> q.signum() == 0), eq(false), eq(employee), isNull());
        verify(orderListService, never()).upsertShortage(any(), any(), any(java.math.BigDecimal.class), any(), anyBoolean(), any(), any());
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

    private StockCheck checkWithStartOfDay(int available, int dead) {
        StockCheck check = existingCheck(LocalDate.now());
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(available), bd(dead), employee, OffsetDateTime.now().minusHours(6), false);
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now()))
            .thenReturn(Optional.of(check));
        return check;
    }

    @Test
    void midDayShortageBanksUsageSoFarAndRaisesTheOrder() {
        milk.setMinWeekday(bd(35));
        milk.setMinWeekend(bd(35));
        StockCheck check = checkWithStartOfDay(50, 2);

        stockCheckService.reportAdHocShortage(EMPLOYEE_ID, STORE_ID, new AdHocShortageRequest(ITEM_ID, bd(20), "rush", null));

        // Start usable 48, 20 left now -> 28 used so far; the count follows.
        assertThat(check.midDayUsage()).isEqualByComparingTo(bd(28));
        assertThat(check.getCurrentCount()).isEqualByComparingTo(bd(20));
        // Required comes from today's minimum (35) less the 20 left, not from the employee.
        verify(orderListService).upsertReportedShortage(eq(store), eq(milk), eq(bd(15)), eq("rush"), eq(employee), any(), eq(false), eq(false));
    }

    @Test
    void midDayShortageNotifiesTheStoreOwner() {
        milk.setMinWeekday(bd(35));
        milk.setMinWeekend(bd(35));
        checkWithStartOfDay(50, 2);
        StoreOwner activeOwner = new StoreOwner();
        activeOwner.setOwner(owner);
        when(storeOwnerRepository.findByStoreIdAndActiveTrue(STORE_ID)).thenReturn(Optional.of(activeOwner));
        when(orderListService.upsertReportedShortage(any(), any(), any(), any(), any(), any(), anyBoolean(), anyBoolean()))
            .thenReturn(new OrderListEntry());

        stockCheckService.reportAdHocShortage(EMPLOYEE_ID, STORE_ID, new AdHocShortageRequest(ITEM_ID, bd(20), "rush", null));

        verify(notificationService).notifyOwnerOfReportedShortage(
            eq(milk), eq(employee), eq(bd(20)), eq(bd(15)), eq(true), eq("rush"), eq(owner));
    }

    @Test
    void midDayZeroStockSendsTheUrgentOutOfStockNotificationInstead() {
        milk.setMinWeekday(bd(8));
        milk.setMinWeekend(bd(8));
        checkWithStartOfDay(3, 0);
        StoreOwner activeOwner = new StoreOwner();
        activeOwner.setOwner(owner);
        when(storeOwnerRepository.findByStoreIdAndActiveTrue(STORE_ID)).thenReturn(Optional.of(activeOwner));

        stockCheckService.reportAdHocShortage(EMPLOYEE_ID, STORE_ID, new AdHocShortageRequest(ITEM_ID, bd(0), null, null));

        verify(orderListService).upsertReportedShortage(eq(store), eq(milk), eq(bd(8)), any(), eq(employee), any(), eq(false), eq(true));
        verify(notificationService).notifyOwnerOfStockOut(eq(milk), eq(employee), any(), eq(owner));
        verify(notificationService, never()).notifyOwnerOfReportedShortage(any(), any(), any(), any(), anyBoolean(), any(), any());
    }

    @Test
    void startOfDayZeroCountFlagsUrgentAndNotifiesTheOwnerWhenNewlyUrgent() {
        milk.setMinWeekday(bd(8));
        milk.setMinWeekend(bd(8));
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now()))
            .thenReturn(Optional.empty());
        StoreOwner activeOwner = new StoreOwner();
        activeOwner.setOwner(owner);
        when(storeOwnerRepository.findByStoreIdAndActiveTrue(STORE_ID)).thenReturn(Optional.of(activeOwner));
        when(orderListService.reconcileStartOfDayShortage(any(), any(), any(), anyBoolean(), any(), any())).thenReturn(true);

        stockCheckService.submitCheck(EMPLOYEE_ID, submit(StockCheckSnapshot.START_OF_DAY, 0, 0));

        verify(orderListService).reconcileStartOfDayShortage(eq(store), eq(milk), eq(bd(8)), eq(true), eq(employee), isNull());
        verify(notificationService).notifyOwnerOfStockOut(eq(milk), eq(employee), any(), eq(owner));
    }

    @Test
    void midDayShortageStillNotifiesWhenExistingOrdersAlreadyCoverIt() {
        milk.setMinWeekday(bd(35));
        milk.setMinWeekend(bd(35));
        checkWithStartOfDay(50, 2);
        StoreOwner activeOwner = new StoreOwner();
        activeOwner.setOwner(owner);
        when(storeOwnerRepository.findByStoreIdAndActiveTrue(STORE_ID)).thenReturn(Optional.of(activeOwner));
        when(orderListService.upsertReportedShortage(any(), any(), any(), any(), any(), any(), anyBoolean(), anyBoolean()))
            .thenReturn(null);

        stockCheckService.reportAdHocShortage(EMPLOYEE_ID, STORE_ID, new AdHocShortageRequest(ITEM_ID, bd(20), null, null));

        verify(notificationService).notifyOwnerOfReportedShortage(
            eq(milk), eq(employee), eq(bd(20)), eq(bd(15)), eq(false), isNull(), eq(owner));
    }

    @Test
    void endOfDayAddsUsageSinceTheMidDayReportToTheBankedUsage() {
        milk.setMinWeekday(bd(40));
        milk.setMinWeekend(bd(40));
        StockCheck check = checkWithStartOfDay(50, 2);
        stockCheckService.reportAdHocShortage(EMPLOYEE_ID, STORE_ID, new AdHocShortageRequest(ITEM_ID, bd(20), null, null));

        // 15 of the 20 were sold after the report, none delivered.
        StockCheckResponse response = stockCheckService.submitCheck(EMPLOYEE_ID, submit(StockCheckSnapshot.END_OF_DAY, 5, 0));

        assertThat(response.stockUsed()).isEqualByComparingTo(bd(43));
    }

    @Test
    void deliveryAfterTheMidDayReportIsExcludedFromUsageOnce() {
        StockCheck check = checkWithStartOfDay(50, 0);
        check.addReceived(bd(10));
        stockCheckService.reportAdHocShortage(EMPLOYEE_ID, STORE_ID, new AdHocShortageRequest(ITEM_ID, bd(30), null, null));
        // Expected 60 at the report, 30 left -> 30 used so far.
        assertThat(check.midDayUsage()).isEqualByComparingTo(bd(30));

        check.addReceived(bd(12));
        assertThat(check.getCurrentCount()).isEqualByComparingTo(bd(42));

        StockCheckResponse response = stockCheckService.submitCheck(EMPLOYEE_ID, submit(StockCheckSnapshot.END_OF_DAY, 40, 0));

        // 30 banked + (30 + 12 delivered - 40) = 32 in total, same as 50 + 22 - 40.
        assertThat(response.stockUsed()).isEqualByComparingTo(bd(32));
    }

    @Test
    void midDayShortageNeedsStartOfDayAndIsClosedOnceEndOfDayIsSaved() {
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> stockCheckService.reportAdHocShortage(
            EMPLOYEE_ID, STORE_ID, new AdHocShortageRequest(ITEM_ID, bd(5), null, null)))
            .isInstanceOf(com.nforce.retailops.exception.InventoryItemNotAssignedException.class);

        StockCheck check = checkWithStartOfDay(50, 0);
        check.recordSnapshot(StockCheckSnapshot.END_OF_DAY, bd(10), bd(0), employee, OffsetDateTime.now(), false);
        assertThatThrownBy(() -> stockCheckService.reportAdHocShortage(
            EMPLOYEE_ID, STORE_ID, new AdHocShortageRequest(ITEM_ID, bd(5), null, null)))
            .isInstanceOf(InvalidStockCheckException.class);
        verify(orderListService, never()).upsertReportedShortage(any(), any(), any(), any(), any(), any(), anyBoolean(), anyBoolean());
    }

    @Test
    void midDayShortageMustBeBelowTheExpectedOnHand() {
        milk.setMinWeekday(bd(100));
        milk.setMinWeekend(bd(100));
        checkWithStartOfDay(20, 0);

        assertThatThrownBy(() -> stockCheckService.reportAdHocShortage(
            EMPLOYEE_ID, STORE_ID, new AdHocShortageRequest(ITEM_ID, bd(20), null, null)))
            .isInstanceOf(InvalidStockCheckException.class);
        verify(orderListService, never()).upsertReportedShortage(any(), any(), any(), any(), any(), any(), anyBoolean(), anyBoolean());
    }

    @Test
    void endOfDayAboveStartOfDayWithNoOrderedOrderIsRefused() {
        StockCheck check = existingCheck(LocalDate.now());
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(10), bd(0), employee, OffsetDateTime.now().minusHours(9), false);
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now()))
            .thenReturn(Optional.of(check));

        assertThatThrownBy(() -> stockCheckService.submitCheck(EMPLOYEE_ID,
            new StockCheckSubmitRequest(STORE_ID, ITEM_ID, StockCheckSnapshot.END_OF_DAY, bd(20), bd(0), null)))
            .isInstanceOf(InvalidStockCheckException.class)
            .hasMessageContaining("End of Day cannot be greater than Start of Day");
        verify(stockReceiptRequestRepository, never()).save(any(StockReceiptRequest.class));
    }

    @Test
    void endOfDayTotalAboveStartOfDayIsRefusedEvenWhenTheExtraIsEnteredAsDeadStock() {
        StockCheck check = existingCheck(LocalDate.now());
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(11), bd(0), employee, OffsetDateTime.now().minusHours(9), false);
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now()))
            .thenReturn(Optional.of(check));

        // Usable 12 - 2 = 10 sits below the opening 11, but the total rose
        // from 11 to 12 with nothing received.
        assertThatThrownBy(() -> stockCheckService.submitCheck(EMPLOYEE_ID,
            new StockCheckSubmitRequest(STORE_ID, ITEM_ID, StockCheckSnapshot.END_OF_DAY, bd(12), bd(2), null)))
            .isInstanceOf(InvalidStockCheckException.class)
            .hasMessageContaining("End of Day cannot be greater than Start of Day");
        assertThat(check.getEndOfDayAvailable()).isNull();
        verify(stockReceiptRequestRepository, never()).save(any(StockReceiptRequest.class));
    }

    @Test
    void endOfDayTotalEqualToStartOfDayWithSomeSpoiledIsAccepted() {
        checkWithStartOfDay(11, 0);

        StockCheckResponse response = stockCheckService.submitCheck(EMPLOYEE_ID, submit(StockCheckSnapshot.END_OF_DAY, 11, 2));

        // Same 11 on hand, 2 of them spoiled: 11 - 9 = 2 counted as used.
        assertThat(response.stockUsed()).isEqualByComparingTo(bd(2));
    }

    @Test
    void endOfDayTotalAboveStartOfDayIsAcceptedWhenTheDeliveryExplainsIt() {
        StockCheck check = checkWithStartOfDay(11, 0);
        check.addReceived(bd(1));

        StockCheckResponse response = stockCheckService.submitCheck(EMPLOYEE_ID, submit(StockCheckSnapshot.END_OF_DAY, 12, 2));

        assertThat(response.stockUsed()).isEqualByComparingTo(bd(2));
    }

    @Test
    void endOfDayAboveStartOfDayWithReceivedStockOnlyCreatesAPendingRequestAndNotifiesTheOwner() {
        StockCheck check = existingCheck(LocalDate.now());
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(10), bd(0), employee, OffsetDateTime.now().minusHours(9), false);
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now()))
            .thenReturn(Optional.of(check));
        when(stockReceiptRequestRepository.save(any(StockReceiptRequest.class))).thenAnswer(i -> i.getArgument(0));
        StoreOwner activeOwner = new StoreOwner();
        activeOwner.setOwner(owner);
        when(storeOwnerRepository.findByStoreIdAndActiveTrue(STORE_ID)).thenReturn(Optional.of(activeOwner));
        OrderListEntry order = new OrderListEntry();
        order.setQuantityNeeded(bd(15));
        when(orderListService.requireOrderedEntry(STORE_ID, ITEM_ID, 77L)).thenReturn(order);

        StockCheckResponse response = stockCheckService.submitCheck(EMPLOYEE_ID,
            new StockCheckSubmitRequest(STORE_ID, ITEM_ID, StockCheckSnapshot.END_OF_DAY, bd(20), bd(0), null, null,
                List.of(new StockCheckSubmitRequest.ReceivedItem(77L, bd(15)))));

        // The count itself is only trustworthy once the declared delivery is
        // approved, so it is held on the request rather than saved: End of Day
        // stays unset, received stays 0, and no receipt row is written yet.
        assertThat(check.getEndOfDayAvailable()).isNull();
        assertThat(response.endOfDay()).isNull();
        assertThat(response.quantityReceived()).isEqualByComparingTo(bd(0));
        verify(stockCheckRepository, never()).save(any(StockCheck.class));
        verify(stockCheckReceiptRepository, never()).save(any());
        ArgumentCaptor<StockReceiptRequest> request = ArgumentCaptor.forClass(StockReceiptRequest.class);
        verify(stockReceiptRequestRepository).save(request.capture());
        assertThat(request.getValue().getQuantity()).isEqualByComparingTo(bd(15));
        assertThat(request.getValue().getOrderListEntry()).isSameAs(order);
        assertThat(request.getValue().isPending()).isTrue();
        assertThat(request.getValue().getRequestedBy()).isEqualTo(employee);
        assertThat(request.getValue().isHoldsSnapshot()).isTrue();
        assertThat(request.getValue().getPendingAvailable()).isEqualByComparingTo(bd(20));
        verify(notificationService).notifyOwnerOfStockReceiptRequest(request.getValue(), owner);
    }

    @Test
    void confirmingAnOrderedOrderAsReceivedCreatesAPendingRequestLinkedToItWithoutTouchingTheOrder() {
        StockCheck check = existingCheck(LocalDate.now());
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(10), bd(0), employee, OffsetDateTime.now().minusHours(9), false);
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now()))
            .thenReturn(Optional.of(check));
        OrderListEntry order = new OrderListEntry();
        ReflectionTestUtils.setField(order, "id", 77L);
        order.setStoreInventoryItem(milk);
        order.setStatus(OrderStatus.ORDERED);
        order.setQuantityNeeded(bd(12));
        when(orderListService.requireOrderedEntry(STORE_ID, ITEM_ID, 77L)).thenReturn(order);
        when(stockReceiptRequestRepository.save(any(StockReceiptRequest.class))).thenAnswer(i -> i.getArgument(0));

        // No quantity given: defaults to what was ordered.
        stockCheckService.submitCheck(EMPLOYEE_ID,
            new StockCheckSubmitRequest(STORE_ID, ITEM_ID, StockCheckSnapshot.END_OF_DAY, bd(20), bd(0), null, 77L));

        ArgumentCaptor<StockReceiptRequest> request = ArgumentCaptor.forClass(StockReceiptRequest.class);
        verify(stockReceiptRequestRepository).save(request.capture());
        assertThat(request.getValue().getOrderListEntry()).isSameAs(order);
        assertThat(request.getValue().getQuantity()).isEqualByComparingTo(bd(12));
        assertThat(order.getStatus()).isEqualTo(OrderStatus.ORDERED);
        verify(orderListService, never()).confirmReceivedByApproval(any(), any(), any());
    }

    @Test
    void endOfDayCoveredByTwoSelectedOrdersIsAcceptedAndCreatesOneRequestPerOrder() {
        StockCheck check = existingCheck(LocalDate.now());
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(3), bd(0), employee, OffsetDateTime.now().minusHours(9), false);
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now()))
            .thenReturn(Optional.of(check));
        for (long id : new long[] {70L, 74L}) {
            OrderListEntry order = new OrderListEntry();
            ReflectionTestUtils.setField(order, "id", id);
            order.setStoreInventoryItem(milk);
            order.setStatus(OrderStatus.ORDERED);
            order.setQuantityNeeded(bd(id == 70L ? 4 : 1));
            when(orderListService.requireOrderedEntry(STORE_ID, ITEM_ID, id)).thenReturn(order);
        }
        when(stockReceiptRequestRepository.save(any(StockReceiptRequest.class))).thenAnswer(i -> i.getArgument(0));

        // Start of Day 3, End of Day 5: the two orders (4 + 1) cover the gap of 2.
        stockCheckService.submitCheck(EMPLOYEE_ID, new StockCheckSubmitRequest(
            STORE_ID, ITEM_ID, StockCheckSnapshot.END_OF_DAY, bd(5), bd(0), null, null,
            List.of(new StockCheckSubmitRequest.ReceivedItem(70L, bd(4)), new StockCheckSubmitRequest.ReceivedItem(74L, bd(1)))));

        ArgumentCaptor<StockReceiptRequest> requests = ArgumentCaptor.forClass(StockReceiptRequest.class);
        verify(stockReceiptRequestRepository, times(2)).save(requests.capture());
        // Held until approved: the count isn't saved yet.
        assertThat(check.getEndOfDayAvailable()).isNull();
        // Exactly one of the two sibling requests carries the held-back count.
        assertThat(requests.getAllValues()).filteredOn(StockReceiptRequest::isHoldsSnapshot).hasSize(1)
            .first().satisfies(r -> assertThat(r.getPendingAvailable()).isEqualByComparingTo(bd(5)));
    }

    @Test
    void anOrderAlreadyWaitingOnApprovalCannotBeReportedAgain() {
        StockCheck check = existingCheck(LocalDate.now());
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(10), bd(0), employee, OffsetDateTime.now().minusHours(9), false);
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now()))
            .thenReturn(Optional.of(check));
        OrderListEntry order = new OrderListEntry();
        ReflectionTestUtils.setField(order, "id", 77L);
        order.setStoreInventoryItem(milk);
        when(orderListService.requireOrderedEntry(STORE_ID, ITEM_ID, 77L)).thenReturn(order);
        when(stockReceiptRequestRepository.existsByOrderListEntryIdAndStatus(77L, com.nforce.retailops.entity.StockReceiptRequestStatus.PENDING))
            .thenReturn(true);

        assertThatThrownBy(() -> stockCheckService.submitCheck(EMPLOYEE_ID,
            new StockCheckSubmitRequest(STORE_ID, ITEM_ID, StockCheckSnapshot.END_OF_DAY, bd(20), bd(0), null, 77L)))
            .isInstanceOf(InvalidStockCheckException.class);
        verify(stockReceiptRequestRepository, never()).save(any());
    }

    @Test
    void reSavingEndOfDayWhileAReceiptIsPendingIsRejected() {
        StockCheck check = existingCheck(LocalDate.now());
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(10), bd(0), employee, OffsetDateTime.now().minusHours(9), false);
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now()))
            .thenReturn(Optional.of(check));
        StockReceiptRequest pending = new StockReceiptRequest();
        pending.setStatus(com.nforce.retailops.entity.StockReceiptRequestStatus.PENDING);
        when(stockReceiptRequestRepository.findByStoreInventoryItemIdAndCheckDateAndSnapshotAndStatus(
            ITEM_ID, LocalDate.now(), StockCheckSnapshot.END_OF_DAY, com.nforce.retailops.entity.StockReceiptRequestStatus.PENDING))
            .thenReturn(List.of(pending));

        assertThatThrownBy(() -> stockCheckService.submitCheck(EMPLOYEE_ID, submit(StockCheckSnapshot.END_OF_DAY, 20, 0)))
            .isInstanceOf(com.nforce.retailops.exception.StockCheckReviewPendingException.class);

        assertThat(check.getEndOfDayAvailable()).isNull();
        verify(stockCheckRepository, never()).save(any(StockCheck.class));
        verify(stockReceiptRequestRepository, never()).save(any());
    }

    @Test
    void approvedHeldEndOfDayCountCannotBeEditedAgain() {
        StockCheck check = existingCheck(LocalDate.now());
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(10), bd(0), employee, OffsetDateTime.now().minusHours(9), false);
        check.recordSnapshot(StockCheckSnapshot.END_OF_DAY, bd(15), bd(0), employee, OffsetDateTime.now(), false);
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now()))
            .thenReturn(Optional.of(check));
        StockReceiptRequest approved = new StockReceiptRequest();
        approved.setStatus(com.nforce.retailops.entity.StockReceiptRequestStatus.APPROVED);
        approved.setHoldsSnapshot(true);
        when(stockReceiptRequestRepository.findByStoreInventoryItemIdAndCheckDateAndSnapshotAndStatus(
            ITEM_ID, LocalDate.now(), StockCheckSnapshot.END_OF_DAY,
            com.nforce.retailops.entity.StockReceiptRequestStatus.APPROVED))
            .thenReturn(List.of(approved));

        assertThatThrownBy(() -> stockCheckService.submitCheck(EMPLOYEE_ID, submit(StockCheckSnapshot.END_OF_DAY, 14, 0)))
            .isInstanceOf(StockCheckLockedException.class)
            .hasMessage(StockCheckService.END_OF_DAY_APPROVED_MESSAGE);

        assertThat(check.getEndOfDayAvailable()).isEqualByComparingTo(bd(15));
        verify(stockCheckRepository, never()).save(any(StockCheck.class));
    }

    @Test
    void approvingARequestAppliesTheDeliveryToTheDaysRow() {
        StockCheck check = existingCheck(LocalDate.now());
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(10), bd(0), employee, OffsetDateTime.now().minusHours(9), false);
        check.recordSnapshot(StockCheckSnapshot.END_OF_DAY, bd(20), bd(0), employee, OffsetDateTime.now(), false);
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now()))
            .thenReturn(Optional.of(check));
        StockReceiptRequest request = new StockReceiptRequest();
        request.setStore(store);
        request.setStoreInventoryItem(milk);
        request.setCheckDate(LocalDate.now());
        request.setQuantity(bd(15));
        request.setRequestedBy(employee);

        stockCheckService.applyApprovedDelivery(request);

        // 10 opening + 15 received - 20 closing; the closing count is not topped up.
        assertThat(check.getQuantityReceived()).isEqualByComparingTo(bd(15));
        assertThat(check.stockUsed()).isEqualByComparingTo(bd(5));
        assertThat(check.getEndOfDayAvailable()).isEqualByComparingTo(bd(20));
        ArgumentCaptor<StockCheckReceipt> receipt = ArgumentCaptor.forClass(StockCheckReceipt.class);
        verify(stockCheckReceiptRepository).save(receipt.capture());
        assertThat(receipt.getValue().getQuantity()).isEqualByComparingTo(bd(15));
        assertThat(receipt.getValue().getReceivedByUser()).isEqualTo(employee);
    }

    @Test
    void approvingAHeldLowerCountAppliesTheFigureAndWritesACorrectionRow() {
        StockCheck check = existingCheck(LocalDate.now());
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(20), bd(0), employee, OffsetDateTime.now().minusHours(9), false);
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now()))
            .thenReturn(Optional.of(check));
        StockReceiptRequest request = new StockReceiptRequest();
        request.setStore(store);
        request.setStoreInventoryItem(milk);
        request.setCheckDate(LocalDate.now());
        request.setSnapshot(StockCheckSnapshot.START_OF_DAY);
        request.setType(com.nforce.retailops.entity.StockReceiptRequestType.LOWER_COUNT);
        request.setQuantity(bd(5));
        request.setRequestedBy(employee);
        request.setHoldsSnapshot(true);
        request.setPendingAvailable(bd(15));
        request.setPendingDeadStock(bd(0));

        stockCheckService.applyApprovedSnapshot(request);

        assertThat(check.getStartOfDayAvailable()).isEqualByComparingTo(bd(15));
        ArgumentCaptor<StockCheckCorrection> captor = ArgumentCaptor.forClass(StockCheckCorrection.class);
        verify(stockCheckCorrectionRepository).save(captor.capture());
        assertThat(captor.getValue().getOriginalCount()).isEqualByComparingTo(bd(20));
        assertThat(captor.getValue().getCorrectedCount()).isEqualByComparingTo(bd(15));
        verify(orderListService).reconcileStartOfDayShortage(
            eq(store), eq(milk), any(java.math.BigDecimal.class), anyBoolean(), eq(employee), isNull());
    }

    @Test
    void applyingAnOrdinaryDeliveryRequestDoesNotTouchTheSnapshot() {
        StockCheck check = existingCheck(LocalDate.now());
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(10), bd(0), employee, OffsetDateTime.now().minusHours(9), false);
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now()))
            .thenReturn(Optional.of(check));
        StockReceiptRequest request = new StockReceiptRequest();
        request.setStore(store);
        request.setStoreInventoryItem(milk);
        request.setCheckDate(LocalDate.now());
        request.setQuantity(bd(5));
        request.setRequestedBy(employee);

        stockCheckService.applyApprovedSnapshot(request);

        verify(stockCheckRepository, never()).save(any(StockCheck.class));
        verify(stockCheckCorrectionRepository, never()).save(any());
        verify(orderListService, never()).reconcileStartOfDayShortage(any(), any(), any(), anyBoolean(), any(), any());
    }

    @Test
    void resubmittingStartOfDayWhileAReviewIsPendingIsRejected() {
        when(stockReceiptRequestRepository.findByStoreInventoryItemIdAndCheckDateAndSnapshotAndStatus(
            ITEM_ID, LocalDate.now(), StockCheckSnapshot.START_OF_DAY, com.nforce.retailops.entity.StockReceiptRequestStatus.PENDING))
            .thenReturn(List.of(new StockReceiptRequest()));

        assertThatThrownBy(() -> stockCheckService.submitCheck(EMPLOYEE_ID, submit(StockCheckSnapshot.START_OF_DAY, 15, 0)))
            .isInstanceOf(com.nforce.retailops.exception.StockCheckReviewPendingException.class);
        verify(stockCheckRepository, never()).save(any(StockCheck.class));
    }

    @Test
    void endOfDayAboveStartOfDayPlusReceivedStockIsRejected() {
        StockCheck check = existingCheck(LocalDate.now());
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(10), bd(0), employee, OffsetDateTime.now().minusHours(9), false);
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now()))
            .thenReturn(Optional.of(check));

        // No stock received at all.
        assertThatThrownBy(() -> stockCheckService.submitCheck(EMPLOYEE_ID, submit(StockCheckSnapshot.END_OF_DAY, 20, 0)))
            .isInstanceOf(com.nforce.retailops.exception.InvalidStockCheckException.class);
        // 10 + 5 received is still short of 20.
        assertThatThrownBy(() -> stockCheckService.submitCheck(EMPLOYEE_ID,
            new StockCheckSubmitRequest(STORE_ID, ITEM_ID, StockCheckSnapshot.END_OF_DAY, bd(20), bd(0), bd(5))))
            .isInstanceOf(com.nforce.retailops.exception.InvalidStockCheckException.class);
        verify(stockCheckReceiptRepository, never()).save(any());
    }

    @Test
    void receivedStockIsRejectedOnStartOfDayAndWithoutAStartOfDayCount() {
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now()))
            .thenReturn(Optional.of(existingCheck(LocalDate.now())));

        assertThatThrownBy(() -> stockCheckService.submitCheck(EMPLOYEE_ID,
            new StockCheckSubmitRequest(STORE_ID, ITEM_ID, StockCheckSnapshot.START_OF_DAY, bd(10), bd(0), bd(5))))
            .isInstanceOf(com.nforce.retailops.exception.InvalidStockCheckException.class);
        assertThatThrownBy(() -> stockCheckService.submitCheck(EMPLOYEE_ID,
            new StockCheckSubmitRequest(STORE_ID, ITEM_ID, StockCheckSnapshot.END_OF_DAY, bd(10), bd(0), bd(5))))
            .isInstanceOf(com.nforce.retailops.exception.InvalidStockCheckException.class);
        verify(stockCheckReceiptRepository, never()).save(any());
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
    void endOfDayIsRejectedWithoutATodaysStartOfDayCount() {
        // No existing row for today at all -- a brand-new item being closed
        // out without ever being opened.
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now()))
            .thenReturn(Optional.empty());

        assertThatThrownBy(() -> stockCheckService.submitCheck(EMPLOYEE_ID, submit(StockCheckSnapshot.END_OF_DAY, 10, 0)))
            .isInstanceOf(InvalidStockCheckException.class)
            .hasMessage("Submit today's Start of Day stock check before the End of Day count");
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
        // An old day's unordered shortage is closed to changes: Not Ordered.
        assertThat(milkRow.status()).isEqualTo(EodSupplierReportResponse.Status.NOT_ORDERED);

        // Bread is active but uncounted; the inactive, uncounted item is left out.
        List<EodSupplierReportResponse.Row> noSupplier = report.groups().get(1).items();
        assertThat(noSupplier).extracting(EodSupplierReportResponse.Row::itemName).containsExactly("Bread");
        assertThat(noSupplier.get(0).status()).isEqualTo(EodSupplierReportResponse.Status.START_OF_DAY_PENDING);
        assertThat(noSupplier.get(0).requiredTomorrow()).isEqualByComparingTo(bd(10));

        assertThat(report.itemsNeedingOrder()).isEqualTo(0);
        assertThat(report.itemsPendingEndOfDay()).isEqualTo(0);
    }

    @Test
    void eodReportShowsEndOfDayPendingOnlyOnceStartOfDayHasBeenCounted() {
        milk.setMinWeekday(bd(40));
        milk.setMinWeekend(bd(40));

        LocalDate day = LocalDate.of(2026, 6, 15);
        StockCheck milkCheck = existingCheck(day);
        milkCheck.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(50), bd(2), employee, OffsetDateTime.now(), false);

        when(storeInventoryItemRepository.findByStoreIdOrderById(STORE_ID)).thenReturn(List.of(milk));
        when(stockCheckRepository.findForStoreOnDate(STORE_ID, day)).thenReturn(List.of(milkCheck));

        EodSupplierReportResponse report = stockCheckService.getEodSupplierReport(OWNER_ID, day);

        assertThat(report.groups().get(0).items().get(0).status()).isEqualTo(EodSupplierReportResponse.Status.END_OF_DAY_PENDING);
        assertThat(report.itemsPendingEndOfDay()).isEqualTo(1);
    }

    @Test
    void eodReportOffersTheNeedsOrderingEntryToMarkOrderedOnTodaysReport() {
        milk.setMinWeekday(bd(40));
        milk.setMinWeekend(bd(40));

        LocalDate day = LocalDate.now();
        StockCheck milkCheck = existingCheck(day);
        milkCheck.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(50), bd(2), employee, OffsetDateTime.now(), false);
        milkCheck.recordSnapshot(StockCheckSnapshot.END_OF_DAY, bd(35), bd(1), employee, OffsetDateTime.now(), false);
        milkCheck.setRequiredTomorrow(bd(40));
        milkCheck.setQuantityNeeded(bd(6));

        when(storeInventoryItemRepository.findByStoreIdOrderById(STORE_ID)).thenReturn(List.of(milk));
        when(stockCheckRepository.findForStoreOnDate(STORE_ID, day)).thenReturn(List.of(milkCheck));
        when(orderListService.listForStore(STORE_ID)).thenReturn(List.of(
            new OrderListEntryResponse(
                99L, ITEM_ID, "Milk", "L", bd(6), bd(0), null, null, null, "NEEDS_ORDERING",
                false, null, OffsetDateTime.now(), OffsetDateTime.now(), null, null, null, null, false, null, null, null, null, false
            )
        ));

        EodSupplierReportResponse.Row row = stockCheckService.getEodSupplierReport(OWNER_ID, day).groups().get(0).items().get(0);

        assertThat(row.status()).isEqualTo(EodSupplierReportResponse.Status.NEEDS_TO_ORDER);
        assertThat(row.orderEntryId()).isEqualTo(99L);
    }

    @Test
    void eodReportKeepsShowingAPastDaysOrderAsOrderedEvenAfterItWasReceived() {
        milk.setMinWeekday(bd(40));
        milk.setMinWeekend(bd(40));

        LocalDate day = LocalDate.of(2026, 6, 15);
        StockCheck milkCheck = existingCheck(day);
        milkCheck.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(50), bd(2), employee, OffsetDateTime.now(), false);
        milkCheck.recordSnapshot(StockCheckSnapshot.END_OF_DAY, bd(35), bd(1), employee, OffsetDateTime.now(), false);
        milkCheck.setRequiredTomorrow(bd(40));
        milkCheck.setQuantityNeeded(bd(6));

        when(storeInventoryItemRepository.findByStoreIdOrderById(STORE_ID)).thenReturn(List.of(milk));
        when(stockCheckRepository.findForStoreOnDate(STORE_ID, day)).thenReturn(List.of(milkCheck));
        // Ordered that day; the entry has since moved on, so it isn't in the live list.
        when(orderListService.orderedInfoByItemFor(STORE_ID, day)).thenReturn(Map.of(ITEM_ID, orderedInfo(6, day)));

        EodSupplierReportResponse.Row row = stockCheckService.getEodSupplierReport(OWNER_ID, day).groups().get(0).items().get(0);

        assertThat(row.status()).isEqualTo(EodSupplierReportResponse.Status.ORDERED);
        assertThat(row.orderedQuantity()).isEqualByComparingTo(bd(6));
        assertThat(row.orderedOn()).isEqualTo(day);
        assertThat(row.orderEntryId()).isNull();
    }

    @Test
    void eodReportShowsOrderedStatusAndQuantityOnceTheOrderListEntryIsOrdered() {
        milk.setMinWeekday(bd(40));
        milk.setMinWeekend(bd(40));

        LocalDate day = LocalDate.now();
        StockCheck milkCheck = existingCheck(day);
        milkCheck.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(50), bd(2), employee, OffsetDateTime.now(), false);
        milkCheck.recordSnapshot(StockCheckSnapshot.END_OF_DAY, bd(35), bd(1), employee, OffsetDateTime.now(), false);
        milkCheck.setRequiredTomorrow(bd(40));
        milkCheck.setQuantityNeeded(bd(6));

        when(storeInventoryItemRepository.findByStoreIdOrderById(STORE_ID)).thenReturn(List.of(milk));
        when(stockCheckRepository.findForStoreOnDate(STORE_ID, day)).thenReturn(List.of(milkCheck));
        // Ordered 6 + a 2-unit manual top-up = 8, placed via Order List.
        when(orderListService.orderedInfoByItemFor(STORE_ID, day)).thenReturn(Map.of(ITEM_ID, orderedInfo(8, day)));

        EodSupplierReportResponse report = stockCheckService.getEodSupplierReport(OWNER_ID, day);

        EodSupplierReportResponse.Row milkRow = report.groups().get(0).items().get(0);
        assertThat(milkRow.status()).isEqualTo(EodSupplierReportResponse.Status.ORDERED);
        assertThat(milkRow.orderedQuantity()).isEqualByComparingTo(bd(8));
        assertThat(milkRow.orderedOn()).isEqualTo(day);
        assertThat(milkRow.orderEntryId()).isNull();
    }

    @Test
    void eodReportLeavesOrderedQuantityNullWhenNoActiveOrderListEntryExists() {
        milk.setMinWeekday(bd(40));
        milk.setMinWeekend(bd(40));

        LocalDate day = LocalDate.of(2026, 6, 15);
        StockCheck milkCheck = existingCheck(day);
        milkCheck.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(50), bd(2), employee, OffsetDateTime.now(), false);
        milkCheck.recordSnapshot(StockCheckSnapshot.END_OF_DAY, bd(35), bd(1), employee, OffsetDateTime.now(), false);
        milkCheck.setRequiredTomorrow(bd(40));
        milkCheck.setQuantityNeeded(bd(6));

        when(storeInventoryItemRepository.findByStoreIdOrderById(STORE_ID)).thenReturn(List.of(milk));
        when(stockCheckRepository.findForStoreOnDate(STORE_ID, day)).thenReturn(List.of(milkCheck));
        when(orderListService.listForStore(STORE_ID)).thenReturn(List.of(
            new OrderListEntryResponse(
                99L, ITEM_ID, "Milk", "L", bd(6), bd(0), null, null, null, "NEEDS_ORDERING",
                false, null, OffsetDateTime.now(), OffsetDateTime.now(), null, null, null, null, false, null, null, null, null, false
            )
        ));

        EodSupplierReportResponse report = stockCheckService.getEodSupplierReport(OWNER_ID, day);

        EodSupplierReportResponse.Row milkRow = report.groups().get(0).items().get(0);
        assertThat(milkRow.orderedQuantity()).isNull();
    }

    private static OrderListService.OrderedInfo orderedInfo(int quantity, LocalDate on) {
        return new OrderListService.OrderedInfo(bd(quantity), on.atTime(10, 0).atZone(java.time.ZoneId.systemDefault()).toOffsetDateTime());
    }

    private void shortfallRowOn(LocalDate day) {
        milk.setMinWeekday(bd(40));
        milk.setMinWeekend(bd(40));
        StockCheck milkCheck = existingCheck(day);
        milkCheck.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(50), bd(2), employee, OffsetDateTime.now(), false);
        milkCheck.recordSnapshot(StockCheckSnapshot.END_OF_DAY, bd(35), bd(1), employee, OffsetDateTime.now(), false);
        milkCheck.setRequiredTomorrow(bd(40));
        milkCheck.setQuantityNeeded(bd(6));
        when(storeInventoryItemRepository.findByStoreIdOrderById(STORE_ID)).thenReturn(List.of(milk));
        when(stockCheckRepository.findForStoreOnDate(STORE_ID, day)).thenReturn(List.of(milkCheck));
        when(orderListService.listForStore(STORE_ID)).thenReturn(List.of(
            new OrderListEntryResponse(
                99L, ITEM_ID, "Milk", "L", bd(6), bd(0), null, null, null, "NEEDS_ORDERING",
                false, null, OffsetDateTime.now(), OffsetDateTime.now(), null, null, null, null, false, null, null, null, null, false
            )
        ));
    }

    @Test
    void eodReportLetsYesterdaysPendingShortageStillBeOrdered() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        shortfallRowOn(yesterday);

        EodSupplierReportResponse.Row row = stockCheckService.getEodSupplierReport(OWNER_ID, yesterday).groups().get(0).items().get(0);

        assertThat(row.status()).isEqualTo(EodSupplierReportResponse.Status.NEEDS_TO_ORDER);
        assertThat(row.orderEntryId()).isEqualTo(99L);
    }

    @Test
    void eodReportShowsYesterdaysShortageOrderedTodayAsOrderedOnTodaysDate() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        shortfallRowOn(yesterday);
        when(orderListService.orderedInfoByItemFor(STORE_ID, yesterday)).thenReturn(Map.of(ITEM_ID, orderedInfo(6, LocalDate.now())));

        EodSupplierReportResponse.Row row = stockCheckService.getEodSupplierReport(OWNER_ID, yesterday).groups().get(0).items().get(0);

        assertThat(row.status()).isEqualTo(EodSupplierReportResponse.Status.ORDERED);
        assertThat(row.orderedOn()).isEqualTo(LocalDate.now());
        assertThat(row.orderEntryId()).isNull();
    }

    @Test
    void eodReportMarksAnUnorderedShortageFromTheDayBeforeYesterdayAsNotOrderedAndNotEditable() {
        LocalDate older = LocalDate.now().minusDays(2);
        shortfallRowOn(older);

        EodSupplierReportResponse.Row row = stockCheckService.getEodSupplierReport(OWNER_ID, older).groups().get(0).items().get(0);

        assertThat(row.status()).isEqualTo(EodSupplierReportResponse.Status.NOT_ORDERED);
        assertThat(row.orderEntryId()).isNull();
        assertThat(row.orderedOn()).isNull();
    }

    @Test
    void eodReportIgnoresAnOrderPlacedLongAfterAnOlderDayAndKeepsItNotOrdered() {
        LocalDate older = LocalDate.now().minusDays(3);
        shortfallRowOn(older);
        // The order service only ever returns orders in that day's own window,
        // so nothing comes back for it.
        when(orderListService.orderedInfoByItemFor(STORE_ID, older)).thenReturn(Map.of());

        assertThat(stockCheckService.getEodSupplierReport(OWNER_ID, older).groups().get(0).items().get(0).status())
            .isEqualTo(EodSupplierReportResponse.Status.NOT_ORDERED);
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
        checkWithStartOfDay(30, 0);

        StockCheckResponse response = stockCheckService.submitCheck(EMPLOYEE_ID, submit(StockCheckSnapshot.END_OF_DAY, 25, 0));

        assertThat(response.quantityToOrder()).isEqualByComparingTo(bd(0));
        verify(orderListService, never()).upsertShortage(any(), any(), any(java.math.BigDecimal.class), any(), anyBoolean(), any(), any());
        verify(orderListService).resolveShortageIfPresent(store, milk);
    }

    @Test
    void startOfDayBelowTodaysMinimumAddsTheItemToTheOrderList() {
        milk.setMinWeekday(bd(8));
        milk.setMinWeekend(bd(8));
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now()))
            .thenReturn(Optional.empty());

        stockCheckService.submitCheck(EMPLOYEE_ID, submit(StockCheckSnapshot.START_OF_DAY, 7, 0));

        verify(orderListService).reconcileStartOfDayShortage(eq(store), eq(milk), eq(bd(1)), eq(false), eq(employee), isNull());
    }

    @Test
    void startOfDayAtOrAboveTodaysMinimumReconcilesWithNoShortage() {
        milk.setMinWeekday(bd(8));
        milk.setMinWeekend(bd(8));
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now()))
            .thenReturn(Optional.empty());

        stockCheckService.submitCheck(EMPLOYEE_ID, submit(StockCheckSnapshot.START_OF_DAY, 8, 0));

        verify(orderListService).reconcileStartOfDayShortage(eq(store), eq(milk), eq(bd(0)), eq(false), eq(employee), isNull());
    }

    @Test
    void correctingAPastStartOfDayDoesNotRaiseAnOrder() {
        milk.setMinWeekday(bd(20));
        milk.setMinWeekend(bd(20));
        StockCheck check = existingCheck(LocalDate.now().minusDays(3));
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(25), bd(0), employee, OffsetDateTime.now().minusDays(3), false);
        when(stockCheckRepository.findByIdAndStoreId(CHECK_ID, STORE_ID)).thenReturn(Optional.of(check));

        stockCheckService.correctCheck(OWNER_ID, CHECK_ID,
            new StockCheckCorrectionRequest(StockCheckSnapshot.START_OF_DAY, bd(5), bd(0), "Recounted"));

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
        return checkWithCount(item, date, available, dead, OffsetDateTime.now());
    }

    // toCountRow/countHistoryForStore order same-item events by their recorded
    // checkedAt instant, not by checkDate -- a real correction can be entered
    // out of calendar order, so the two must stay independent. A test with
    // several checks therefore needs an explicit, well-separated checkedAt per
    // call: back-to-back OffsetDateTime.now() calls can land in the same or
    // reversed real-time order from their checkDates, making the sort (and the
    // assertions on it) flaky depending on how fast the JVM gets there.
    private StockCheck checkWithCount(StoreInventoryItem item, LocalDate date, int available, int dead, OffsetDateTime checkedAt) {
        StockCheck check = new StockCheck();
        check.setStore(store);
        check.setStoreInventoryItem(item);
        check.setCheckDate(date);
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(available), bd(dead), employee, checkedAt, false);
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
        StockCheck yesterday = checkWithCount(milk, LocalDate.now().minusDays(1), 24, 0, OffsetDateTime.now().minusDays(1));
        StockCheck today = checkWithCount(milk, LocalDate.now(), 30, 0, OffsetDateTime.now());

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
    void inventoryCountsNarrowsRowsToTheRequestedItemIdsWithoutChangingKpiCounts() {
        StoreInventoryItem apples = new StoreInventoryItem();
        ReflectionTestUtils.setField(apples, "id", 26L);
        apples.setStore(store);
        apples.setName("Apples");

        when(storeInventoryItemRepository.findByStoreIdAndActiveTrueOrderById(STORE_ID)).thenReturn(List.of(milk, apples));
        when(stockCheckRepository.findLatestPerItemForStore(STORE_ID)).thenReturn(List.of());
        when(stockCheckRepository.findRecentForItem(any(), any(Pageable.class))).thenReturn(List.of());

        InventoryCountsPageResponse page = stockCheckService.listInventoryCounts(
            OWNER_ID, null, null, null, null, null, List.of(26L));

        assertThat(page.rows()).extracting(InventoryCountRowResponse::itemId).containsExactly(26L);
        assertThat(page.totalElements()).isEqualTo(1);
        assertThat(page.allCount()).isEqualTo(2);
    }

    @Test
    void countHistoryReturnsNewestFirstWithDeltaAgainstTheNextOlderEntry() {
        StockCheck newest = checkWithCount(milk, LocalDate.now(), 30, 0, OffsetDateTime.now());
        StockCheck middle = checkWithCount(milk, LocalDate.now().minusDays(1), 24, 0, OffsetDateTime.now().minusDays(1));
        StockCheck oldest = checkWithCount(milk, LocalDate.now().minusDays(2), 20, 0, OffsetDateTime.now().minusDays(2));
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
    void countHistoryShowsDeliveriesAndHowEachEntryWasMade() {
        OffsetDateTime morning = OffsetDateTime.now().minusHours(10);
        StockCheck check = checkWithCount(milk, LocalDate.now(), 20, 0);
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(20), bd(0), employee, morning, false);
        check.recordSnapshot(StockCheckSnapshot.END_OF_DAY, bd(10), bd(0), employee, morning.plusHours(9), false);

        User owner = user(OWNER_ID, "Olivia");
        StockCheckReceipt receipt = new StockCheckReceipt();
        receipt.setStoreInventoryItem(milk);
        receipt.setQuantity(bd(6));
        receipt.setCountAfter(bd(26));
        receipt.setReceivedByUser(owner);
        receipt.setReceivedAt(morning.plusHours(3));

        when(storeInventoryItemRepository.findByIdAndStoreId(ITEM_ID, STORE_ID)).thenReturn(Optional.of(milk));
        when(stockCheckRepository.findRecentForItem(eq(ITEM_ID), any(Pageable.class))).thenReturn(List.of(check));
        when(stockCheckReceiptRepository.findRecentForItem(eq(ITEM_ID), any(Pageable.class))).thenReturn(List.of(receipt));

        List<InventoryCountHistoryEntryResponse> history = stockCheckService.getCountHistory(OWNER_ID, ITEM_ID);

        assertThat(history).extracting(InventoryCountHistoryEntryResponse::source)
            .containsExactly(InventoryCountSource.END_OF_DAY, InventoryCountSource.STOCK_RECEIVED, InventoryCountSource.START_OF_DAY);
        assertThat(history).extracting(InventoryCountHistoryEntryResponse::updatedByName)
            .containsExactly("Sarah", "Olivia", "Sarah");
        // 26 after the delivery, down to 10 at close: 16 used; +6 from the delivery.
        assertThat(history.get(0).delta()).isEqualByComparingTo(bd(-16));
        assertThat(history.get(1).delta()).isEqualByComparingTo(bd(6));
        assertThat(history.get(2).delta()).isNull();
    }

    @Test
    void inventoryCountsAddsDeliveriesThatWereNotAppliedToAnyRowAndNamesTheReceiver() {
        milk.setMinWeekday(bd(10));
        milk.setMinWeekend(bd(10));
        StockCheck yesterday = checkWithCount(milk, LocalDate.now().minusDays(1), 4, 0);
        ReflectionTestUtils.setField(yesterday, "createdAt", OffsetDateTime.now().minusDays(1));
        yesterday.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(4), bd(0), employee, OffsetDateTime.now().minusDays(1), false);

        User owner = user(OWNER_ID, "Olivia");
        StockCheckReceipt receipt = new StockCheckReceipt();
        receipt.setStoreInventoryItem(milk);
        receipt.setQuantity(bd(6));
        receipt.setCountAfter(bd(10));
        receipt.setReceivedByUser(owner);
        receipt.setReceivedAt(OffsetDateTime.now().minusHours(1));

        when(storeInventoryItemRepository.findByStoreIdAndActiveTrueOrderById(STORE_ID)).thenReturn(List.of(milk));
        when(stockCheckRepository.findLatestPerItemForStore(STORE_ID)).thenReturn(List.of(yesterday));
        when(stockCheckRepository.findRecentForItem(any(), any(Pageable.class))).thenReturn(List.of(yesterday));
        when(stockCheckReceiptRepository.findLatestPerItemForStore(STORE_ID)).thenReturn(List.of(receipt));
        when(stockCheckReceiptRepository.findUnappliedForStore(STORE_ID)).thenReturn(List.of(receipt));

        InventoryCountRowResponse row = stockCheckService.listInventoryCounts(OWNER_ID, null, null, null, null, null).rows().get(0);

        assertThat(row.currentStock()).isEqualByComparingTo(bd(10));
        assertThat(row.lastUpdatedByName()).isEqualTo("Olivia");
        assertThat(row.lastUpdatedSource()).isEqualTo(InventoryCountSource.STOCK_RECEIVED);
    }

    @Test
    void inventoryCountsComputesChangeFromADeliveryNotAppliedToAnyRow() {
        milk.setMinWeekday(bd(10));
        milk.setMinWeekend(bd(10));
        StockCheck yesterday = checkWithCount(milk, LocalDate.now().minusDays(1), 4, 0);
        ReflectionTestUtils.setField(yesterday, "createdAt", OffsetDateTime.now().minusDays(1));
        yesterday.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(4), bd(0), employee, OffsetDateTime.now().minusDays(1), false);

        User owner = user(OWNER_ID, "Olivia");
        StockCheckReceipt receipt = new StockCheckReceipt();
        receipt.setStoreInventoryItem(milk);
        receipt.setQuantity(bd(6));
        receipt.setCountAfter(bd(10));
        receipt.setReceivedByUser(owner);
        receipt.setReceivedAt(OffsetDateTime.now().minusHours(1));

        when(storeInventoryItemRepository.findByStoreIdAndActiveTrueOrderById(STORE_ID)).thenReturn(List.of(milk));
        when(stockCheckRepository.findLatestPerItemForStore(STORE_ID)).thenReturn(List.of(yesterday));
        when(stockCheckRepository.findRecentForItem(any(), any(Pageable.class))).thenReturn(List.of(yesterday));
        when(stockCheckReceiptRepository.findLatestPerItemForStore(STORE_ID)).thenReturn(List.of(receipt));
        when(stockCheckReceiptRepository.findUnappliedForStore(STORE_ID)).thenReturn(List.of(receipt));
        when(stockCheckReceiptRepository.findRecentForItem(any(), any(Pageable.class))).thenReturn(List.of(receipt));

        InventoryCountRowResponse row = stockCheckService.listInventoryCounts(OWNER_ID, null, null, null, null, null).rows().get(0);

        // A delivery recorded against no row never creates a second StockCheck
        // row, so comparing rows alone (the old logic) left "change" stuck at
        // null even though currentStock moved from 4 to 10.
        assertThat(row.change()).isEqualByComparingTo(bd(6));
        assertThat(row.changeFromDate()).isEqualTo(LocalDate.now().minusDays(1));
    }

    @Test
    void countHistoryOmitsEntriesOlderThanSevenDaysButKeepsTheBoundaryEntrysDeltaCorrect() {
        StockCheck withinWindow = checkWithCount(milk, LocalDate.now().minusDays(6), 30, 0, OffsetDateTime.now().minusDays(6));
        StockCheck atTheEdge = checkWithCount(milk, LocalDate.now().minusDays(7), 24, 0, OffsetDateTime.now().minusDays(7));
        StockCheck tooOld = checkWithCount(milk, LocalDate.now().minusDays(8), 20, 0, OffsetDateTime.now().minusDays(8));
        when(storeInventoryItemRepository.findByIdAndStoreId(ITEM_ID, STORE_ID)).thenReturn(Optional.of(milk));
        when(stockCheckRepository.findRecentForItem(eq(ITEM_ID), any(Pageable.class)))
            .thenReturn(List.of(withinWindow, atTheEdge, tooOld));

        List<InventoryCountHistoryEntryResponse> history = stockCheckService.getCountHistory(OWNER_ID, ITEM_ID);

        assertThat(history).hasSize(1);
        assertThat(history.get(0).checkDate()).isEqualTo(LocalDate.now().minusDays(6));
        // Delta against the next-older event (24) even though that event itself
        // falls outside the 7-day window and isn't returned.
        assertThat(history.get(0).delta()).isEqualByComparingTo(bd(6));
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

    // ---- Start of Day reconciled against the last End of Day ----------------

    // Yesterday's row with an End of Day usable of 20, and no row yet today.
    private void yesterdayEndedAt(int usable) {
        StockCheck yesterday = existingCheck(LocalDate.now().minusDays(1));
        yesterday.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(30), bd(0), user(99L, "Alex"), OffsetDateTime.now().minusDays(1).minusHours(9), false);
        yesterday.recordSnapshot(StockCheckSnapshot.END_OF_DAY, bd(usable), bd(0), user(99L, "Alex"), OffsetDateTime.now().minusDays(1), false);
        when(stockCheckRepository.findFirstByStoreInventoryItemIdAndCheckDateBeforeOrderByCheckDateDesc(ITEM_ID, LocalDate.now()))
            .thenReturn(Optional.of(yesterday));
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now())).thenReturn(Optional.empty());
    }

    @Test
    void startOfDayMatchingTheLastEndOfDayNeedsNothingElse() {
        yesterdayEndedAt(20);

        stockCheckService.submitCheck(EMPLOYEE_ID, submit(StockCheckSnapshot.START_OF_DAY, 20, 0));

        verify(stockReceiptRequestRepository, never()).save(any(StockReceiptRequest.class));
        verify(stockCheckRepository).save(any(StockCheck.class));
    }

    // Stock going dead overnight is not stock going missing: the total still
    // matches the last End of Day, so no reason or approval is needed.
    @Test
    void startOfDayWithSameTotalButSomeDeadNeedsNothingElse() {
        yesterdayEndedAt(20);

        stockCheckService.submitCheck(EMPLOYEE_ID, submit(StockCheckSnapshot.START_OF_DAY, 20, 10));

        verify(stockReceiptRequestRepository, never()).save(any(StockReceiptRequest.class));
        verify(stockCheckRepository).save(any(StockCheck.class));
    }

    @Test
    void startOfDayLowerThanTheLastEndOfDayNeedsAReason() {
        yesterdayEndedAt(20);

        assertThatThrownBy(() -> stockCheckService.submitCheck(EMPLOYEE_ID, submit(StockCheckSnapshot.START_OF_DAY, 15, 0)))
            .isInstanceOf(InvalidStockCheckException.class)
            .hasMessageContaining("lower than the last End of Day");

        verify(stockCheckRepository, never()).save(any(StockCheck.class));
        verify(stockReceiptRequestRepository, never()).save(any(StockReceiptRequest.class));
    }

    @Test
    void startOfDayLowerThanTheLastEndOfDayWithAReasonIsSavedAndSentToTheAdmin() {
        yesterdayEndedAt(20);
        when(stockReceiptRequestRepository.save(any(StockReceiptRequest.class))).thenAnswer(i -> i.getArgument(0));
        StoreOwner activeOwner = new StoreOwner();
        activeOwner.setOwner(owner);
        when(storeOwnerRepository.findByStoreIdAndActiveTrue(STORE_ID)).thenReturn(Optional.of(activeOwner));

        stockCheckService.submitCheck(EMPLOYEE_ID, new StockCheckSubmitRequest(
            STORE_ID, ITEM_ID, StockCheckSnapshot.START_OF_DAY, bd(15), bd(0), null, null, null, "Spilled overnight"));

        ArgumentCaptor<StockReceiptRequest> captor = ArgumentCaptor.forClass(StockReceiptRequest.class);
        verify(stockReceiptRequestRepository).save(captor.capture());
        StockReceiptRequest request = captor.getValue();
        assertThat(request.getType()).isEqualTo(com.nforce.retailops.entity.StockReceiptRequestType.LOWER_COUNT);
        assertThat(request.getSnapshot()).isEqualTo(StockCheckSnapshot.START_OF_DAY);
        assertThat(request.getQuantity()).isEqualByComparingTo(bd(5));
        assertThat(request.getReason()).isEqualTo("Spilled overnight");
        assertThat(request.isHoldsSnapshot()).isTrue();
        assertThat(request.getPendingAvailable()).isEqualByComparingTo(bd(15));
        assertThat(request.getPendingDeadStock()).isEqualByComparingTo(bd(0));
        verify(notificationService).notifyOwnerOfStockReceiptRequest(request, owner);
        // The count is held on the request, not written to stock_checks, until
        // the admin approves it.
        verify(stockCheckRepository, never()).save(any(StockCheck.class));
    }

    @Test
    void startOfDayHigherThanTheLastEndOfDayNeedsARestock() {
        yesterdayEndedAt(20);

        assertThatThrownBy(() -> stockCheckService.submitCheck(EMPLOYEE_ID, submit(StockCheckSnapshot.START_OF_DAY, 25, 0)))
            .isInstanceOf(InvalidStockCheckException.class)
            .hasMessageContaining("cannot be greater than EOD of the previous day");

        verify(stockCheckRepository, never()).save(any(StockCheck.class));
    }

    @Test
    void startOfDayRestockCannotBeNewStockOffAnyOrder() {
        yesterdayEndedAt(20);

        assertThatThrownBy(() -> stockCheckService.submitCheck(EMPLOYEE_ID, new StockCheckSubmitRequest(
            STORE_ID, ITEM_ID, StockCheckSnapshot.START_OF_DAY, bd(25), bd(0), null, null,
            List.of(new StockCheckSubmitRequest.ReceivedItem(null, bd(5))))))
            .isInstanceOf(InvalidStockCheckException.class)
            .hasMessageContaining("cannot be greater than EOD of the previous day");

        verify(stockReceiptRequestRepository, never()).save(any(StockReceiptRequest.class));
    }

    @Test
    void startOfDayRestockIsSentToTheAdminAsAStartOfDayRequest() {
        yesterdayEndedAt(20);
        when(stockReceiptRequestRepository.save(any(StockReceiptRequest.class))).thenAnswer(i -> i.getArgument(0));
        OrderListEntry order = new OrderListEntry();
        order.setQuantityNeeded(bd(5));
        when(orderListService.requireOrderedEntry(STORE_ID, ITEM_ID, 77L)).thenReturn(order);

        stockCheckService.submitCheck(EMPLOYEE_ID, new StockCheckSubmitRequest(
            STORE_ID, ITEM_ID, StockCheckSnapshot.START_OF_DAY, bd(25), bd(0), null, null,
            List.of(new StockCheckSubmitRequest.ReceivedItem(77L, bd(5)))));

        ArgumentCaptor<StockReceiptRequest> captor = ArgumentCaptor.forClass(StockReceiptRequest.class);
        verify(stockReceiptRequestRepository).save(captor.capture());
        assertThat(captor.getValue().getSnapshot()).isEqualTo(StockCheckSnapshot.START_OF_DAY);
        assertThat(captor.getValue().getType()).isEqualTo(com.nforce.retailops.entity.StockReceiptRequestType.RESTOCK);
        assertThat(captor.getValue().getQuantity()).isEqualByComparingTo(bd(5));
    }

    @Test
    void startOfDayAboveEndOfDayHoldsLastEndOfDayPlusTheReceivedOrderNotTheTypedCount() {
        yesterdayEndedAt(20);
        when(stockReceiptRequestRepository.save(any(StockReceiptRequest.class))).thenAnswer(i -> i.getArgument(0));
        OrderListEntry order = new OrderListEntry();
        order.setQuantityNeeded(bd(5));
        when(orderListService.requireOrderedEntry(STORE_ID, ITEM_ID, 77L)).thenReturn(order);

        // Typed 40 is ignored: held figure is 20 (last End of Day) + 5 (order).
        stockCheckService.submitCheck(EMPLOYEE_ID, new StockCheckSubmitRequest(
            STORE_ID, ITEM_ID, StockCheckSnapshot.START_OF_DAY, bd(40), bd(0), null, null,
            List.of(new StockCheckSubmitRequest.ReceivedItem(77L, bd(5)))));

        ArgumentCaptor<StockReceiptRequest> captor = ArgumentCaptor.forClass(StockReceiptRequest.class);
        verify(stockReceiptRequestRepository).save(captor.capture());
        assertThat(captor.getValue().isHoldsSnapshot()).isTrue();
        assertThat(captor.getValue().getPendingAvailable()).isEqualByComparingTo(bd(25));
    }

    @Test
    void aRestockSmallerThanTheStartOfDayGapIsRefused() {
        yesterdayEndedAt(20);

        assertThatThrownBy(() -> stockCheckService.submitCheck(EMPLOYEE_ID, new StockCheckSubmitRequest(
            STORE_ID, ITEM_ID, StockCheckSnapshot.START_OF_DAY, bd(25), bd(0), null, null,
            List.of(new StockCheckSubmitRequest.ReceivedItem(null, bd(2))))))
            .isInstanceOf(InvalidStockCheckException.class);

        verify(stockReceiptRequestRepository, never()).save(any(StockReceiptRequest.class));
    }

    @Test
    void aStartOfDayWithNoEndOfDayBeforeItIsNotReconciled() {
        when(stockCheckRepository.findFirstByStoreInventoryItemIdAndCheckDateBeforeOrderByCheckDateDesc(ITEM_ID, LocalDate.now()))
            .thenReturn(Optional.empty());
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now())).thenReturn(Optional.empty());

        stockCheckService.submitCheck(EMPLOYEE_ID, submit(StockCheckSnapshot.START_OF_DAY, 99, 0));

        verify(stockCheckRepository).save(any(StockCheck.class));
    }

    @Test
    void approvingAStartOfDayRestockDoesNotRaiseTheDaysReceivedTotal() {
        StockCheck check = existingCheck(LocalDate.now());
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(25), bd(0), employee, OffsetDateTime.now(), false);
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now()))
            .thenReturn(Optional.of(check));
        StockReceiptRequest request = new StockReceiptRequest();
        request.setStore(store);
        request.setStoreInventoryItem(milk);
        request.setCheckDate(LocalDate.now());
        request.setSnapshot(StockCheckSnapshot.START_OF_DAY);
        request.setQuantity(bd(5));
        request.setRequestedBy(employee);

        stockCheckService.applyApprovedDelivery(request);

        // The opening count already includes the restock, so usage must not grow by it.
        assertThat(check.getQuantityReceived()).isEqualByComparingTo(bd(0));
        assertThat(check.getCurrentCount()).isEqualByComparingTo(bd(25));
        verify(stockCheckReceiptRepository).save(any(StockCheckReceipt.class));
    }

    @Test
    void midDayShortageIsRecordedSoItShowsInTheCountHistory() {
        milk.setMinWeekday(bd(35));
        milk.setMinWeekend(bd(35));
        checkWithStartOfDay(50, 2);

        stockCheckService.reportAdHocShortage(EMPLOYEE_ID, STORE_ID, new AdHocShortageRequest(ITEM_ID, bd(20), "rush", null));

        ArgumentCaptor<com.nforce.retailops.entity.StockShortageReport> captor =
            ArgumentCaptor.forClass(com.nforce.retailops.entity.StockShortageReport.class);
        verify(stockShortageReportRepository).save(captor.capture());
        assertThat(captor.getValue().getReportedUsable()).isEqualByComparingTo(bd(20));
        assertThat(captor.getValue().getReportedBy()).isEqualTo(employee);
    }
}
