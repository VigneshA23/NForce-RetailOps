package com.nforce.retailops.service;

import com.nforce.retailops.dto.DailyStockCheckItemResponse;
import com.nforce.retailops.dto.MissedEndOfDayAnswerRequest;
import com.nforce.retailops.dto.MissedEndOfDayResponse;
import com.nforce.retailops.dto.StockCheckSubmitRequest;
import com.nforce.retailops.entity.StockCheck;
import com.nforce.retailops.entity.StockCheckSnapshot;
import com.nforce.retailops.entity.StockReceiptRequest;
import com.nforce.retailops.entity.StockReceiptRequestStatus;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.InvalidStockCheckException;
import com.nforce.retailops.exception.MissedEndOfDayPendingException;
import com.nforce.retailops.exception.StockCheckLockedException;
import com.nforce.retailops.exception.StoreInventoryItemNotFoundException;
import com.nforce.retailops.repository.StockCheckCorrectionRepository;
import com.nforce.retailops.repository.StockCheckReceiptRepository;
import com.nforce.retailops.repository.StockCheckRepository;
import com.nforce.retailops.repository.StockReceiptRequestRepository;
import com.nforce.retailops.repository.StockShortageReportRepository;
import com.nforce.retailops.repository.StoreInventoryItemRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

// Yesterday's Start of Day with no End of Day: today's Start of Day is blocked
// until someone counts it or explains why it could not be counted.
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class StockCheckServiceMissedEndOfDayTest {

    private static final Long OWNER_ID = 1L;
    private static final Long EMPLOYEE_ID = 2L;
    private static final Long STORE_ID = 10L;
    private static final Long ITEM_ID = 20L;

    private static final String FIFTEEN_WORDS =
        "the freezer failed overnight and every tub had already melted so nothing could be counted safely";

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
    private final LocalDate yesterday = LocalDate.now().minusDays(1);

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
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now()))
            .thenReturn(Optional.empty());

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

    private StockCheck yesterdayWithStartOnly(int sodAvailable) {
        StockCheck check = new StockCheck();
        check.setStore(store);
        check.setStoreInventoryItem(milk);
        check.setCheckDate(yesterday);
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, BigDecimal.valueOf(sodAvailable), BigDecimal.ZERO,
            employee, OffsetDateTime.now().minusDays(1), false);
        return check;
    }

    private void yesterdayRowIs(StockCheck check) {
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, yesterday)).thenReturn(Optional.of(check));
        when(stockCheckRepository.lockByItemAndDate(ITEM_ID, yesterday)).thenReturn(Optional.of(check));
    }

    private StockCheckSubmitRequest startOfDay(int available) {
        return new StockCheckSubmitRequest(STORE_ID, ITEM_ID, StockCheckSnapshot.START_OF_DAY,
            BigDecimal.valueOf(available), BigDecimal.ZERO);
    }

    private static MissedEndOfDayAnswerRequest count(int available, int dead) {
        return new MissedEndOfDayAnswerRequest(STORE_ID, ITEM_ID, BigDecimal.valueOf(available), BigDecimal.valueOf(dead), false, null);
    }

    private static MissedEndOfDayAnswerRequest couldNotCount(String reason) {
        return new MissedEndOfDayAnswerRequest(STORE_ID, ITEM_ID, null, null, true, reason);
    }

    // ---- Start of Day block -------------------------------------------------

    @Test
    void startOfDayIsBlockedWhileYesterdaysEndOfDayIsMissing() {
        yesterdayRowIs(yesterdayWithStartOnly(10));

        assertThatThrownBy(() -> stockCheckService.submitCheck(EMPLOYEE_ID, startOfDay(9)))
            .isInstanceOf(MissedEndOfDayPendingException.class)
            .hasMessageContaining("Milk");
        verify(stockCheckRepository, never()).save(any(StockCheck.class));
    }

    @Test
    void startOfDayIsAllowedOnceYesterdayWasExplainedAsNotCountable() {
        StockCheck yesterdayRow = yesterdayWithStartOnly(10);
        yesterdayRow.skipEndOfDay(FIFTEEN_WORDS, owner, OffsetDateTime.now());
        yesterdayRowIs(yesterdayRow);

        // Nothing to reconcile against, so any figure goes through.
        stockCheckService.submitCheck(EMPLOYEE_ID, startOfDay(500));

        verify(stockCheckRepository).save(any(StockCheck.class));
    }

    @Test
    void startOfDayIsAllowedWhenYesterdayHasAnEndOfDay() {
        StockCheck yesterdayRow = yesterdayWithStartOnly(10);
        yesterdayRow.recordSnapshot(StockCheckSnapshot.END_OF_DAY, BigDecimal.valueOf(4), BigDecimal.ZERO,
            employee, OffsetDateTime.now(), false);
        yesterdayRowIs(yesterdayRow);
        when(stockCheckRepository.findFirstByStoreInventoryItemIdAndCheckDateBeforeOrderByCheckDateDesc(ITEM_ID, LocalDate.now()))
            .thenReturn(Optional.of(yesterdayRow));

        stockCheckService.submitCheck(EMPLOYEE_ID, startOfDay(4));

        verify(stockCheckRepository).save(any(StockCheck.class));
    }

    @Test
    void anItemWithNoRowYesterdayIsNotBlocked() {
        stockCheckService.submitCheck(EMPLOYEE_ID, startOfDay(7));

        verify(stockCheckRepository).save(any(StockCheck.class));
    }

    @Test
    void resavingTodaysExistingStartOfDayIsNotBlocked() {
        StockCheck today = new StockCheck();
        today.setStore(store);
        today.setStoreInventoryItem(milk);
        today.setCheckDate(LocalDate.now());
        today.recordSnapshot(StockCheckSnapshot.START_OF_DAY, BigDecimal.valueOf(8), BigDecimal.ZERO,
            employee, OffsetDateTime.now().minusHours(1), false);
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now())).thenReturn(Optional.of(today));
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, yesterday))
            .thenReturn(Optional.of(yesterdayWithStartOnly(10)));

        stockCheckService.submitCheck(EMPLOYEE_ID, startOfDay(7));

        verify(stockCheckRepository).save(today);
    }

    @Test
    void checklistFlagsTheItemWhoseEndOfDayWasMissedYesterday() {
        when(stockCheckRepository.findMissedEndOfDay(STORE_ID, yesterday)).thenReturn(List.of(yesterdayWithStartOnly(10)));
        when(storeInventoryItemRepository.findByStoreIdAndActiveTrueOrderById(STORE_ID)).thenReturn(List.of(milk));

        List<DailyStockCheckItemResponse> checklist = stockCheckService.getTodayChecklist(EMPLOYEE_ID, STORE_ID);

        assertThat(checklist).hasSize(1);
        assertThat(checklist.get(0).missedEndOfDay()).isNotNull();
        assertThat(checklist.get(0).missedEndOfDay().date()).isEqualTo(yesterday);
    }

    @Test
    void checklistHasNoFlagWhenNothingWasMissed() {
        when(stockCheckRepository.findMissedEndOfDay(STORE_ID, yesterday)).thenReturn(List.of());
        when(storeInventoryItemRepository.findByStoreIdAndActiveTrueOrderById(STORE_ID)).thenReturn(List.of(milk));

        assertThat(stockCheckService.getTodayChecklist(EMPLOYEE_ID, STORE_ID).get(0).missedEndOfDay()).isNull();
    }

    @Test
    void checklistLocksEndOfDayAfterItsCountApprovalIsApproved() {
        StockCheck today = new StockCheck();
        today.setStore(store);
        today.setStoreInventoryItem(milk);
        today.setCheckDate(LocalDate.now());
        today.recordSnapshot(StockCheckSnapshot.START_OF_DAY, BigDecimal.valueOf(10), BigDecimal.ZERO,
            employee, OffsetDateTime.now().minusHours(9), false);
        today.recordSnapshot(StockCheckSnapshot.END_OF_DAY, BigDecimal.valueOf(15), BigDecimal.ZERO,
            employee, OffsetDateTime.now(), false);
        StockReceiptRequest approved = new StockReceiptRequest();
        approved.setStoreInventoryItem(milk);
        approved.setStatus(StockReceiptRequestStatus.APPROVED);
        approved.setHoldsSnapshot(true);

        when(storeInventoryItemRepository.findByStoreIdAndActiveTrueOrderById(STORE_ID)).thenReturn(List.of(milk));
        when(stockCheckRepository.findForStoreOnDate(STORE_ID, LocalDate.now())).thenReturn(List.of(today));
        when(stockCheckRepository.findMissedEndOfDay(STORE_ID, yesterday)).thenReturn(List.of());
        when(stockReceiptRequestRepository.findByStoreIdAndCheckDateAndSnapshotOrderByIdAsc(
            STORE_ID, LocalDate.now(), StockCheckSnapshot.END_OF_DAY)).thenReturn(List.of(approved));
        when(stockReceiptRequestRepository.findByStoreIdAndCheckDateAndStatus(
            STORE_ID, LocalDate.now(), StockReceiptRequestStatus.PENDING)).thenReturn(List.of());
        when(orderListService.itemIdsOrderedOn(STORE_ID, LocalDate.now())).thenReturn(Set.of());
        when(stockShortageReportRepository.findItemIdsWithReportOn(STORE_ID, LocalDate.now())).thenReturn(List.of());
        when(orderListService.orderedEntriesByItem(STORE_ID)).thenReturn(Map.of());
        when(stockCheckRepository.findLatestBeforeForStore(STORE_ID, LocalDate.now())).thenReturn(List.of());
        when(stockCheckReceiptRepository.findUnappliedForStore(STORE_ID)).thenReturn(List.of());

        List<DailyStockCheckItemResponse> checklist = stockCheckService.getTodayChecklist(EMPLOYEE_ID, STORE_ID);

        assertThat(checklist).hasSize(1);
        assertThat(checklist.get(0).endOfDayLocked()).isTrue();
        assertThat(checklist.get(0).endOfDayReview()).isNull();
    }

    // ---- Answering ----------------------------------------------------------

    @Test
    void anEmployeeCanCountYesterdaysEndOfDayAndIsRecordedWithoutTouchingTheOrderList() {
        StockCheck row = yesterdayWithStartOnly(10);
        yesterdayRowIs(row);

        MissedEndOfDayResponse.Item item = stockCheckService.answerMissedEndOfDayAsEmployee(EMPLOYEE_ID, count(6, 1));

        assertThat(item.status()).isEqualTo(MissedEndOfDayResponse.COUNTED);
        assertThat(row.getEndOfDayAvailable()).isEqualByComparingTo("6");
        assertThat(row.getEndOfDayDeadStock()).isEqualByComparingTo("1");
        assertThat(row.getEndOfDayEnteredBy()).isEqualTo(employee);
        assertThat(item.answeredByName()).isEqualTo("Sarah");
        verifyNoInteractions(orderListService);
    }

    @Test
    void theOwnerCanAnswerAndIsTheOneRecorded() {
        StockCheck row = yesterdayWithStartOnly(10);
        yesterdayRowIs(row);

        stockCheckService.answerMissedEndOfDayAsOwner(OWNER_ID, count(5, 0));

        assertThat(row.getEndOfDayEnteredBy()).isEqualTo(owner);
        verifyNoInteractions(orderListService);
    }

    @Test
    void onlyTheFirstAnswerIsAccepted() {
        StockCheck row = yesterdayWithStartOnly(10);
        yesterdayRowIs(row);
        stockCheckService.answerMissedEndOfDayAsEmployee(EMPLOYEE_ID, count(6, 0));

        assertThatThrownBy(() -> stockCheckService.answerMissedEndOfDayAsOwner(OWNER_ID, count(3, 0)))
            .isInstanceOf(StockCheckLockedException.class)
            .hasMessageContaining("Sarah");
        assertThat(row.getEndOfDayAvailable()).isEqualByComparingTo("6");
    }

    @Test
    void aCountHigherThanStartOfDayPlusReceivedIsRefused() {
        yesterdayRowIs(yesterdayWithStartOnly(10));

        assertThatThrownBy(() -> stockCheckService.answerMissedEndOfDayAsEmployee(EMPLOYEE_ID, count(25, 0)))
            .isInstanceOf(InvalidStockCheckException.class)
            .hasMessageContaining("higher than Start of Day");
    }

    @Test
    void deadStockCannotExceedAvailable() {
        yesterdayRowIs(yesterdayWithStartOnly(10));

        assertThatThrownBy(() -> stockCheckService.answerMissedEndOfDayAsEmployee(EMPLOYEE_ID, count(3, 4)))
            .isInstanceOf(InvalidStockCheckException.class);
    }

    @Test
    void aCountIsRequiredUnlessItIsMarkedNotCountable() {
        yesterdayRowIs(yesterdayWithStartOnly(10));

        assertThatThrownBy(() -> stockCheckService.answerMissedEndOfDayAsEmployee(
            EMPLOYEE_ID, new MissedEndOfDayAnswerRequest(STORE_ID, ITEM_ID, null, null, false, null)))
            .isInstanceOf(InvalidStockCheckException.class);
    }

    @Test
    void notCountableNeedsAtLeastFifteenWords() {
        StockCheck row = yesterdayWithStartOnly(10);
        yesterdayRowIs(row);

        assertThatThrownBy(() -> stockCheckService.answerMissedEndOfDayAsEmployee(
            EMPLOYEE_ID, couldNotCount("the freezer failed overnight and everything melted")))
            .isInstanceOf(InvalidStockCheckException.class)
            .hasMessageContaining("15 words");
        assertThat(row.isEndOfDaySkipped()).isFalse();
    }

    @Test
    void notCountableStoresTheReasonAndLeavesEndOfDayEmpty() {
        StockCheck row = yesterdayWithStartOnly(10);
        yesterdayRowIs(row);

        MissedEndOfDayResponse.Item item = stockCheckService.answerMissedEndOfDayAsEmployee(EMPLOYEE_ID, couldNotCount("  " + FIFTEEN_WORDS + "  "));

        assertThat(item.status()).isEqualTo(MissedEndOfDayResponse.COULD_NOT_COUNT);
        assertThat(item.reason()).isEqualTo(FIFTEEN_WORDS);
        assertThat(row.getEndOfDayAvailable()).isNull();
        assertThat(row.getEndOfDaySkippedReason()).isEqualTo(FIFTEEN_WORDS);
        assertThat(row.getEndOfDaySkippedBy()).isEqualTo(employee);
        assertThat(row.isEndOfDaySkipped()).isTrue();
        verifyNoInteractions(orderListService);
    }

    @Test
    void anExplainedDayCannotBeAnsweredAgain() {
        StockCheck row = yesterdayWithStartOnly(10);
        yesterdayRowIs(row);
        stockCheckService.answerMissedEndOfDayAsOwner(OWNER_ID, couldNotCount(FIFTEEN_WORDS));

        assertThatThrownBy(() -> stockCheckService.answerMissedEndOfDayAsEmployee(EMPLOYEE_ID, count(5, 0)))
            .isInstanceOf(StockCheckLockedException.class);
    }

    @Test
    void aLaterCorrectionWithARealCountClearsTheNotCountableReason() {
        StockCheck row = yesterdayWithStartOnly(10);
        row.skipEndOfDay(FIFTEEN_WORDS, owner, OffsetDateTime.now());

        row.recordSnapshot(StockCheckSnapshot.END_OF_DAY, BigDecimal.valueOf(5), BigDecimal.ZERO, owner, OffsetDateTime.now(), true);

        assertThat(row.isEndOfDaySkipped()).isFalse();
        assertThat(row.getEndOfDaySkippedReason()).isNull();
    }

    @Test
    void onlyYesterdaysRowCanBeAnswered() {
        when(stockCheckRepository.lockByItemAndDate(ITEM_ID, yesterday)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> stockCheckService.answerMissedEndOfDayAsEmployee(EMPLOYEE_ID, count(5, 0)))
            .isInstanceOf(StoreInventoryItemNotFoundException.class);
    }

    @Test
    void aRowFromAnotherStoreIsNotFound() {
        Store other = new Store();
        ReflectionTestUtils.setField(other, "id", 99L);
        StockCheck row = yesterdayWithStartOnly(10);
        row.setStore(other);
        yesterdayRowIs(row);

        assertThatThrownBy(() -> stockCheckService.answerMissedEndOfDayAsEmployee(EMPLOYEE_ID, count(5, 0)))
            .isInstanceOf(StoreInventoryItemNotFoundException.class);
    }

    @Test
    void anEmployeeMustBeAssignedToTheStore() {
        org.mockito.Mockito.doThrow(new com.nforce.retailops.exception.StoreNotFoundException("Store not found"))
            .when(userProfileService).requireAssignedStore(EMPLOYEE_ID, STORE_ID);

        assertThatThrownBy(() -> stockCheckService.answerMissedEndOfDayAsEmployee(EMPLOYEE_ID, count(5, 0)))
            .isInstanceOf(com.nforce.retailops.exception.StoreNotFoundException.class);
        verify(stockCheckRepository, never()).lockByItemAndDate(any(), any());
    }
}
