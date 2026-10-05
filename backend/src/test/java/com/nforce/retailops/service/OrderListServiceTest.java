package com.nforce.retailops.service;

import com.nforce.retailops.dto.CreateOrderListEntryRequest;
import com.nforce.retailops.entity.InventoryItemCategory;
import com.nforce.retailops.entity.OrderListEntry;
import com.nforce.retailops.entity.OrderStatus;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.InvalidOrderListEntryException;
import com.nforce.retailops.repository.OrderListEntryRepository;
import com.nforce.retailops.repository.StoreInventoryItemRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
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

        orderListService.createEntry(OWNER_ID, new CreateOrderListEntryRequest(ITEM_ID, null, null, null, false, 5, null, "Extra for event"));

        ArgumentCaptor<OrderListEntry> captor = ArgumentCaptor.forClass(OrderListEntry.class);
        verify(orderListEntryRepository).save(captor.capture());
        assertThat(captor.getValue().getQuantityNeeded()).isEqualTo(5);
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
            null, "Birthday candles", InventoryItemCategory.SUPPLIES, "packs", false, 2, null, null));

        ArgumentCaptor<StoreInventoryItem> itemCaptor = ArgumentCaptor.forClass(StoreInventoryItem.class);
        verify(storeInventoryItemRepository).save(itemCaptor.capture());
        StoreInventoryItem saved = itemCaptor.getValue();
        assertThat(saved.getName()).isEqualTo("Birthday candles");
        assertThat(saved.getCategory()).isEqualTo(InventoryItemCategory.SUPPLIES);
        assertThat(saved.isActive()).isFalse();
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
            null, "Napkins", InventoryItemCategory.SUPPLIES, "packs", true, 3, null, null));

        ArgumentCaptor<StoreInventoryItem> itemCaptor = ArgumentCaptor.forClass(StoreInventoryItem.class);
        verify(storeInventoryItemRepository).save(itemCaptor.capture());
        assertThat(itemCaptor.getValue().isActive()).isTrue();
    }

    @Test
    void createEntryRejectsACustomItemMissingAName() {
        stubActiveStoreOwner(store());

        assertThatThrownBy(() -> orderListService.createEntry(OWNER_ID, new CreateOrderListEntryRequest(
            null, "  ", InventoryItemCategory.SUPPLIES, "packs", false, 1, null, null)))
            .isInstanceOf(InvalidOrderListEntryException.class);
        verify(storeInventoryItemRepository, never()).save(any());
    }
}
