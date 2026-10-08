package com.nforce.retailops.service;

import com.nforce.retailops.dto.InventoryCountStatus;
import com.nforce.retailops.dto.CreateStoreInventoryItemsResponse;
import com.nforce.retailops.dto.StockLevelComparisonRowResponse;
import com.nforce.retailops.dto.StoreInventoryItemRequest;
import com.nforce.retailops.entity.StockCheck;
import com.nforce.retailops.entity.StockCheckSnapshot;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.Supplier;
import com.nforce.retailops.exception.StoreInventoryItemNameExistsException;
import com.nforce.retailops.repository.InventoryItemImageRepository;
import com.nforce.retailops.repository.OrderListEntryRepository;
import com.nforce.retailops.repository.StockCheckRepository;
import com.nforce.retailops.repository.StoreInventoryItemRepository;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.SupplierRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StoreInventoryItemServiceTest {

    @Mock private StoreInventoryItemRepository storeInventoryItemRepository;
    @Mock private SupplierRepository supplierRepository;
    @Mock private StoreRepository storeRepository;
    @Mock private StoreOwnerRepository storeOwnerRepository;
    @Mock private StockCheckRepository stockCheckRepository;
    @Mock private OrderListEntryRepository orderListEntryRepository;
    @Mock private InventoryItemImageRepository inventoryItemImageRepository;
    @Mock private UnsplashService unsplashService;
    @Mock private StoreEmployeeRepository storeEmployeeRepository;
    @Mock private NotificationService notificationService;

    private StoreInventoryItemService service;

    private Store storeA;
    private Store storeB;

    @BeforeEach
    void setUp() {
        service = new StoreInventoryItemService(
            storeInventoryItemRepository, supplierRepository, storeRepository,
            storeOwnerRepository, stockCheckRepository, orderListEntryRepository,
            inventoryItemImageRepository, unsplashService,
            storeEmployeeRepository, notificationService
        );

        storeA = new Store();
        ReflectionTestUtils.setField(storeA, "id", 1L);
        storeA.setName("Store A");

        storeB = new Store();
        ReflectionTestUtils.setField(storeB, "id", 2L);
        storeB.setName("Store B");
    }

    private StoreInventoryItem item(Long id, Store store, int minWeekday) {
        StoreInventoryItem item = new StoreInventoryItem();
        ReflectionTestUtils.setField(item, "id", id);
        item.setStore(store);
        item.setName("Napkins");
        item.setMinWeekday(minWeekday);
        item.setMinWeekend(minWeekday);
        item.setActive(true);
        return item;
    }

    private StoreInventoryItem existing(Long id, Store store, String name, String category) {
        StoreInventoryItem item = item(id, store, 5);
        item.setName(name);
        item.setCategory(category);
        return item;
    }

    private StockCheck checkWithCount(StoreInventoryItem item, LocalDate date, int available) {
        StockCheck check = new StockCheck();
        check.setStoreInventoryItem(item);
        check.setCheckDate(date);
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, available, 0, null, OffsetDateTime.now(), false);
        return check;
    }

    private StoreInventoryItemRequest request(String name, Long preferredSupplierId) {
        return requestForStore(null, name, preferredSupplierId);
    }

    private StoreInventoryItemRequest requestForStore(Long storeId, String name, Long preferredSupplierId) {
        return new StoreInventoryItemRequest(
            storeId, null, name, "INGREDIENTS", "Nos.", 5, 0,
            preferredSupplierId, null, false, null, null, null
        );
    }

    private StoreInventoryItemRequest requestForStores(List<Long> storeIds, String name, Long preferredSupplierId) {
        return new StoreInventoryItemRequest(
            null, storeIds, name, "INGREDIENTS", "Nos.", 5, 0,
            preferredSupplierId, null, false, null, null, null
        );
    }

    private Supplier supplier(Long id) {
        Supplier supplier = new Supplier();
        ReflectionTestUtils.setField(supplier, "id", id);
        supplier.setName("Acme Supplies");
        return supplier;
    }

    @Test
    void storeWithNoMatchingItemComesBackNotAssignedWithEveryOtherFieldNull() {
        when(storeRepository.findByActiveTrueOrderByName()).thenReturn(List.of(storeA));
        when(storeInventoryItemRepository.findByNameIgnoreCase("Napkins")).thenReturn(List.of());

        List<StockLevelComparisonRowResponse> rows = service.compareAcrossStores("Napkins");

        assertThat(rows).hasSize(1);
        StockLevelComparisonRowResponse row = rows.get(0);
        assertThat(row.storeId()).isEqualTo(1L);
        assertThat(row.assigned()).isFalse();
        assertThat(row.requiredToday()).isNull();
        assertThat(row.currentAvailable()).isNull();
        assertThat(row.asOfDate()).isNull();
        assertThat(row.status()).isNull();
        verify(stockCheckRepository, never()).findLatestPerItemForItemIds(anyList());
    }

    @Test
    void assignedItemWithNoCheckEverIsStaleWithNullCurrentAvailable() {
        StoreInventoryItem napkinsA = item(10L, storeA, 10);
        when(storeRepository.findByActiveTrueOrderByName()).thenReturn(List.of(storeA));
        when(storeInventoryItemRepository.findByNameIgnoreCase("Napkins")).thenReturn(List.of(napkinsA));
        when(stockCheckRepository.findLatestPerItemForItemIds(List.of(10L))).thenReturn(List.of());

        StockLevelComparisonRowResponse row = service.compareAcrossStores("Napkins").get(0);

        assertThat(row.assigned()).isTrue();
        assertThat(row.requiredToday()).isEqualTo(10);
        assertThat(row.currentAvailable()).isNull();
        assertThat(row.status()).isEqualTo(InventoryCountStatus.STALE);
    }

    @Test
    void compareAcrossStoresMatchesByNameCaseInsensitivelyAndMarksInactiveItemsAsNotAssigned() {
        StoreInventoryItem napkinsA = item(10L, storeA, 10);
        StoreInventoryItem napkinsB = item(11L, storeB, 10);
        napkinsB.setActive(false);

        when(storeRepository.findByActiveTrueOrderByName()).thenReturn(List.of(storeA, storeB));
        when(storeInventoryItemRepository.findByNameIgnoreCase("napkins")).thenReturn(List.of(napkinsA, napkinsB));
        when(stockCheckRepository.findLatestPerItemForItemIds(List.of(10L)))
            .thenReturn(List.of(checkWithCount(napkinsA, LocalDate.now(), 5)));

        List<StockLevelComparisonRowResponse> rows = service.compareAcrossStores("napkins");

        assertThat(rows).extracting(
            StockLevelComparisonRowResponse::storeId, StockLevelComparisonRowResponse::assigned,
            StockLevelComparisonRowResponse::status
        ).containsExactly(
            tuple(1L, true, InventoryCountStatus.LOW),
            tuple(2L, false, null)
        );
    }

    @Test
    void compareAcrossStoresPicksLowestIdWhenAStoreHasTwoActiveItemsWithTheSameName() {
        StoreInventoryItem napkinsA1 = item(10L, storeA, 10);
        StoreInventoryItem napkinsA2 = item(20L, storeA, 99);

        when(storeRepository.findByActiveTrueOrderByName()).thenReturn(List.of(storeA));
        when(storeInventoryItemRepository.findByNameIgnoreCase("Napkins"))
            .thenReturn(List.of(napkinsA2, napkinsA1));
        when(stockCheckRepository.findLatestPerItemForItemIds(List.of(10L))).thenReturn(List.of());

        StockLevelComparisonRowResponse row = service.compareAcrossStores("Napkins").get(0);

        assertThat(row.requiredToday()).isEqualTo(10);
    }

    // --- RTS-301: duplicate item names within a store ---------------------

    @Test
    void createForSuperAdminRejectsSameNameInADifferentCategoryCaseInsensitively() {
        when(storeRepository.findById(1L)).thenReturn(java.util.Optional.of(storeA));
        when(storeInventoryItemRepository.findByNameIgnoreCase("milk"))
            .thenReturn(List.of(existing(20L, storeA, "Milk", "Dairy")));

        StoreInventoryItemRequest request = requestForStore(1L, "milk", 7L);

        assertThatThrownBy(() -> service.createForSuperAdmin(request))
            .isInstanceOf(StoreInventoryItemNameExistsException.class)
            .hasMessageContaining("different category in: " + storeA.getName());
        verify(storeInventoryItemRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void createForSuperAdminSkipsStoresWithTheSameNameAndCategoryAndCreatesTheRest() {
        when(storeRepository.findById(1L)).thenReturn(java.util.Optional.of(storeA));
        when(storeRepository.findById(2L)).thenReturn(java.util.Optional.of(storeB));
        when(storeInventoryItemRepository.findByNameIgnoreCase("Milk"))
            .thenReturn(List.of(existing(20L, storeA, "milk", "ingredients")));
        when(supplierRepository.findById(7L)).thenReturn(java.util.Optional.of(supplier(7L)));
        when(storeInventoryItemRepository.save(org.mockito.ArgumentMatchers.any()))
            .thenAnswer(invocation -> invocation.getArgument(0));

        CreateStoreInventoryItemsResponse result =
            service.createForSuperAdmin(requestForStores(List.of(1L, 2L), "Milk", 7L));

        assertThat(result.skippedStoreNames()).containsExactly(storeA.getName());
        org.mockito.ArgumentCaptor<StoreInventoryItem> saved = org.mockito.ArgumentCaptor.forClass(StoreInventoryItem.class);
        verify(storeInventoryItemRepository).save(saved.capture());
        assertThat(saved.getValue().getStore().getId()).isEqualTo(2L);
    }

    @Test
    void createForSuperAdminCreatesNothingWhenEverySelectedStoreAlreadyHasTheItem() {
        when(storeRepository.findById(1L)).thenReturn(java.util.Optional.of(storeA));
        when(storeInventoryItemRepository.findByNameIgnoreCase("Milk"))
            .thenReturn(List.of(existing(20L, storeA, "Milk", "INGREDIENTS")));

        CreateStoreInventoryItemsResponse result = service.createForSuperAdmin(requestForStore(1L, "Milk", 7L));

        assertThat(result.created()).isEmpty();
        assertThat(result.skippedStoreNames()).containsExactly(storeA.getName());
        verify(storeInventoryItemRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void createForSuperAdminCreatesOneLinkedCopyPerSelectedStore() {
        when(storeRepository.findById(1L)).thenReturn(java.util.Optional.of(storeA));
        when(storeRepository.findById(2L)).thenReturn(java.util.Optional.of(storeB));
        when(supplierRepository.findById(7L)).thenReturn(java.util.Optional.of(supplier(7L)));
        when(storeInventoryItemRepository.save(org.mockito.ArgumentMatchers.any()))
            .thenAnswer(invocation -> invocation.getArgument(0));

        service.createForSuperAdmin(requestForStores(List.of(1L, 2L), "Milk", 7L));

        org.mockito.ArgumentCaptor<StoreInventoryItem> saved = org.mockito.ArgumentCaptor.forClass(StoreInventoryItem.class);
        verify(storeInventoryItemRepository, org.mockito.Mockito.times(2)).save(saved.capture());
        assertThat(saved.getAllValues()).extracting(i -> i.getStore().getId()).containsExactly(1L, 2L);
        assertThat(saved.getAllValues().get(0).getItemGroupId()).isNotNull()
            .isEqualTo(saved.getAllValues().get(1).getItemGroupId());
    }

    @Test
    void createForSuperAdminCreatesNothingWhenAnySelectedStoreHasTheNameUnderAnotherCategory() {
        when(storeRepository.findById(1L)).thenReturn(java.util.Optional.of(storeA));
        when(storeRepository.findById(2L)).thenReturn(java.util.Optional.of(storeB));
        when(storeInventoryItemRepository.findByNameIgnoreCase("Milk"))
            .thenReturn(List.of(existing(20L, storeB, "Milk", "Dairy")));

        assertThatThrownBy(() -> service.createForSuperAdmin(requestForStores(List.of(1L, 2L), "Milk", 7L)))
            .isInstanceOf(StoreInventoryItemNameExistsException.class)
            .hasMessageContaining(storeB.getName());
        verify(storeInventoryItemRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void commonCategoriesKeepsOnlyCategoriesUsedInEverySelectedStore() {
        when(storeInventoryItemRepository.findStoreCategories(org.mockito.ArgumentMatchers.anyCollection()))
            .thenReturn(List.of(
                new Object[] {1L, "Dairy"}, new Object[] {1L, "Cleaning"},
                new Object[] {2L, "dairy"}, new Object[] {2L, "Packaging"}))
            .thenReturn(List.of(new Object[] {1L, "Dairy"}, new Object[] {1L, "Cleaning"}));

        assertThat(service.commonCategories(List.of(1L, 2L))).containsExactly("Dairy");
        assertThat(service.commonCategories(List.of(1L))).containsExactly("Cleaning", "Dairy");
    }

    @Test
    void createForSuperAdminRejectsNameCollidingWithAnInactiveItemInTheSameStore() {
        // Deactivated items still hold their name -- matches CategoryService's
        // duplicate-name check, which also doesn't filter by active.
        when(storeRepository.findById(1L)).thenReturn(java.util.Optional.of(storeA));
        StoreInventoryItem inactive = existing(20L, storeA, "Milk", "Dairy");
        inactive.setActive(false);
        when(storeInventoryItemRepository.findByNameIgnoreCase("Milk")).thenReturn(List.of(inactive));

        StoreInventoryItemRequest request = requestForStore(1L, "Milk", 7L);

        assertThatThrownBy(() -> service.createForSuperAdmin(request))
            .isInstanceOf(StoreInventoryItemNameExistsException.class);
    }

    @Test
    void createForSuperAdminAllowsTheSameNameInADifferentStore() {
        when(storeRepository.findById(2L)).thenReturn(java.util.Optional.of(storeB));
        when(supplierRepository.findById(7L)).thenReturn(java.util.Optional.of(supplier(7L)));
        when(storeInventoryItemRepository.save(org.mockito.ArgumentMatchers.any()))
            .thenAnswer(invocation -> invocation.getArgument(0));

        StoreInventoryItemRequest request = requestForStore(2L, "Milk", 7L);

        service.createForSuperAdmin(request);

        verify(storeInventoryItemRepository).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void updateForSuperAdminAllowsKeepingTheItemsOwnExistingName() {
        StoreInventoryItem existing = item(10L, storeA, 5);
        when(storeInventoryItemRepository.findById(10L)).thenReturn(java.util.Optional.of(existing));
        when(storeInventoryItemRepository.existsByStoreIdAndNameIgnoreCaseAndIdNot(1L, "Napkins", 10L))
            .thenReturn(false);
        when(supplierRepository.findById(7L)).thenReturn(java.util.Optional.of(supplier(7L)));
        when(storeInventoryItemRepository.save(org.mockito.ArgumentMatchers.any()))
            .thenAnswer(invocation -> invocation.getArgument(0));

        service.updateForSuperAdmin(10L, request("Napkins", 7L));

        verify(storeInventoryItemRepository).save(existing);
    }

    @Test
    void updateForSuperAdminRejectsRenamingToAnotherItemsExistingName() {
        StoreInventoryItem existing = item(10L, storeA, 5);
        when(storeInventoryItemRepository.findById(10L)).thenReturn(java.util.Optional.of(existing));
        when(storeInventoryItemRepository.existsByStoreIdAndNameIgnoreCaseAndIdNot(1L, "Milk", 10L))
            .thenReturn(true);

        assertThatThrownBy(() -> service.updateForSuperAdmin(10L, request("Milk", 7L)))
            .isInstanceOf(StoreInventoryItemNameExistsException.class);
        verify(storeInventoryItemRepository, never()).save(existing);
    }
}
