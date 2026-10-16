package com.nforce.retailops.service;

import static com.nforce.retailops.TestDecimals.bd;
import com.nforce.retailops.dto.CreateOrderListEntryRequest;
import com.nforce.retailops.dto.OrderHistoryEntryResponse;
import com.nforce.retailops.dto.OrderHistoryPageResponse;
import com.nforce.retailops.dto.SupplierPurchaseMetricResponse;
import com.nforce.retailops.dto.UpdateOrderListEntryRequest;
import com.nforce.retailops.entity.OrderListEntry;
import com.nforce.retailops.entity.OrderStatus;
import com.nforce.retailops.entity.StockCheck;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.dto.OrderListEntryResponse;
import com.nforce.retailops.exception.InvalidDateRangeException;
import com.nforce.retailops.exception.InvalidOrderEntryTransitionException;
import com.nforce.retailops.exception.OrderEntryAlreadyUpdatedException;
import com.nforce.retailops.exception.InvalidOrderListEntryException;
import com.nforce.retailops.exception.OrderListEntryNotFoundException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.OrderListEntryRepository;
import com.nforce.retailops.repository.StockCheckRepository;
import com.nforce.retailops.repository.StoreInventoryItemRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.SupplierRepository;
import com.nforce.retailops.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OrderListServiceTest {

    private static final Long OWNER_ID = 1L;
    private static final Long STORE_ID = 10L;
    private static final Long ITEM_ID = 20L;

    @Mock private OrderListEntryRepository orderListEntryRepository;
    @Mock private StoreOwnerRepository storeOwnerRepository;
    @Mock private StoreRepository storeRepository;
    @Mock private SupplierRepository supplierRepository;
    @Mock private StoreInventoryItemRepository storeInventoryItemRepository;
    @Mock private UserRepository userRepository;
    @Mock private StockReceiptService stockReceiptService;
    @Mock private StockCheckRepository stockCheckRepository;

    @InjectMocks
    private OrderListService orderListService;

    private Store store() {
        Store store = new Store();
        ReflectionTestUtils.setField(store, "id", STORE_ID);
        return store;
    }

    private StoreInventoryItem item() {
        StoreInventoryItem item = new StoreInventoryItem();
        ReflectionTestUtils.setField(item, "id", ITEM_ID);
        item.setName("Milk");
        return item;
    }

    private static final OrderStatus NEEDS = OrderStatus.NEEDS_ORDERING;

    private void stubOpenSystemEntry(OrderListEntry... entries) {
        when(orderListEntryRepository.findByStoreIdAndStoreInventoryItemIdAndStatusAndAdHocFalse(STORE_ID, ITEM_ID, NEEDS))
            .thenReturn(List.of(entries));
    }

    private void stubWaitingEntry(OrderListEntry... entries) {
        when(orderListEntryRepository.findByStoreIdAndStoreInventoryItemIdAndStatusOrderByCreatedAtAsc(STORE_ID, ITEM_ID, NEEDS))
            .thenReturn(List.of(entries));
    }

    @Test
    void upsertShortageCreatesANewEntryWhenNoneIsOpen() {
        stubWaitingEntry();
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        User employee = new User();
        orderListService.upsertShortage(store(), item(), bd(5), null, false, employee, null);

        ArgumentCaptor<OrderListEntry> captor = ArgumentCaptor.forClass(OrderListEntry.class);
        verify(orderListEntryRepository).save(captor.capture());
        OrderListEntry saved = captor.getValue();
        assertThat(saved.getQuantityNeeded()).isEqualByComparingTo(bd(5));
        assertThat(saved.getStatus()).isEqualTo(OrderStatus.NEEDS_ORDERING);
        assertThat(saved.isAdHoc()).isFalse();
        assertThat(saved.getRaisedBy()).isEqualTo(employee);
    }

    @Test
    void upsertShortageRecordsTheStockAndMinimumItWasRaisedAgainst() {
        StoreInventoryItem milk = item();
        milk.setMinWeekday(bd(8));
        milk.setMinWeekend(bd(8));
        com.nforce.retailops.entity.StockCheck check = new com.nforce.retailops.entity.StockCheck();
        ReflectionTestUtils.setField(check, "currentCount", bd(3));
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, java.time.LocalDate.now()))
            .thenReturn(java.util.Optional.of(check));
        stubWaitingEntry();
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        OrderListEntry saved = orderListService.upsertShortage(store(), milk, bd(2), null, true, new User(), null);

        assertThat(saved.getStockAtOrder()).isEqualByComparingTo(bd(3));
        assertThat(saved.getMinimumAtOrder()).isEqualByComparingTo(bd(8));
    }

    @Test
    void anOrderedEntryKeepsItsStockSnapshotWhenALaterShortageIsRaisedBesideIt() {
        OrderListEntry ordered = new OrderListEntry();
        ordered.setStatus(OrderStatus.ORDERED);
        ordered.setQuantityNeeded(bd(3));
        ordered.setStockSnapshot(bd(5), bd(8), "Ananya", java.time.OffsetDateTime.now());
        when(orderListEntryRepository.findByStoreIdAndStoreInventoryItemIdAndStatusOrderByCreatedAtAsc(STORE_ID, ITEM_ID, OrderStatus.ORDERED))
            .thenReturn(List.of(ordered));
        stubWaitingEntry();
        com.nforce.retailops.entity.StockCheck check = new com.nforce.retailops.entity.StockCheck();
        ReflectionTestUtils.setField(check, "currentCount", bd(3));
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, java.time.LocalDate.now()))
            .thenReturn(java.util.Optional.of(check));
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        OrderListEntry fresh = orderListService.upsertShortage(store(), item(), bd(5), null, false, new User(), null);

        assertThat(fresh.getQuantityNeeded()).isEqualByComparingTo(bd(2));
        assertThat(fresh.getStockAtOrder()).isEqualByComparingTo(bd(3));
        assertThat(ordered.getStockAtOrder()).isEqualByComparingTo(bd(5));
        assertThat(ordered.getMinimumAtOrder()).isEqualByComparingTo(bd(8));
        assertThat(ordered.getStockAtOrderByName()).isEqualTo("Ananya");
        assertThat(fresh.getStockAtOrderAt()).isNotNull();
    }

    @Test
    void upsertShortageUpdatesTheOpenSystemEntryInsteadOfCreatingASecondOne() {
        OrderListEntry existing = new OrderListEntry();
        ReflectionTestUtils.setField(existing, "id", 99L);
        existing.setQuantityNeeded(bd(4));
        existing.setStatus(OrderStatus.NEEDS_ORDERING);

        stubWaitingEntry(existing);
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        orderListService.upsertShortage(store(), item(), bd(6), null, false, new User(), null);

        verify(orderListEntryRepository, times(1)).save(existing);
        assertThat(existing.getQuantityNeeded()).isEqualByComparingTo(bd(6));
    }

    @Test
    void upsertShortageLeavesAnOrderedEntryAloneAndRaisesAFreshRowBesideIt() {
        // No open (Needs Ordering) system row: the only active one is Ordered
        // and is not returned by the Needs Ordering lookup.
        stubWaitingEntry();
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        orderListService.upsertShortage(store(), item(), bd(5), null, false, new User(), null);

        ArgumentCaptor<OrderListEntry> captor = ArgumentCaptor.forClass(OrderListEntry.class);
        verify(orderListEntryRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(OrderStatus.NEEDS_ORDERING);
        assertThat(captor.getValue().getQuantityNeeded()).isEqualByComparingTo(bd(5));
    }

    @Test
    void upsertShortageRetriesAsAnUpdateWhenTheInsertLosesAUniquenessRace() {
        OrderListEntry winner = new OrderListEntry();
        ReflectionTestUtils.setField(winner, "id", 77L);
        winner.setStatus(OrderStatus.NEEDS_ORDERING);

        when(orderListEntryRepository.findByStoreIdAndStoreInventoryItemIdAndStatusOrderByCreatedAtAsc(STORE_ID, ITEM_ID, NEEDS))
            .thenReturn(List.of())
            .thenReturn(List.of(winner));
        when(orderListEntryRepository.save(any(OrderListEntry.class)))
            .thenThrow(new DataIntegrityViolationException("duplicate key"))
            .thenAnswer(inv -> inv.getArgument(0));

        orderListService.upsertShortage(store(), item(), bd(4), null, false, new User(), null);

        assertThat(winner.getQuantityNeeded()).isEqualByComparingTo(bd(4));
        verify(orderListEntryRepository, times(2)).save(any(OrderListEntry.class));
    }

    @Test
    void upsertShortageAdHocTopsUpTheManualColumnOfTheWaitingRow() {
        OrderListEntry existing = new OrderListEntry();
        ReflectionTestUtils.setField(existing, "id", 99L);
        existing.setQuantityNeeded(bd(4));
        existing.setStatus(OrderStatus.NEEDS_ORDERING);
        stubWaitingEntry(existing);
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        orderListService.upsertShortage(store(), item(), bd(2), null, true, new User(), null);
        orderListService.upsertShortage(store(), item(), bd(3), null, true, new User(), null);

        assertThat(existing.getQuantityNeeded()).isEqualByComparingTo(bd(4));
        assertThat(existing.getManualAddition()).isEqualByComparingTo(bd(5));
    }

    @Test
    void upsertShortageAdHocCreatesItsOwnRowWhenTheExistingOneIsAlreadyOrdered() {
        // The Ordered row is not a "waiting" row, so the lookup finds nothing.
        stubWaitingEntry();
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        orderListService.upsertShortage(store(), item(), bd(2), null, true, new User(), null);

        ArgumentCaptor<OrderListEntry> captor = ArgumentCaptor.forClass(OrderListEntry.class);
        verify(orderListEntryRepository).save(captor.capture());
        assertThat(captor.getValue().getQuantityNeeded()).isEqualByComparingTo(bd(2));
        assertThat(captor.getValue().isAdHoc()).isTrue();
        assertThat(captor.getValue().getStatus()).isEqualTo(OrderStatus.NEEDS_ORDERING);
    }

    private void stubOnOrder(OrderListEntry... ordered) {
        when(orderListEntryRepository.findByStoreIdAndStoreInventoryItemIdAndStatusOrderByCreatedAtAsc(STORE_ID, ITEM_ID, OrderStatus.ORDERED))
            .thenReturn(List.of(ordered));
    }

    private OrderListEntry entry(OrderStatus status, int quantity) {
        OrderListEntry entry = new OrderListEntry();
        entry.setStatus(status);
        entry.setQuantityNeeded(bd(quantity));
        return entry;
    }

    @Test
    void reportedShortageTopsUpTheWaitingRowByOnlyWhatIsMissing() {
        // Minimum 5, nothing left, 1 already waiting: add 4 to the same row.
        OrderListEntry waiting = entry(OrderStatus.NEEDS_ORDERING, 1);
        stubWaitingEntry(waiting);
        stubOnOrder();
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        orderListService.upsertReportedShortage(store(), item(), bd(5), null, new User(), null, false, false);

        verify(orderListEntryRepository, times(1)).save(waiting);
        assertThat(waiting.totalQuantityOrdered()).isEqualByComparingTo(bd(5));
    }

    @Test
    void reportedShortageSubtractsWhatIsAlreadyOrderedAndRaisesTheRemainder() {
        stubWaitingEntry();
        stubOnOrder(entry(OrderStatus.ORDERED, 1));
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        orderListService.upsertReportedShortage(store(), item(), bd(5), null, new User(), null, false, false);

        ArgumentCaptor<OrderListEntry> captor = ArgumentCaptor.forClass(OrderListEntry.class);
        verify(orderListEntryRepository).save(captor.capture());
        assertThat(captor.getValue().getQuantityNeeded()).isEqualByComparingTo(bd(4));
        assertThat(captor.getValue().getStatus()).isEqualTo(OrderStatus.NEEDS_ORDERING);
    }

    @Test
    void reportedShortageIgnoresTheOrderedQuantityWhenItIsConfirmedReceived() {
        stubWaitingEntry();
        stubOnOrder(entry(OrderStatus.ORDERED, 1));
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        orderListService.upsertReportedShortage(store(), item(), bd(5), null, new User(), null, true, false);

        ArgumentCaptor<OrderListEntry> captor = ArgumentCaptor.forClass(OrderListEntry.class);
        verify(orderListEntryRepository).save(captor.capture());
        assertThat(captor.getValue().getQuantityNeeded()).isEqualByComparingTo(bd(5));
    }

    @Test
    void outOfStockReportPutsTheRestInTheNeedsColumnAndFlagsItUrgent() {
        // Minimum 8, SOD was 3 so 5 is waiting; stock is now 0: needs becomes 8, manual stays 0.
        OrderListEntry waiting = entry(OrderStatus.NEEDS_ORDERING, 5);
        stubWaitingEntry(waiting);
        stubOnOrder();
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        orderListService.upsertReportedShortage(store(), item(), bd(8), null, new User(), null, false, true);

        assertThat(waiting.getQuantityNeeded()).isEqualByComparingTo(bd(8));
        assertThat(waiting.getManualAddition()).isEqualByComparingTo(bd(0));
        assertThat(waiting.isUrgent()).isTrue();
    }

    @Test
    void outOfStockReportFlagsAnAlreadyCoveringRowUrgentWithoutChangingQuantity() {
        OrderListEntry waiting = entry(OrderStatus.NEEDS_ORDERING, 8);
        stubWaitingEntry(waiting);
        stubOnOrder();
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        orderListService.upsertReportedShortage(store(), item(), bd(8), null, new User(), null, false, true);

        assertThat(waiting.getQuantityNeeded()).isEqualByComparingTo(bd(8));
        assertThat(waiting.isUrgent()).isTrue();
    }

    @Test
    void startOfDayZeroCountFlagsTheRowUrgentAndReportsItNewly() {
        OrderListEntry waiting = entry(OrderStatus.NEEDS_ORDERING, 4);
        stubOnOrder();
        stubWaitingEntry(waiting);
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        boolean newlyUrgent = orderListService.reconcileStartOfDayShortage(store(), item(), bd(8), true, new User(), null);

        assertThat(newlyUrgent).isTrue();
        assertThat(waiting.isUrgent()).isTrue();
    }

    @Test
    void reportedShortageRaisesNothingWhenExistingRowsAlreadyCoverIt() {
        stubWaitingEntry(entry(OrderStatus.NEEDS_ORDERING, 2));
        stubOnOrder(entry(OrderStatus.ORDERED, 3));

        OrderListEntry result = orderListService.upsertReportedShortage(store(), item(), bd(5), null, new User(), null, false, false);

        assertThat(result).isNull();
        verify(orderListEntryRepository, never()).save(any());
    }

    @Test
    void upsertShortageFromACountIsNetOfStockAlreadyOnOrder() {
        OrderListEntry ordered = new OrderListEntry();
        ordered.setStatus(OrderStatus.ORDERED);
        ordered.setQuantityNeeded(bd(3));
        ordered.setManualAddition(bd(1));
        stubOnOrder(ordered);
        stubWaitingEntry();
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        orderListService.upsertShortage(store(), item(), bd(5), null, false, new User(), null);

        ArgumentCaptor<OrderListEntry> captor = ArgumentCaptor.forClass(OrderListEntry.class);
        verify(orderListEntryRepository).save(captor.capture());
        assertThat(captor.getValue().getQuantityNeeded()).isEqualByComparingTo(bd(1));
        assertThat(ordered.getQuantityNeeded()).isEqualByComparingTo(bd(3));
    }

    @Test
    void upsertShortageFromACountRaisesNothingWhenOrderedStockCoversIt() {
        OrderListEntry ordered = new OrderListEntry();
        ordered.setStatus(OrderStatus.ORDERED);
        ordered.setQuantityNeeded(bd(5));
        stubOnOrder(ordered);
        stubOpenSystemEntry();

        OrderListEntry result = orderListService.upsertShortage(store(), item(), bd(5), null, false, new User(), null);

        assertThat(result).isNull();
        verify(orderListEntryRepository, never()).save(any());
    }

    @Test
    void upsertShortageFromACountKeepsTheManualFigureOnTheWaitingRow() {
        OrderListEntry existing = new OrderListEntry();
        ReflectionTestUtils.setField(existing, "id", 99L);
        existing.setQuantityNeeded(bd(4));
        existing.setManualAddition(bd(2));
        existing.setStatus(OrderStatus.NEEDS_ORDERING);
        stubWaitingEntry(existing);
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        orderListService.upsertShortage(store(), item(), bd(7), null, false, new User(), null);

        assertThat(existing.getQuantityNeeded()).isEqualByComparingTo(bd(7));
        assertThat(existing.getManualAddition()).isEqualByComparingTo(bd(2));
    }

    // ---- Start of Day reconciliation (RTS-369) ----

    @Test
    void startOfDayRecalculatesYesterdaysWaitingRowInPlaceInsteadOfDuplicatingIt() {
        OrderListEntry waiting = entry(OrderStatus.NEEDS_ORDERING, 4);
        stubOnOrder();
        stubWaitingEntry(waiting);
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        orderListService.reconcileStartOfDayShortage(store(), item(), bd(7), false, new User(), null);

        verify(orderListEntryRepository, times(1)).save(waiting);
        assertThat(waiting.getQuantityNeeded()).isEqualByComparingTo(bd(7));
        assertThat(waiting.getStatus()).isEqualTo(OrderStatus.NEEDS_ORDERING);
    }

    @Test
    void startOfDayWithNoShortageWithdrawsTheWaitingSystemRow() {
        OrderListEntry waiting = entry(OrderStatus.NEEDS_ORDERING, 4);
        stubOpenSystemEntry(waiting);
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        orderListService.reconcileStartOfDayShortage(store(), item(), bd(0), false, new User(), null);

        assertThat(waiting.getStatus()).isEqualTo(OrderStatus.RECEIVED);
    }

    @Test
    void startOfDayKeepsAnOrderedRowAndRaisesASeparateRowForTheShortfall() {
        OrderListEntry ordered = entry(OrderStatus.ORDERED, 3);
        stubOnOrder(ordered);
        stubWaitingEntry();
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        orderListService.reconcileStartOfDayShortage(store(), item(), bd(5), false, new User(), null);

        ArgumentCaptor<OrderListEntry> captor = ArgumentCaptor.forClass(OrderListEntry.class);
        verify(orderListEntryRepository).save(captor.capture());
        assertThat(captor.getValue()).isNotSameAs(ordered);
        assertThat(captor.getValue().getStatus()).isEqualTo(OrderStatus.NEEDS_ORDERING);
        assertThat(captor.getValue().getQuantityNeeded()).isEqualByComparingTo(bd(2));
        assertThat(ordered.getQuantityNeeded()).isEqualByComparingTo(bd(3));
        assertThat(ordered.getStatus()).isEqualTo(OrderStatus.ORDERED);
    }

    @Test
    void startOfDayRaisesNothingWhenTheOrderedRowAlreadyCoversTheShortage() {
        stubOnOrder(entry(OrderStatus.ORDERED, 5));
        stubOpenSystemEntry();

        orderListService.reconcileStartOfDayShortage(store(), item(), bd(5), false, new User(), null);

        verify(orderListEntryRepository, never()).save(any());
    }

    @Test
    void markOrderedIsRejectedOnceTodaysStartOfDayIsInAndEndOfDayIsNot() {
        when(storeOwnerRepository.findByOwnerId(OWNER_ID)).thenReturn(List.of(storeOwner()));
        OrderListEntry entry = entryWithStatus(OrderStatus.NEEDS_ORDERING);
        when(orderListEntryRepository.findByIdAndStoreId(ENTRY_ID, STORE_ID)).thenReturn(Optional.of(entry));
        StockCheck check = new StockCheck();
        ReflectionTestUtils.setField(check, "startOfDayAvailable", bd(3));
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now()))
            .thenReturn(Optional.of(check));

        assertThatThrownBy(() -> orderListService.markOrdered(OWNER_ID, ENTRY_ID))
            .isInstanceOf(InvalidOrderEntryTransitionException.class);
        assertThat(entry.getStatus()).isEqualTo(OrderStatus.NEEDS_ORDERING);
    }

    @Test
    void markOrderedIsAllowedAgainOnceTodaysEndOfDayIsSaved() {
        when(storeOwnerRepository.findByOwnerId(OWNER_ID)).thenReturn(List.of(storeOwner()));
        when(userRepository.getReferenceById(OWNER_ID)).thenReturn(new User());
        OrderListEntry entry = entryWithStatus(OrderStatus.NEEDS_ORDERING);
        when(orderListEntryRepository.findByIdAndStoreId(ENTRY_ID, STORE_ID)).thenReturn(Optional.of(entry));
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));
        StockCheck check = new StockCheck();
        ReflectionTestUtils.setField(check, "startOfDayAvailable", bd(3));
        ReflectionTestUtils.setField(check, "endOfDayAvailable", bd(1));
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now()))
            .thenReturn(Optional.of(check));

        assertThat(orderListService.markOrdered(OWNER_ID, ENTRY_ID).status()).isEqualTo("ORDERED");
    }

    @Test
    void resolveShortageIfPresentClosesOnlyTheOpenSystemRow() {
        OrderListEntry existing = new OrderListEntry();
        ReflectionTestUtils.setField(existing, "id", 55L);
        existing.setStatus(OrderStatus.NEEDS_ORDERING);

        stubOpenSystemEntry(existing);
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        orderListService.resolveShortageIfPresent(store(), item());

        assertThat(existing.getStatus()).isEqualTo(OrderStatus.RECEIVED);
        verify(orderListEntryRepository).save(existing);
    }

    @Test
    void resolveShortageIfPresentIsANoOpWhenOnlyOrderedOrManualRowsExist() {
        stubOpenSystemEntry();

        orderListService.resolveShortageIfPresent(store(), item());

        verify(orderListEntryRepository, never()).save(any());
    }

    private static final Long ENTRY_ID = 55L;

    private StoreOwner storeOwner() {
        StoreOwner storeOwner = new StoreOwner();
        storeOwner.setStore(store());
        storeOwner.setActive(true);
        return storeOwner;
    }

    private OrderListEntry entryWithStatus(OrderStatus status) {
        OrderListEntry entry = new OrderListEntry();
        ReflectionTestUtils.setField(entry, "id", ENTRY_ID);
        entry.setStore(store());
        entry.setStoreInventoryItem(item());
        entry.setStatus(status);
        entry.setQuantityNeeded(bd(5));
        return entry;
    }

    @Test
    void updateEntryAllowsTheSingleLegalForwardStep() {
        when(storeOwnerRepository.findByOwnerId(OWNER_ID)).thenReturn(List.of(storeOwner()));
        when(userRepository.getReferenceById(OWNER_ID)).thenReturn(new User());
        OrderListEntry entry = entryWithStatus(OrderStatus.NEEDS_ORDERING);
        when(orderListEntryRepository.findByIdAndStoreId(ENTRY_ID, STORE_ID)).thenReturn(Optional.of(entry));
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        orderListService.updateEntry(OWNER_ID, ENTRY_ID, new UpdateOrderListEntryRequest(bd(5), null, null, OrderStatus.ORDERED));

        assertThat(entry.getStatus()).isEqualTo(OrderStatus.ORDERED);
        assertThat(entry.getOrderedAt()).isNotNull();
    }

    @Test
    void markOrderedMovesNeedsOrderingToOrderedAndRecordsWhenWithoutTouchingTheRest() {
        when(storeOwnerRepository.findByOwnerId(OWNER_ID)).thenReturn(List.of(storeOwner()));
        when(userRepository.getReferenceById(OWNER_ID)).thenReturn(new User());
        OrderListEntry entry = entryWithStatus(OrderStatus.NEEDS_ORDERING);
        entry.setNote("urgent");
        when(orderListEntryRepository.findByIdAndStoreId(ENTRY_ID, STORE_ID)).thenReturn(Optional.of(entry));
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        OrderListEntryResponse response = orderListService.markOrdered(OWNER_ID, ENTRY_ID);

        assertThat(response.status()).isEqualTo("ORDERED");
        assertThat(entry.getOrderedAt()).isNotNull();
        assertThat(entry.getQuantityNeeded()).isEqualByComparingTo(bd(5));
        assertThat(entry.getNote()).isEqualTo("urgent");
    }

    @Test
    void markOrderedRejectsAnEntryThatIsAlreadyOrdered() {
        when(storeOwnerRepository.findByOwnerId(OWNER_ID)).thenReturn(List.of(storeOwner()));
        OrderListEntry entry = entryWithStatus(OrderStatus.ORDERED);
        when(orderListEntryRepository.findByIdAndStoreId(ENTRY_ID, STORE_ID)).thenReturn(Optional.of(entry));

        assertThatThrownBy(() -> orderListService.markOrdered(OWNER_ID, ENTRY_ID))
            .isInstanceOf(OrderEntryAlreadyUpdatedException.class);
    }

    @Test
    void receivingAnOrderKeepsWhenItWasOrdered() {
        when(storeOwnerRepository.findByOwnerId(OWNER_ID)).thenReturn(List.of(storeOwner()));
        OrderListEntry entry = entryWithStatus(OrderStatus.ORDERED);
        OffsetDateTime orderedAt = OffsetDateTime.now().minusDays(1);
        entry.setOrderedAt(orderedAt);
        when(userRepository.getReferenceById(OWNER_ID)).thenReturn(new User());
        when(orderListEntryRepository.findByIdAndStoreId(ENTRY_ID, STORE_ID)).thenReturn(Optional.of(entry));
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));
        when(stockReceiptService.applyReceipt(any(), any(), any(), any()))
            .thenReturn(new StockReceiptService.Result(false, null, null, bd(0)));

        orderListService.updateEntry(OWNER_ID, ENTRY_ID, new UpdateOrderListEntryRequest(bd(5), null, null, OrderStatus.RECEIVED));

        assertThat(entry.getOrderedAt()).isEqualTo(orderedAt);
    }

    @Test
    void orderedInfoForYesterdayLooksThroughTodayAndPicksTheEarliestOrder() {
        java.time.LocalDate yesterday = java.time.LocalDate.now().minusDays(1);
        OrderListEntry early = entryWithStatus(OrderStatus.ORDERED);
        early.setOrderedAt(OrderListService.rangeStart(yesterday).plusHours(9));
        OrderListEntry late = entryWithStatus(OrderStatus.ORDERED);
        late.setOrderedAt(OrderListService.rangeStart(java.time.LocalDate.now()).plusHours(9));
        when(orderListEntryRepository.findByStoreIdAndOrderedAtGreaterThanEqualAndOrderedAtLessThan(
            STORE_ID, OrderListService.rangeStart(yesterday), OrderListService.rangeEndExclusive(java.time.LocalDate.now())))
            .thenReturn(List.of(late, early));

        var info = orderListService.orderedInfoByItemFor(STORE_ID, yesterday);

        assertThat(info).hasSize(1);
        assertThat(info.values().iterator().next().orderedOn()).isEqualTo(yesterday);
    }

    @Test
    void orderedInfoForTodayAlsoIncludesEarlierOrdersStillAwaitingDelivery() {
        java.time.LocalDate today = java.time.LocalDate.now();
        OrderListEntry outstanding = entryWithStatus(OrderStatus.ORDERED);
        outstanding.setOrderedAt(OrderListService.rangeStart(today).minusDays(1).plusHours(9));
        when(orderListEntryRepository.findByStoreIdAndOrderedAtGreaterThanEqualAndOrderedAtLessThan(
            STORE_ID, OrderListService.rangeStart(today), OrderListService.rangeEndExclusive(today)))
            .thenReturn(List.of());
        when(orderListEntryRepository.findByStoreIdAndStatusNotOrderByCreatedAtDesc(STORE_ID, OrderStatus.RECEIVED))
            .thenReturn(List.of(outstanding));

        var info = orderListService.orderedInfoByItemFor(STORE_ID, today);

        assertThat(info).hasSize(1);
        assertThat(info.values().iterator().next().orderedOn()).isEqualTo(today.minusDays(1));
    }

    @Test
    void orderedInfoForAnOlderDayOnlyLooksAtThatDay() {
        java.time.LocalDate older = java.time.LocalDate.now().minusDays(3);

        orderListService.orderedInfoByItemFor(STORE_ID, older);

        verify(orderListEntryRepository).findByStoreIdAndOrderedAtGreaterThanEqualAndOrderedAtLessThan(
            STORE_ID, OrderListService.rangeStart(older), OrderListService.rangeEndExclusive(older));
    }

    @Test
    void markingReceivedDefaultsTheReceivedQuantityToEverythingOrdered() {
        when(storeOwnerRepository.findByOwnerId(OWNER_ID)).thenReturn(List.of(storeOwner()));
        OrderListEntry entry = entryWithStatus(OrderStatus.ORDERED);
        entry.setManualAddition(bd(2));
        when(userRepository.getReferenceById(OWNER_ID)).thenReturn(new User());
        when(orderListEntryRepository.findByIdAndStoreId(ENTRY_ID, STORE_ID)).thenReturn(Optional.of(entry));
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));
        when(stockReceiptService.applyReceipt(any(), any(), any(), any()))
            .thenReturn(new StockReceiptService.Result(true, bd(10), bd(8), bd(0)));

        OrderListEntryResponse response = orderListService.updateEntry(
            OWNER_ID, ENTRY_ID, new UpdateOrderListEntryRequest(bd(5), null, null, OrderStatus.RECEIVED));

        assertThat(entry.getQuantityReceived()).isEqualByComparingTo(bd(7));
        verify(stockReceiptService).applyReceipt(any(), eq(bd(7)), any(User.class), eq(null));
        assertThat(response.receipt().stockUpdated()).isTrue();
        assertThat(response.receipt().shortfall()).isEqualByComparingTo(bd(0));
        verify(orderListEntryRepository, times(1)).save(any(OrderListEntry.class));
    }

    @Test
    void receivingBothOrdersClosesTheOtherRowWithoutASecondStockUpdate() {
        when(storeOwnerRepository.findByOwnerId(OWNER_ID)).thenReturn(List.of(storeOwner()));
        when(userRepository.getReferenceById(OWNER_ID)).thenReturn(new User());
        OrderListEntry lead = entryWithStatus(OrderStatus.ORDERED);
        OrderListEntry other = entryWithStatus(OrderStatus.ORDERED);
        ReflectionTestUtils.setField(other, "id", 56L);
        when(orderListEntryRepository.findByIdAndStoreId(ENTRY_ID, STORE_ID)).thenReturn(Optional.of(lead));
        when(orderListEntryRepository.findByIdAndStoreId(56L, STORE_ID)).thenReturn(Optional.of(other));
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));
        when(stockReceiptService.applyReceipt(any(), any(), any(), any()))
            .thenReturn(new StockReceiptService.Result(true, bd(8), bd(5), bd(0)));

        orderListService.updateEntry(OWNER_ID, ENTRY_ID,
            new UpdateOrderListEntryRequest(bd(5), null, null, OrderStatus.RECEIVED, null, bd(8), List.of(56L)));

        assertThat(other.getStatus()).isEqualTo(OrderStatus.RECEIVED);
        verify(stockReceiptService, times(1)).applyReceipt(any(), eq(bd(8)), any(), any());
    }

    @Test
    void receivingTogetherRejectsAnOtherRowThatIsNotOrdered() {
        when(storeOwnerRepository.findByOwnerId(OWNER_ID)).thenReturn(List.of(storeOwner()));
        when(userRepository.getReferenceById(OWNER_ID)).thenReturn(new User());
        OrderListEntry lead = entryWithStatus(OrderStatus.ORDERED);
        OrderListEntry other = entryWithStatus(OrderStatus.NEEDS_ORDERING);
        ReflectionTestUtils.setField(other, "id", 56L);
        when(orderListEntryRepository.findByIdAndStoreId(ENTRY_ID, STORE_ID)).thenReturn(Optional.of(lead));
        when(orderListEntryRepository.findByIdAndStoreId(56L, STORE_ID)).thenReturn(Optional.of(other));
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        assertThatThrownBy(() -> orderListService.updateEntry(OWNER_ID, ENTRY_ID,
            new UpdateOrderListEntryRequest(bd(5), null, null, OrderStatus.RECEIVED, null, bd(8), List.of(56L))))
            .isInstanceOf(InvalidOrderEntryTransitionException.class);
        verify(stockReceiptService, never()).applyReceipt(any(), any(), any(), any());
    }

    @Test
    void markingReceivedWithALowerQuantityUpdatesStockButRaisesNothingAutomatically() {
        when(storeOwnerRepository.findByOwnerId(OWNER_ID)).thenReturn(List.of(storeOwner()));
        when(userRepository.getReferenceById(OWNER_ID)).thenReturn(new User());
        OrderListEntry entry = entryWithStatus(OrderStatus.ORDERED);
        when(orderListEntryRepository.findByIdAndStoreId(ENTRY_ID, STORE_ID)).thenReturn(Optional.of(entry));
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));
        when(stockReceiptService.applyReceipt(any(), any(), any(), any()))
            .thenReturn(new StockReceiptService.Result(true, bd(6), bd(10), bd(4)));

        OrderListEntryResponse response = orderListService.updateEntry(OWNER_ID, ENTRY_ID,
            new UpdateOrderListEntryRequest(bd(5), null, null, OrderStatus.RECEIVED, null, bd(3)));

        assertThat(entry.getQuantityReceived()).isEqualByComparingTo(bd(3));
        verify(stockReceiptService).applyReceipt(any(), eq(bd(3)), any(), any());
        assertThat(response.receipt().shortfall()).isEqualByComparingTo(bd(4));
        verify(orderListEntryRepository, times(1)).save(any(OrderListEntry.class));
    }

    @Test
    void markingReceivedWithNoStockCountTodayReportsStockNotUpdated() {
        when(storeOwnerRepository.findByOwnerId(OWNER_ID)).thenReturn(List.of(storeOwner()));
        when(userRepository.getReferenceById(OWNER_ID)).thenReturn(new User());
        OrderListEntry entry = entryWithStatus(OrderStatus.ORDERED);
        when(orderListEntryRepository.findByIdAndStoreId(ENTRY_ID, STORE_ID)).thenReturn(Optional.of(entry));
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));
        when(stockReceiptService.applyReceipt(any(), any(), any(), any()))
            .thenReturn(new StockReceiptService.Result(false, null, bd(10), null));

        OrderListEntryResponse response = orderListService.updateEntry(OWNER_ID, ENTRY_ID,
            new UpdateOrderListEntryRequest(bd(5), null, null, OrderStatus.RECEIVED));

        assertThat(entry.getStatus()).isEqualTo(OrderStatus.RECEIVED);
        assertThat(response.receipt().stockUpdated()).isFalse();
        verify(orderListEntryRepository, times(1)).save(any(OrderListEntry.class));
    }

    @Test
    void movingToOrderedNeverTouchesStock() {
        when(storeOwnerRepository.findByOwnerId(OWNER_ID)).thenReturn(List.of(storeOwner()));
        when(userRepository.getReferenceById(OWNER_ID)).thenReturn(new User());
        OrderListEntry entry = entryWithStatus(OrderStatus.NEEDS_ORDERING);
        when(orderListEntryRepository.findByIdAndStoreId(ENTRY_ID, STORE_ID)).thenReturn(Optional.of(entry));
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        orderListService.updateEntry(OWNER_ID, ENTRY_ID, new UpdateOrderListEntryRequest(bd(5), null, null, OrderStatus.ORDERED));

        verify(stockReceiptService, never()).applyReceipt(any(), any(), any(), any());
    }

    @Test
    void updateEntryRejectsSkippingOrderedOnTheWayToReceived() {
        when(storeOwnerRepository.findByOwnerId(OWNER_ID)).thenReturn(List.of(storeOwner()));
        OrderListEntry entry = entryWithStatus(OrderStatus.NEEDS_ORDERING);
        when(orderListEntryRepository.findByIdAndStoreId(ENTRY_ID, STORE_ID)).thenReturn(Optional.of(entry));

        assertThatThrownBy(() ->
            orderListService.updateEntry(OWNER_ID, ENTRY_ID, new UpdateOrderListEntryRequest(bd(5), null, null, OrderStatus.RECEIVED))
        ).isInstanceOf(InvalidOrderEntryTransitionException.class);

        assertThat(entry.getStatus()).isEqualTo(OrderStatus.NEEDS_ORDERING);
        verify(orderListEntryRepository, never()).save(any());
    }

    @Test
    void updateEntryRejectsMovingBackward() {
        when(storeOwnerRepository.findByOwnerId(OWNER_ID)).thenReturn(List.of(storeOwner()));
        OrderListEntry entry = entryWithStatus(OrderStatus.ORDERED);
        when(orderListEntryRepository.findByIdAndStoreId(ENTRY_ID, STORE_ID)).thenReturn(Optional.of(entry));

        assertThatThrownBy(() ->
            orderListService.updateEntry(OWNER_ID, ENTRY_ID, new UpdateOrderListEntryRequest(bd(5), null, null, OrderStatus.NEEDS_ORDERING))
        ).isInstanceOf(InvalidOrderEntryTransitionException.class);

        assertThat(entry.getStatus()).isEqualTo(OrderStatus.ORDERED);
        verify(orderListEntryRepository, never()).save(any());
    }

    @Test
    void updateEntryAllowsEditingWithoutChangingStatus() {
        when(storeOwnerRepository.findByOwnerId(OWNER_ID)).thenReturn(List.of(storeOwner()));
        OrderListEntry entry = entryWithStatus(OrderStatus.ORDERED);
        when(orderListEntryRepository.findByIdAndStoreId(ENTRY_ID, STORE_ID)).thenReturn(Optional.of(entry));
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        orderListService.updateEntry(OWNER_ID, ENTRY_ID, new UpdateOrderListEntryRequest(bd(9), null, "note", OrderStatus.ORDERED));

        assertThat(entry.getStatus()).isEqualTo(OrderStatus.ORDERED);
        assertThat(entry.getQuantityNeeded()).isEqualByComparingTo(bd(9));
    }

    // ---- stale-update conflicts (Owner/Admin vs Super Admin) -----------------

    @Test
    void ownerUpdateIsRejectedWhenSuperAdminAlreadyMovedTheEntry() {
        OrderListEntry entry = entryWithStatus(OrderStatus.NEEDS_ORDERING);
        when(orderListEntryRepository.findByIdAndStoreId(ENTRY_ID, STORE_ID)).thenReturn(Optional.of(entry));
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));
        orderListService.updateStatusForSuperAdmin(STORE_ID, ENTRY_ID, OrderStatus.ORDERED, OrderStatus.NEEDS_ORDERING);

        when(storeOwnerRepository.findByOwnerId(OWNER_ID)).thenReturn(List.of(storeOwner()));

        assertThatThrownBy(() -> orderListService.updateEntry(OWNER_ID, ENTRY_ID,
            new UpdateOrderListEntryRequest(bd(5), null, null, OrderStatus.ORDERED, OrderStatus.NEEDS_ORDERING)))
            .isInstanceOf(OrderEntryAlreadyUpdatedException.class)
            .hasMessageContaining("by Super Admin");
    }

    @Test
    void superAdminUpdateIsRejectedWhenOwnerAlreadyMovedTheEntry() {
        when(storeOwnerRepository.findByOwnerId(OWNER_ID)).thenReturn(List.of(storeOwner()));
        when(userRepository.getReferenceById(OWNER_ID)).thenReturn(new User());
        OrderListEntry entry = entryWithStatus(OrderStatus.NEEDS_ORDERING);
        when(orderListEntryRepository.findByIdAndStoreId(ENTRY_ID, STORE_ID)).thenReturn(Optional.of(entry));
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));
        orderListService.updateEntry(OWNER_ID, ENTRY_ID,
            new UpdateOrderListEntryRequest(bd(5), null, null, OrderStatus.ORDERED, OrderStatus.NEEDS_ORDERING));

        assertThatThrownBy(() -> orderListService.updateStatusForSuperAdmin(
            STORE_ID, ENTRY_ID, OrderStatus.ORDERED, OrderStatus.NEEDS_ORDERING))
            .isInstanceOf(OrderEntryAlreadyUpdatedException.class)
            .hasMessageContaining("by Admin");
    }

    @Test
    void updateWithMatchingExpectedStatusStillSucceeds() {
        when(storeOwnerRepository.findByOwnerId(OWNER_ID)).thenReturn(List.of(storeOwner()));
        OrderListEntry entry = entryWithStatus(OrderStatus.ORDERED);
        when(orderListEntryRepository.findByIdAndStoreId(ENTRY_ID, STORE_ID)).thenReturn(Optional.of(entry));
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        orderListService.updateEntry(OWNER_ID, ENTRY_ID,
            new UpdateOrderListEntryRequest(bd(9), null, null, OrderStatus.ORDERED, OrderStatus.ORDERED));

        assertThat(entry.getQuantityNeeded()).isEqualByComparingTo(bd(9));
    }

    // ---- createEntry ("Add to order") ---------------------------------------

    private void stubActiveStoreOwner(Store store) {
        StoreOwner storeOwner = new StoreOwner();
        storeOwner.setStore(store);
        when(storeOwnerRepository.findByOwnerId(OWNER_ID)).thenReturn(List.of(storeOwner));
    }

    @Test
    void createEntryFromInventoryAddsToTheOrderListForAnExistingItem() {
        Store store = store();
        StoreInventoryItem milk = item();
        stubActiveStoreOwner(store);
        when(userRepository.getReferenceById(OWNER_ID)).thenReturn(new User());
        when(storeInventoryItemRepository.findByIdAndStoreId(ITEM_ID, STORE_ID)).thenReturn(Optional.of(milk));
        OrderListEntry savedEntry = new OrderListEntry();
        savedEntry.setStoreInventoryItem(milk);
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        orderListService.createEntry(OWNER_ID, new CreateOrderListEntryRequest(ITEM_ID, null, null, null, false, null, null, bd(5), null, "Extra for event"));

        ArgumentCaptor<OrderListEntry> captor = ArgumentCaptor.forClass(OrderListEntry.class);
        verify(orderListEntryRepository).save(captor.capture());
        assertThat(captor.getValue().getQuantityNeeded()).isEqualByComparingTo(bd(5));
        assertThat(captor.getValue().isAdHoc()).isTrue();
        verify(storeInventoryItemRepository, never()).save(any());
    }

    @Test
    void createEntryForACustomItemNotSavedToInventoryCreatesAnInactiveItem() {
        Store store = store();
        stubActiveStoreOwner(store);
        when(userRepository.getReferenceById(OWNER_ID)).thenReturn(new User());
        when(storeInventoryItemRepository.save(any(StoreInventoryItem.class))).thenAnswer(inv -> {
            StoreInventoryItem saved = inv.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", 99L);
            return saved;
        });
        OrderListEntry savedEntry = new OrderListEntry();
        savedEntry.setStoreInventoryItem(item());
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        orderListService.createEntry(OWNER_ID, new CreateOrderListEntryRequest(
            null, "Birthday candles", "SUPPLIES", "packs", false, null, null, bd(2), null, null));

        ArgumentCaptor<StoreInventoryItem> itemCaptor = ArgumentCaptor.forClass(StoreInventoryItem.class);
        verify(storeInventoryItemRepository).save(itemCaptor.capture());
        StoreInventoryItem saved = itemCaptor.getValue();
        assertThat(saved.getName()).isEqualTo("Birthday candles");
        assertThat(saved.getCategory()).isEqualTo("SUPPLIES");
        assertThat(saved.isActive()).isFalse();
        assertThat(saved.getMinWeekday()).isEqualByComparingTo(bd(0));
        assertThat(saved.getMinWeekend()).isNull();
    }

    @Test
    void createEntryForACustomItemSavedToInventoryCreatesAnActiveItem() {
        stubActiveStoreOwner(store());
        when(userRepository.getReferenceById(OWNER_ID)).thenReturn(new User());
        when(storeInventoryItemRepository.save(any(StoreInventoryItem.class))).thenAnswer(inv -> {
            StoreInventoryItem saved = inv.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", 99L);
            return saved;
        });
        OrderListEntry savedEntry = new OrderListEntry();
        savedEntry.setStoreInventoryItem(item());
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        orderListService.createEntry(OWNER_ID, new CreateOrderListEntryRequest(
            null, "Napkins", "SUPPLIES", "packs", true, bd(5), bd(8), bd(3), null, null));

        ArgumentCaptor<StoreInventoryItem> itemCaptor = ArgumentCaptor.forClass(StoreInventoryItem.class);
        verify(storeInventoryItemRepository).save(itemCaptor.capture());
        StoreInventoryItem saved = itemCaptor.getValue();
        assertThat(saved.isActive()).isTrue();
        assertThat(saved.getMinWeekday()).isEqualByComparingTo(bd(5));
        assertThat(saved.getMinWeekend()).isEqualByComparingTo(bd(8));
    }

    @Test
    void createEntryRejectsACustomItemMissingAName() {
        stubActiveStoreOwner(store());

        assertThatThrownBy(() -> orderListService.createEntry(OWNER_ID, new CreateOrderListEntryRequest(
            null, "  ", "SUPPLIES", "packs", false, null, null, bd(1), null, null)))
            .isInstanceOf(InvalidOrderListEntryException.class);
        verify(storeInventoryItemRepository, never()).save(any());
    }

    // ---- createEntryForSuperAdmin (Super Admin "Add to order", cross-store) ----

    @Test
    void createEntryForSuperAdminAddsToTheOrderListForAnExistingItemWithoutAnOwnerLink() {
        Store store = store();
        StoreInventoryItem milk = item();
        when(storeRepository.findById(STORE_ID)).thenReturn(Optional.of(store));
        when(storeInventoryItemRepository.findByIdAndStoreId(ITEM_ID, STORE_ID)).thenReturn(Optional.of(milk));
        OrderListEntry savedEntry = new OrderListEntry();
        savedEntry.setStoreInventoryItem(milk);
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        orderListService.createEntryForSuperAdmin(STORE_ID, new CreateOrderListEntryRequest(ITEM_ID, null, null, null, false, null, null, bd(5), null, "Extra for event"));

        ArgumentCaptor<OrderListEntry> captor = ArgumentCaptor.forClass(OrderListEntry.class);
        verify(orderListEntryRepository).save(captor.capture());
        assertThat(captor.getValue().getQuantityNeeded()).isEqualByComparingTo(bd(5));
        assertThat(captor.getValue().isAdHoc()).isTrue();
        assertThat(captor.getValue().getRaisedBy()).isNull();
        verify(storeOwnerRepository, never()).findByOwnerId(any());
        verify(userRepository, never()).getReferenceById(any());
    }

    @Test
    void createEntryForSuperAdminThrowsNotFoundForAnUnknownStore() {
        when(storeRepository.findById(STORE_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> orderListService.createEntryForSuperAdmin(STORE_ID, new CreateOrderListEntryRequest(
            ITEM_ID, null, null, null, false, null, null, bd(5), null, null)))
            .isInstanceOf(StoreNotFoundException.class);
    }

    // ---- getSupplierMetricsForOwner (Supplier Purchasing Summary) -----------

    private static final LocalDate FROM_DATE = LocalDate.of(2026, 9, 1);
    private static final LocalDate TO_DATE = LocalDate.of(2026, 9, 4);

    @Test
    void getSupplierMetricsForOwnerDerivesTheStoreFromTheCallersOwnStoreOwnerLinkNotAParameter() {
        Store store = store();
        stubActiveStoreOwner(store);
        when(orderListEntryRepository.findSupplierMetricsForStore(eq(STORE_ID), eq(OrderStatus.PURCHASED_STATUSES), any(), any()))
            .thenReturn(List.of());

        orderListService.getSupplierMetricsForOwner(OWNER_ID, FROM_DATE, TO_DATE);

        // The only store ID ever reaches the repository via the owner's own
        // link (stubActiveStoreOwner) -- there is no storeId parameter on the
        // service method for a caller to override.
        verify(orderListEntryRepository).findSupplierMetricsForStore(eq(STORE_ID), eq(OrderStatus.PURCHASED_STATUSES), any(), any());
    }

    @Test
    void getSupplierMetricsForOwnerMapsRowsAndSortsSupplierNamesCaseInsensitively() {
        stubActiveStoreOwner(store());
        when(orderListEntryRepository.findSupplierMetricsForStore(eq(STORE_ID), eq(OrderStatus.PURCHASED_STATUSES), any(), any()))
            .thenReturn(List.of(
                new Object[]{2L, "fresh foods", 3L, 17L, 1L},
                new Object[]{1L, "Acme Supplies", 8L, 42L, 5L}
            ));

        List<SupplierPurchaseMetricResponse> result = orderListService.getSupplierMetricsForOwner(OWNER_ID, FROM_DATE, TO_DATE);

        assertThat(result).extracting(SupplierPurchaseMetricResponse::supplierName)
            .containsExactly("Acme Supplies", "fresh foods");
        assertThat(result.get(0).orderEntryCount()).isEqualTo(8L);
        assertThat(result.get(0).totalQuantity()).isEqualByComparingTo(bd(42));
        assertThat(result.get(0).receivedCount()).isEqualTo(5L);
        assertThat(result.get(1).receivedCount()).isEqualTo(1L);
    }

    @Test
    void getSupplierMetricsForOwnerLabelsANullSupplierAsNoSupplier() {
        stubActiveStoreOwner(store());
        when(orderListEntryRepository.findSupplierMetricsForStore(eq(STORE_ID), eq(OrderStatus.PURCHASED_STATUSES), any(), any()))
            .thenReturn(List.<Object[]>of(new Object[]{null, null, 1L, 9L, 0L}));

        List<SupplierPurchaseMetricResponse> result = orderListService.getSupplierMetricsForOwner(OWNER_ID, FROM_DATE, TO_DATE);

        assertThat(result).extracting(SupplierPurchaseMetricResponse::supplierName).containsExactly("No Supplier");
    }

    @Test
    void getSupplierMetricsForOwnerReturnsAnEmptyListWhenNothingQualifies() {
        stubActiveStoreOwner(store());
        when(orderListEntryRepository.findSupplierMetricsForStore(eq(STORE_ID), eq(OrderStatus.PURCHASED_STATUSES), any(), any()))
            .thenReturn(List.of());

        List<SupplierPurchaseMetricResponse> result = orderListService.getSupplierMetricsForOwner(OWNER_ID, FROM_DATE, TO_DATE);

        assertThat(result).isEmpty();
    }

    @Test
    void getSupplierMetricsForOwnerRejectsAnInvertedDateRange() {
        stubActiveStoreOwner(store());

        assertThatThrownBy(() -> orderListService.getSupplierMetricsForOwner(OWNER_ID, TO_DATE, FROM_DATE))
            .isInstanceOf(InvalidDateRangeException.class);
        verify(orderListEntryRepository, never()).findSupplierMetricsForStore(any(), any(), any(), any());
    }

    @Test
    void getSupplierMetricsForOwnerRejectsMissingDates() {
        stubActiveStoreOwner(store());

        assertThatThrownBy(() -> orderListService.getSupplierMetricsForOwner(OWNER_ID, null, TO_DATE))
            .isInstanceOf(InvalidDateRangeException.class);
    }

    @Test
    void getSupplierMetricsForOwnerThrowsForAnOwnerWithNoActiveStore() {
        when(storeOwnerRepository.findByOwnerId(OWNER_ID)).thenReturn(List.of());

        assertThatThrownBy(() -> orderListService.getSupplierMetricsForOwner(OWNER_ID, FROM_DATE, TO_DATE))
            .isInstanceOf(StoreNotFoundException.class);
    }

    // ---- getOrderHistoryForOwner (Purchasing Report's Detailed view) --------

    private OrderListEntry historyEntry(OrderStatus status, String supplierName, LocalDate createdOn) {
        OrderListEntry entry = new OrderListEntry();
        entry.setStore(store());
        entry.setStoreInventoryItem(item());
        entry.setStatus(status);
        entry.setQuantityNeeded(bd(5));
        if (supplierName != null) {
            com.nforce.retailops.entity.Supplier supplier = new com.nforce.retailops.entity.Supplier();
            ReflectionTestUtils.setField(supplier, "id", 9L);
            supplier.setName(supplierName);
            entry.setSupplier(supplier);
        }
        entry.setOrderedAt(OrderListService.rangeStart(createdOn));
        if (status == OrderStatus.RECEIVED) {
            entry.setQuantityReceived(bd(5));
            entry.setReceivedAt(OrderListService.rangeStart(createdOn).plusHours(2));
            entry.setReceivedByName("Olivia");
        }
        return entry;
    }

    @Test
    void getOrderHistoryForOwnerDerivesTheStoreFromTheCallersOwnStoreOwnerLinkNotAParameter() {
        stubActiveStoreOwner(store());
        when(orderListEntryRepository.findByStoreIdAndStatusInAndActivityInRange(
            eq(STORE_ID), eq(OrderStatus.PURCHASED_STATUSES), any(), any())).thenReturn(List.of());

        orderListService.getOrderHistoryForOwner(OWNER_ID, FROM_DATE, TO_DATE, null, null, null);

        verify(orderListEntryRepository).findByStoreIdAndStatusInAndActivityInRange(
            eq(STORE_ID), eq(OrderStatus.PURCHASED_STATUSES), any(), any());
    }

    @Test
    void getOrderHistoryForOwnerMapsEntriesAndComputesAwaitingAndReceivedCounts() {
        stubActiveStoreOwner(store());
        OrderListEntry ordered = historyEntry(OrderStatus.ORDERED, "Metro Wholesale", FROM_DATE);
        OrderListEntry received = historyEntry(OrderStatus.RECEIVED, "Metro Wholesale", FROM_DATE);
        when(orderListEntryRepository.findByStoreIdAndStatusInAndActivityInRange(
            eq(STORE_ID), eq(OrderStatus.PURCHASED_STATUSES), any(), any())).thenReturn(List.of(ordered, received));

        OrderHistoryPageResponse page = orderListService.getOrderHistoryForOwner(OWNER_ID, FROM_DATE, TO_DATE, null, null, null);

        assertThat(page.totalElements()).isEqualTo(2);
        assertThat(page.awaitingReceiptCount()).isEqualTo(1);
        assertThat(page.receivedCount()).isEqualTo(1);
        assertThat(page.rows()).extracting(OrderHistoryEntryResponse::status)
            .containsExactlyInAnyOrder("ORDERED", "RECEIVED");
        OrderHistoryEntryResponse receivedRow = page.rows().stream()
            .filter(r -> r.status().equals("RECEIVED")).findFirst().orElseThrow();
        assertThat(receivedRow.receivedByName()).isEqualTo("Olivia");
        assertThat(receivedRow.receivedAt()).isNotNull();
        assertThat(receivedRow.quantityReceived()).isEqualByComparingTo(bd(5));
    }

    @Test
    void getOrderHistoryForOwnerFiltersBySupplierNameCaseInsensitively() {
        stubActiveStoreOwner(store());
        OrderListEntry metro = historyEntry(OrderStatus.ORDERED, "Metro Wholesale", FROM_DATE);
        OrderListEntry costco = historyEntry(OrderStatus.ORDERED, "Costco", FROM_DATE);
        when(orderListEntryRepository.findByStoreIdAndStatusInAndActivityInRange(
            eq(STORE_ID), eq(OrderStatus.PURCHASED_STATUSES), any(), any())).thenReturn(List.of(metro, costco));

        OrderHistoryPageResponse page = orderListService.getOrderHistoryForOwner(OWNER_ID, FROM_DATE, TO_DATE, "metro wholesale", null, null);

        assertThat(page.rows()).hasSize(1);
        assertThat(page.rows().get(0).supplierName()).isEqualTo("Metro Wholesale");
    }

    @Test
    void getOrderHistoryForOwnerFiltersByTheNoSupplierSentinel() {
        stubActiveStoreOwner(store());
        OrderListEntry noSupplier = historyEntry(OrderStatus.ORDERED, null, FROM_DATE);
        OrderListEntry withSupplier = historyEntry(OrderStatus.ORDERED, "Costco", FROM_DATE);
        when(orderListEntryRepository.findByStoreIdAndStatusInAndActivityInRange(
            eq(STORE_ID), eq(OrderStatus.PURCHASED_STATUSES), any(), any())).thenReturn(List.of(noSupplier, withSupplier));

        OrderHistoryPageResponse page = orderListService.getOrderHistoryForOwner(OWNER_ID, FROM_DATE, TO_DATE, "No Supplier", null, null);

        assertThat(page.rows()).hasSize(1);
        assertThat(page.rows().get(0).supplierName()).isEqualTo("No Supplier");
    }

    @Test
    void getOrderHistoryForOwnerPaginatesResults() {
        stubActiveStoreOwner(store());
        List<OrderListEntry> entries = List.of(
            historyEntry(OrderStatus.ORDERED, "Costco", FROM_DATE),
            historyEntry(OrderStatus.ORDERED, "Costco", FROM_DATE),
            historyEntry(OrderStatus.ORDERED, "Costco", FROM_DATE));
        when(orderListEntryRepository.findByStoreIdAndStatusInAndActivityInRange(
            eq(STORE_ID), eq(OrderStatus.PURCHASED_STATUSES), any(), any())).thenReturn(entries);

        OrderHistoryPageResponse page = orderListService.getOrderHistoryForOwner(OWNER_ID, FROM_DATE, TO_DATE, null, 2, 2);

        assertThat(page.page()).isEqualTo(2);
        assertThat(page.totalPages()).isEqualTo(2);
        assertThat(page.totalElements()).isEqualTo(3);
        assertThat(page.rows()).hasSize(1);
    }

    @Test
    void getOrderHistoryForOwnerRejectsAnInvertedDateRange() {
        stubActiveStoreOwner(store());

        assertThatThrownBy(() -> orderListService.getOrderHistoryForOwner(OWNER_ID, TO_DATE, FROM_DATE, null, null, null))
            .isInstanceOf(InvalidDateRangeException.class);
        verify(orderListEntryRepository, never())
            .findByStoreIdAndStatusInAndActivityInRange(any(), any(), any(), any());
    }

    // ---- listForStore / updateStatusForSuperAdmin (Super Admin, cross-store) ----

    @Test
    void listForStoreMapsAStoresEntriesWithoutRequiringAnOwnerLink() {
        OrderListEntry entry = entryWithStatus(OrderStatus.NEEDS_ORDERING);
        when(orderListEntryRepository.findByStoreIdOrderByCreatedAtDesc(STORE_ID)).thenReturn(List.of(entry));

        List<OrderListEntryResponse> result = orderListService.listForStore(STORE_ID);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).id()).isEqualTo(ENTRY_ID);
        verify(storeOwnerRepository, never()).findByOwnerId(any());
    }

    @Test
    void listForStoreReturnsAnEmptyListForAStoreWithNoEntries() {
        when(orderListEntryRepository.findByStoreIdOrderByCreatedAtDesc(STORE_ID)).thenReturn(List.of());

        assertThat(orderListService.listForStore(STORE_ID)).isEmpty();
    }

    @Test
    void updateStatusForSuperAdminAllowsTheSingleLegalForwardStep() {
        OrderListEntry entry = entryWithStatus(OrderStatus.NEEDS_ORDERING);
        when(orderListEntryRepository.findByIdAndStoreId(ENTRY_ID, STORE_ID)).thenReturn(Optional.of(entry));
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        orderListService.updateStatusForSuperAdmin(STORE_ID, ENTRY_ID, OrderStatus.ORDERED);

        assertThat(entry.getStatus()).isEqualTo(OrderStatus.ORDERED);
    }

    @Test
    void updateStatusForSuperAdminRejectsSkippingOrderedOnTheWayToReceived() {
        OrderListEntry entry = entryWithStatus(OrderStatus.NEEDS_ORDERING);
        when(orderListEntryRepository.findByIdAndStoreId(ENTRY_ID, STORE_ID)).thenReturn(Optional.of(entry));

        assertThatThrownBy(() -> orderListService.updateStatusForSuperAdmin(STORE_ID, ENTRY_ID, OrderStatus.RECEIVED))
            .isInstanceOf(InvalidOrderEntryTransitionException.class);

        assertThat(entry.getStatus()).isEqualTo(OrderStatus.NEEDS_ORDERING);
        verify(orderListEntryRepository, never()).save(any());
    }

    @Test
    void updateStatusForSuperAdminRejectsMovingBackward() {
        OrderListEntry entry = entryWithStatus(OrderStatus.ORDERED);
        when(orderListEntryRepository.findByIdAndStoreId(ENTRY_ID, STORE_ID)).thenReturn(Optional.of(entry));

        assertThatThrownBy(() -> orderListService.updateStatusForSuperAdmin(STORE_ID, ENTRY_ID, OrderStatus.NEEDS_ORDERING))
            .isInstanceOf(InvalidOrderEntryTransitionException.class);

        assertThat(entry.getStatus()).isEqualTo(OrderStatus.ORDERED);
        verify(orderListEntryRepository, never()).save(any());
    }

    @Test
    void updateStatusForSuperAdminThrowsNotFoundForAnEntryBelongingToAnotherStore() {
        when(orderListEntryRepository.findByIdAndStoreId(ENTRY_ID, STORE_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> orderListService.updateStatusForSuperAdmin(STORE_ID, ENTRY_ID, OrderStatus.ORDERED))
            .isInstanceOf(OrderListEntryNotFoundException.class);
    }
}
