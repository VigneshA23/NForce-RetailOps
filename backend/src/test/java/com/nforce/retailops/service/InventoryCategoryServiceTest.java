package com.nforce.retailops.service;

import com.nforce.retailops.dto.InventoryCategoryDeleteResponse;
import com.nforce.retailops.dto.InventoryCategoryDetailsRequest;
import com.nforce.retailops.dto.InventoryCategoryResponse;
import com.nforce.retailops.entity.InventoryCategory;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.exception.InvalidStoreSelectionException;
import com.nforce.retailops.exception.InventoryCategoryNameExistsException;
import com.nforce.retailops.exception.InventoryCategoryNotFoundException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.InventoryCategoryRepository;
import com.nforce.retailops.repository.StoreInventoryItemRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InventoryCategoryServiceTest {

    @Mock private InventoryCategoryRepository inventoryCategoryRepository;
    @Mock private StoreInventoryItemRepository storeInventoryItemRepository;
    @Mock private StoreRepository storeRepository;
    @Mock private StoreOwnerRepository storeOwnerRepository;
    @Mock private NotificationService notificationService;
    @InjectMocks private InventoryCategoryService inventoryCategoryService;

    private Store store(long id) {
        Store store = new Store();
        ReflectionTestUtils.setField(store, "id", id);
        return store;
    }

    @Test
    void createRejectsDuplicateNameCaseInsensitively() {
        when(inventoryCategoryRepository.existsByNameIgnoreCase("Dairy")).thenReturn(true);
        InventoryCategoryDetailsRequest request = new InventoryCategoryDetailsRequest("Dairy", true, List.of());
        assertThrows(InventoryCategoryNameExistsException.class, () -> inventoryCategoryService.createCategory(request));
    }

    @Test
    void createAppliesToAllStoresStoresNoExplicitStores() {
        when(inventoryCategoryRepository.existsByNameIgnoreCase("Dairy")).thenReturn(false);
        when(inventoryCategoryRepository.save(any(InventoryCategory.class))).thenAnswer(invocation -> invocation.getArgument(0));

        InventoryCategoryDetailsRequest request = new InventoryCategoryDetailsRequest("Dairy", true, List.of());
        InventoryCategoryResponse response = inventoryCategoryService.createCategory(request);

        assertTrue(response.appliesToAllStores());
        assertTrue(response.stores().isEmpty());
    }

    @Test
    void createWithoutAllStoresRequiresAtLeastOneStore() {
        when(inventoryCategoryRepository.existsByNameIgnoreCase("Dairy")).thenReturn(false);
        InventoryCategoryDetailsRequest request = new InventoryCategoryDetailsRequest("Dairy", false, List.of());
        assertThrows(InvalidStoreSelectionException.class, () -> inventoryCategoryService.createCategory(request));
    }

    @Test
    void listCategoriesForStoreOnlyIncludesActiveCategoriesThatApplyThere() {
        Store myStore = store(10L);
        Store otherStore = store(20L);

        StoreOwner link = new StoreOwner();
        link.setStore(myStore);
        link.setActive(true);
        when(storeOwnerRepository.findByOwnerId(1L)).thenReturn(List.of(link));

        InventoryCategory global = new InventoryCategory();
        global.setName("Global Category");
        global.setAppliesToAllStores(true);

        InventoryCategory assignedHere = new InventoryCategory();
        assignedHere.setName("Assigned Here");
        assignedHere.getStores().add(myStore);

        InventoryCategory assignedElsewhereOnly = new InventoryCategory();
        assignedElsewhereOnly.setName("Assigned Elsewhere Only");
        assignedElsewhereOnly.getStores().add(otherStore);

        InventoryCategory inactiveButAssigned = new InventoryCategory();
        inactiveButAssigned.setName("Inactive");
        inactiveButAssigned.setActive(false);
        inactiveButAssigned.getStores().add(myStore);

        when(inventoryCategoryRepository.findAllByOrderByNameAsc())
            .thenReturn(List.of(global, assignedHere, assignedElsewhereOnly, inactiveButAssigned));

        List<InventoryCategoryResponse> result = inventoryCategoryService.listCategoriesForStore(1L);

        assertEquals(2, result.size());
        assertTrue(result.stream().anyMatch(r -> r.name().equals("Global Category")));
        assertTrue(result.stream().anyMatch(r -> r.name().equals("Assigned Here")));
        assertFalse(result.stream().anyMatch(r -> r.name().equals("Assigned Elsewhere Only")));
        assertFalse(result.stream().anyMatch(r -> r.name().equals("Inactive")));
    }

    @Test
    void listCategoriesForUnknownOwnerStoreThrowsNotFound() {
        when(storeOwnerRepository.findByOwnerId(99L)).thenReturn(List.of());
        assertThrows(StoreNotFoundException.class, () -> inventoryCategoryService.listCategoriesForStore(99L));
    }

    @Test
    void isCategoryAssignedToStoreMatchesCaseInsensitivelyAndRespectsAllStores() {
        Store myStore = store(10L);
        Store otherStore = store(20L);

        InventoryCategory global = new InventoryCategory();
        global.setName("dairy");
        global.setAppliesToAllStores(true);

        InventoryCategory assignedElsewhere = new InventoryCategory();
        assignedElsewhere.setName("Packaging");
        assignedElsewhere.getStores().add(otherStore);

        when(inventoryCategoryRepository.findAllByOrderByNameAsc()).thenReturn(List.of(global, assignedElsewhere));

        assertTrue(inventoryCategoryService.isCategoryAssignedToStore("DAIRY", myStore));
        assertFalse(inventoryCategoryService.isCategoryAssignedToStore("Packaging", myStore));
    }

    @Test
    void deleteWithoutItemsInUseRemovesCategory() {
        InventoryCategory category = new InventoryCategory();
        category.setName("Dairy");
        when(inventoryCategoryRepository.findById(5L)).thenReturn(Optional.of(category));
        when(storeInventoryItemRepository.existsByCategoryIgnoreCase("Dairy")).thenReturn(false);

        InventoryCategoryDeleteResponse response = inventoryCategoryService.deleteCategory(5L);

        assertTrue(response.deleted());
        assertFalse(response.deactivated());
        verify(inventoryCategoryRepository).delete(category);
    }

    @Test
    void deleteWithItemsInUseOnlyDeactivatesCategory() {
        InventoryCategory category = new InventoryCategory();
        category.setName("Dairy");
        when(inventoryCategoryRepository.findById(5L)).thenReturn(Optional.of(category));
        when(storeInventoryItemRepository.existsByCategoryIgnoreCase("Dairy")).thenReturn(true);

        InventoryCategoryDeleteResponse response = inventoryCategoryService.deleteCategory(5L);

        assertFalse(response.deleted());
        assertTrue(response.deactivated());
        assertFalse(category.isActive());
        verify(inventoryCategoryRepository, never()).delete(category);
    }

    @Test
    void deleteUnknownCategoryThrowsNotFound() {
        when(inventoryCategoryRepository.findById(9L)).thenReturn(Optional.empty());
        assertThrows(InventoryCategoryNotFoundException.class, () -> inventoryCategoryService.deleteCategory(9L));
    }

    private Store activeStore(long id, String name) {
        Store store = store(id);
        store.setName(name);
        store.setActive(true);
        return store;
    }

    private StoreOwner ownerLink(Store store, long ownerId) {
        com.nforce.retailops.entity.User owner = new com.nforce.retailops.entity.User();
        ReflectionTestUtils.setField(owner, "id", ownerId);
        StoreOwner link = new StoreOwner();
        link.setStore(store);
        link.setOwner(owner);
        return link;
    }

    @Test
    void activatingCategoryNotifiesOwnerOfEachStoreWithItsName() {
        Store downtown = activeStore(10L, "Downtown");
        InventoryCategory category = new InventoryCategory();
        category.setName("Dairy");
        category.setActive(false);
        category.setAppliesToAllStores(false);
        category.setStores(new java.util.HashSet<>(List.of(downtown)));
        StoreOwner link = ownerLink(downtown, 1L);
        when(inventoryCategoryRepository.findById(5L)).thenReturn(Optional.of(category));
        when(inventoryCategoryRepository.save(any(InventoryCategory.class))).thenAnswer(i -> i.getArgument(0));
        when(storeRepository.findByActiveTrueOrderByName()).thenReturn(List.of(downtown));
        when(storeOwnerRepository.findByStoreIdAndActiveTrue(10L)).thenReturn(Optional.of(link));

        inventoryCategoryService.setCategoryActive(5L, true);

        verify(notificationService).sendForStore(
            eq(link.getOwner()), eq("INVENTORY_CATEGORY_AVAILABLE"),
            eq("Inventory category available: Dairy"),
            eq("\"Dairy\" is now available for Downtown. You can add new stock items under it."),
            eq("/inventory"), eq(downtown));
    }

    @Test
    void deactivatingCategoryDoesNotNotify() {
        Store downtown = activeStore(10L, "Downtown");
        InventoryCategory category = new InventoryCategory();
        category.setName("Dairy");
        category.setAppliesToAllStores(true);
        when(inventoryCategoryRepository.findById(5L)).thenReturn(Optional.of(category));
        when(inventoryCategoryRepository.save(any(InventoryCategory.class))).thenAnswer(i -> i.getArgument(0));
        when(storeRepository.findByActiveTrueOrderByName()).thenReturn(List.of(downtown));

        inventoryCategoryService.setCategoryActive(5L, false);

        verify(notificationService, never()).sendForStore(any(), any(), any(), any(), any(), any());
    }

    @Test
    void addingStoreNotifiesOnlyTheNewStore() {
        Store downtown = activeStore(10L, "Downtown");
        Store uptown = activeStore(20L, "Uptown");
        InventoryCategory category = new InventoryCategory();
        category.setName("Dairy");
        category.setAppliesToAllStores(false);
        category.setStores(new java.util.HashSet<>(List.of(downtown)));
        StoreOwner uptownOwner = ownerLink(uptown, 2L);
        when(inventoryCategoryRepository.findById(5L)).thenReturn(Optional.of(category));
        when(inventoryCategoryRepository.existsByNameIgnoreCaseAndIdNot("Dairy", 5L)).thenReturn(false);
        when(inventoryCategoryRepository.save(any(InventoryCategory.class))).thenAnswer(i -> i.getArgument(0));
        when(storeRepository.findAllById(List.of(10L, 20L))).thenReturn(List.of(downtown, uptown));
        when(storeRepository.findByActiveTrueOrderByName()).thenReturn(List.of(downtown, uptown));
        when(storeOwnerRepository.findByStoreIdAndActiveTrue(20L)).thenReturn(Optional.of(uptownOwner));

        inventoryCategoryService.updateCategory(5L, new InventoryCategoryDetailsRequest("Dairy", false, List.of(10L, 20L)));

        verify(notificationService).sendForStore(
            eq(uptownOwner.getOwner()), eq("INVENTORY_CATEGORY_AVAILABLE"), any(), any(), eq("/inventory"), eq(uptown));
        verify(notificationService, never()).sendForStore(any(), any(), any(), any(), any(), eq(downtown));
    }
}
