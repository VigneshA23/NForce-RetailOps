package com.nforce.retailops.service;

import static com.nforce.retailops.TestDecimals.bd;
import com.nforce.retailops.dto.CreateOrderListEntryRequest;
import com.nforce.retailops.dto.SupplierPurchaseMetricResponse;
import com.nforce.retailops.dto.UpdateOrderListEntryRequest;
import com.nforce.retailops.entity.OrderListEntry;
import com.nforce.retailops.entity.OrderStatus;
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

    @Test
    void upsertShortageCreatesANewEntryWhenNoneIsActive() {
        when(orderListEntryRepository.findByStoreIdAndStoreInventoryItemIdAndStatusNot(STORE_ID, ITEM_ID, OrderStatus.RECEIVED))
            .thenReturn(Optional.empty());
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
    void upsertShortageUpdatesTheExistingActiveEntryInsteadOfCreatingASecondOne() {
        OrderListEntry existing = new OrderListEntry();
        ReflectionTestUtils.setField(existing, "id", 99L);
        existing.setQuantityNeeded(bd(4));
        existing.setStatus(OrderStatus.NEEDS_ORDERING);

        when(orderListEntryRepository.findByStoreIdAndStoreInventoryItemIdAndStatusNot(STORE_ID, ITEM_ID, OrderStatus.RECEIVED))
            .thenReturn(Optional.of(existing));
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        orderListService.upsertShortage(store(), item(), bd(6), null, false, new User(), null);

        verify(orderListEntryRepository, times(1)).save(existing);
        assertThat(existing.getQuantityNeeded()).isEqualByComparingTo(bd(6));
    }

    @Test
    void upsertShortageRetriesAsAnUpdateWhenTheInsertLosesAUniquenessRace() {
        OrderListEntry winner = new OrderListEntry();
        ReflectionTestUtils.setField(winner, "id", 77L);
        winner.setStatus(OrderStatus.NEEDS_ORDERING);

        when(orderListEntryRepository.findByStoreIdAndStoreInventoryItemIdAndStatusNot(STORE_ID, ITEM_ID, OrderStatus.RECEIVED))
            .thenReturn(Optional.empty())
            .thenReturn(Optional.of(winner));
        when(orderListEntryRepository.save(any(OrderListEntry.class)))
            .thenThrow(new DataIntegrityViolationException("duplicate key"))
            .thenAnswer(inv -> inv.getArgument(0));

        orderListService.upsertShortage(store(), item(), bd(4), null, false, new User(), null);

        assertThat(winner.getQuantityNeeded()).isEqualByComparingTo(bd(4));
        verify(orderListEntryRepository, times(2)).save(any(OrderListEntry.class));
    }

    @Test
    void upsertShortageAccumulatesIntoManualAdditionWhenAdHocAndAnEntryIsAlreadyActive() {
        OrderListEntry existing = new OrderListEntry();
        ReflectionTestUtils.setField(existing, "id", 99L);
        existing.setQuantityNeeded(bd(4));
        existing.setStatus(OrderStatus.NEEDS_ORDERING);

        when(orderListEntryRepository.findByStoreIdAndStoreInventoryItemIdAndStatusNot(STORE_ID, ITEM_ID, OrderStatus.RECEIVED))
            .thenReturn(Optional.of(existing));
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        orderListService.upsertShortage(store(), item(), bd(2), null, true, new User(), null);

        assertThat(existing.getQuantityNeeded()).isEqualByComparingTo(bd(4));
        assertThat(existing.getManualAddition()).isEqualByComparingTo(bd(2));

        orderListService.upsertShortage(store(), item(), bd(3), null, true, new User(), null);

        assertThat(existing.getQuantityNeeded()).isEqualByComparingTo(bd(4));
        assertThat(existing.getManualAddition()).isEqualByComparingTo(bd(5));
    }

    @Test
    void upsertShortageResetsManualAdditionWhenTheSystemRecalculatesQuantityNeeded() {
        OrderListEntry existing = new OrderListEntry();
        ReflectionTestUtils.setField(existing, "id", 99L);
        existing.setQuantityNeeded(bd(4));
        existing.setManualAddition(bd(2));
        existing.setStatus(OrderStatus.NEEDS_ORDERING);

        when(orderListEntryRepository.findByStoreIdAndStoreInventoryItemIdAndStatusNot(STORE_ID, ITEM_ID, OrderStatus.RECEIVED))
            .thenReturn(Optional.of(existing));
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        orderListService.upsertShortage(store(), item(), bd(7), null, false, new User(), null);

        assertThat(existing.getQuantityNeeded()).isEqualByComparingTo(bd(7));
        assertThat(existing.getManualAddition()).isZero();
    }

    @Test
    void resolveShortageIfPresentMarksTheActiveEntryReceivedWithoutCreatingAnything() {
        OrderListEntry existing = new OrderListEntry();
        ReflectionTestUtils.setField(existing, "id", 55L);
        existing.setStatus(OrderStatus.ORDERED);

        when(orderListEntryRepository.findByStoreIdAndStoreInventoryItemIdAndStatusNot(STORE_ID, ITEM_ID, OrderStatus.RECEIVED))
            .thenReturn(Optional.of(existing));
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        orderListService.resolveShortageIfPresent(store(), item());

        assertThat(existing.getStatus()).isEqualTo(OrderStatus.RECEIVED);
        verify(orderListEntryRepository).save(existing);
    }

    @Test
    void resolveShortageIfPresentIsANoOpWhenNothingIsOutstanding() {
        when(orderListEntryRepository.findByStoreIdAndStoreInventoryItemIdAndStatusNot(STORE_ID, ITEM_ID, OrderStatus.RECEIVED))
            .thenReturn(Optional.empty());

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
        OrderListEntry entry = entryWithStatus(OrderStatus.NEEDS_ORDERING);
        when(orderListEntryRepository.findByIdAndStoreId(ENTRY_ID, STORE_ID)).thenReturn(Optional.of(entry));
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        orderListService.updateEntry(OWNER_ID, ENTRY_ID, new UpdateOrderListEntryRequest(bd(5), null, null, OrderStatus.ORDERED));

        assertThat(entry.getStatus()).isEqualTo(OrderStatus.ORDERED);
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
        when(orderListEntryRepository.findByStoreIdAndStoreInventoryItemIdAndStatusNot(STORE_ID, ITEM_ID, OrderStatus.RECEIVED))
            .thenReturn(Optional.empty())
            .thenReturn(Optional.of(savedEntry));
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
        when(orderListEntryRepository.findByStoreIdAndStoreInventoryItemIdAndStatusNot(eq(STORE_ID), eq(99L), eq(OrderStatus.RECEIVED)))
            .thenReturn(Optional.empty())
            .thenReturn(Optional.of(savedEntry));
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
        when(orderListEntryRepository.findByStoreIdAndStoreInventoryItemIdAndStatusNot(eq(STORE_ID), eq(99L), eq(OrderStatus.RECEIVED)))
            .thenReturn(Optional.of(savedEntry));
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
        when(orderListEntryRepository.findByStoreIdAndStoreInventoryItemIdAndStatusNot(STORE_ID, ITEM_ID, OrderStatus.RECEIVED))
            .thenReturn(Optional.empty())
            .thenReturn(Optional.of(savedEntry));
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
                new Object[]{2L, "fresh foods", 3L, 17L},
                new Object[]{1L, "Acme Supplies", 8L, 42L}
            ));

        List<SupplierPurchaseMetricResponse> result = orderListService.getSupplierMetricsForOwner(OWNER_ID, FROM_DATE, TO_DATE);

        assertThat(result).extracting(SupplierPurchaseMetricResponse::supplierName)
            .containsExactly("Acme Supplies", "fresh foods");
        assertThat(result.get(0).orderEntryCount()).isEqualTo(8L);
        assertThat(result.get(0).totalQuantity()).isEqualByComparingTo(bd(42));
    }

    @Test
    void getSupplierMetricsForOwnerLabelsANullSupplierAsNoSupplier() {
        stubActiveStoreOwner(store());
        when(orderListEntryRepository.findSupplierMetricsForStore(eq(STORE_ID), eq(OrderStatus.PURCHASED_STATUSES), any(), any()))
            .thenReturn(List.<Object[]>of(new Object[]{null, null, 1L, 9L}));

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
