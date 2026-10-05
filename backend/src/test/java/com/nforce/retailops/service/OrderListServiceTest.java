package com.nforce.retailops.service;

import com.nforce.retailops.dto.UpdateOrderListEntryRequest;
import com.nforce.retailops.entity.OrderListEntry;
import com.nforce.retailops.entity.OrderStatus;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.InvalidOrderEntryTransitionException;
import com.nforce.retailops.repository.OrderListEntryRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.SupplierRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderListServiceTest {

    private static final Long STORE_ID = 10L;
    private static final Long ITEM_ID = 20L;

    @Mock private OrderListEntryRepository orderListEntryRepository;
    @Mock private StoreOwnerRepository storeOwnerRepository;
    @Mock private SupplierRepository supplierRepository;

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
        orderListService.upsertShortage(store(), item(), 5, null, false, employee, null);

        ArgumentCaptor<OrderListEntry> captor = ArgumentCaptor.forClass(OrderListEntry.class);
        verify(orderListEntryRepository).save(captor.capture());
        OrderListEntry saved = captor.getValue();
        assertThat(saved.getQuantityNeeded()).isEqualTo(5);
        assertThat(saved.getStatus()).isEqualTo(OrderStatus.NEEDS_ORDERING);
        assertThat(saved.isAdHoc()).isFalse();
        assertThat(saved.getRaisedBy()).isEqualTo(employee);
    }

    @Test
    void upsertShortageUpdatesTheExistingActiveEntryInsteadOfCreatingASecondOne() {
        OrderListEntry existing = new OrderListEntry();
        ReflectionTestUtils.setField(existing, "id", 99L);
        existing.setQuantityNeeded(4);
        existing.setStatus(OrderStatus.NEEDS_ORDERING);

        when(orderListEntryRepository.findByStoreIdAndStoreInventoryItemIdAndStatusNot(STORE_ID, ITEM_ID, OrderStatus.RECEIVED))
            .thenReturn(Optional.of(existing));
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        orderListService.upsertShortage(store(), item(), 6, null, false, new User(), null);

        verify(orderListEntryRepository, times(1)).save(existing);
        assertThat(existing.getQuantityNeeded()).isEqualTo(6);
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

        orderListService.upsertShortage(store(), item(), 4, null, false, new User(), null);

        assertThat(winner.getQuantityNeeded()).isEqualTo(4);
        verify(orderListEntryRepository, times(2)).save(any(OrderListEntry.class));
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

    private static final Long OWNER_ID = 1L;
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
        entry.setQuantityNeeded(5);
        return entry;
    }

    @Test
    void updateEntryAllowsTheSingleLegalForwardStep() {
        when(storeOwnerRepository.findByOwnerId(OWNER_ID)).thenReturn(List.of(storeOwner()));
        OrderListEntry entry = entryWithStatus(OrderStatus.NEEDS_ORDERING);
        when(orderListEntryRepository.findByIdAndStoreId(ENTRY_ID, STORE_ID)).thenReturn(Optional.of(entry));
        when(orderListEntryRepository.save(any(OrderListEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        orderListService.updateEntry(OWNER_ID, ENTRY_ID, new UpdateOrderListEntryRequest(5, null, null, OrderStatus.ORDERED));

        assertThat(entry.getStatus()).isEqualTo(OrderStatus.ORDERED);
    }

    @Test
    void updateEntryRejectsSkippingOrderedOnTheWayToReceived() {
        when(storeOwnerRepository.findByOwnerId(OWNER_ID)).thenReturn(List.of(storeOwner()));
        OrderListEntry entry = entryWithStatus(OrderStatus.NEEDS_ORDERING);
        when(orderListEntryRepository.findByIdAndStoreId(ENTRY_ID, STORE_ID)).thenReturn(Optional.of(entry));

        assertThatThrownBy(() ->
            orderListService.updateEntry(OWNER_ID, ENTRY_ID, new UpdateOrderListEntryRequest(5, null, null, OrderStatus.RECEIVED))
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
            orderListService.updateEntry(OWNER_ID, ENTRY_ID, new UpdateOrderListEntryRequest(5, null, null, OrderStatus.NEEDS_ORDERING))
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

        orderListService.updateEntry(OWNER_ID, ENTRY_ID, new UpdateOrderListEntryRequest(9, null, "note", OrderStatus.ORDERED));

        assertThat(entry.getStatus()).isEqualTo(OrderStatus.ORDERED);
        assertThat(entry.getQuantityNeeded()).isEqualTo(9);
    }
}
