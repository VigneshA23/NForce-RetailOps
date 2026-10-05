package com.nforce.retailops.service;

import com.nforce.retailops.dto.InventoryCategoryRequest;
import com.nforce.retailops.dto.InventoryCategoryResponse;
import com.nforce.retailops.entity.InventoryCategory;
import com.nforce.retailops.repository.InventoryCategoryRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InventoryCategoryServiceTest {

    @Mock
    private InventoryCategoryRepository inventoryCategoryRepository;

    private InventoryCategoryService service() {
        return new InventoryCategoryService(inventoryCategoryRepository);
    }

    @Test
    void findOrCreateReusesAnExistingActiveCategoryByCaseInsensitiveName() {
        InventoryCategory existing = new InventoryCategory();
        existing.setName("Dairy");
        existing.setActive(true);
        when(inventoryCategoryRepository.findFirstByNameIgnoreCaseOrderByIdAsc("Dairy")).thenReturn(Optional.of(existing));

        InventoryCategoryResponse response = service().findOrCreateCategory(new InventoryCategoryRequest("  Dairy  "));

        assertThat(response.name()).isEqualTo("Dairy");
        assertThat(response.active()).isTrue();
        verify(inventoryCategoryRepository, never()).save(any(InventoryCategory.class));
    }

    @Test
    void findOrCreateReactivatesAnInactiveCategoryWithTheSameName() {
        InventoryCategory existing = new InventoryCategory();
        existing.setName("Seasonal");
        existing.setActive(false);
        when(inventoryCategoryRepository.findFirstByNameIgnoreCaseOrderByIdAsc("Seasonal")).thenReturn(Optional.of(existing));
        when(inventoryCategoryRepository.save(existing)).thenReturn(existing);

        InventoryCategoryResponse response = service().findOrCreateCategory(new InventoryCategoryRequest("Seasonal"));

        assertThat(response.active()).isTrue();
        assertThat(existing.isActive()).isTrue();
    }

    @Test
    void findOrCreateCreatesANewCategoryWhenNoneMatches() {
        when(inventoryCategoryRepository.findFirstByNameIgnoreCaseOrderByIdAsc("Merch")).thenReturn(Optional.empty());
        when(inventoryCategoryRepository.save(any(InventoryCategory.class))).thenAnswer(invocation -> invocation.getArgument(0));

        InventoryCategoryResponse response = service().findOrCreateCategory(new InventoryCategoryRequest("Merch"));

        assertThat(response.name()).isEqualTo("Merch");
        assertThat(response.active()).isTrue();
    }
}
