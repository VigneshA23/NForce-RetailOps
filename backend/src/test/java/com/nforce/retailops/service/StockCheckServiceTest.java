package com.nforce.retailops.service;

import com.nforce.retailops.dto.StockCheckCorrectionRequest;
import com.nforce.retailops.entity.StockCheck;
import com.nforce.retailops.entity.StockCheckCorrection;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.StockCheckCorrectionRepository;
import com.nforce.retailops.repository.StockCheckRepository;
import com.nforce.retailops.repository.StoreInventoryItemRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StockCheckServiceTest {

    private static final Long OWNER_ID = 1L;
    private static final Long STORE_ID = 10L;
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
    void correctCheckPersistsAuditRowAndNeverTouchesTheOriginalRecorder() {
        Store store = new Store();
        ReflectionTestUtils.setField(store, "id", STORE_ID);
        StoreOwner storeOwner = new StoreOwner();
        storeOwner.setStore(store);
        when(storeOwnerRepository.findByOwnerId(OWNER_ID)).thenReturn(List.of(storeOwner));

        StoreInventoryItem storeInventoryItem = new StoreInventoryItem();
        storeInventoryItem.setName("Widget");
        // No minWeekday/minWeekend configured -- quantityNeeded resolves to 0,
        // keeping the order-list side effect out of scope for this test.

        User originalRecorder = new User();
        originalRecorder.setFullName("Original Employee");

        StockCheck check = new StockCheck();
        ReflectionTestUtils.setField(check, "id", CHECK_ID);
        check.setStoreInventoryItem(storeInventoryItem);
        check.setCheckedBy(originalRecorder);
        check.setCheckDate(LocalDate.of(2026, 6, 15));
        check.setCurrentCount(10);
        check.setQuantityNeeded(0);

        when(stockCheckRepository.findByIdAndStoreInventoryItemStoreId(CHECK_ID, STORE_ID))
            .thenReturn(Optional.of(check));
        when(stockCheckRepository.save(any(StockCheck.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User owner = new User();
        ReflectionTestUtils.setField(owner, "id", OWNER_ID);
        when(userRepository.getReferenceById(OWNER_ID)).thenReturn(owner);

        StockCheckCorrectionRequest request = new StockCheckCorrectionRequest(6, "Recount after delivery");

        stockCheckService.correctCheck(OWNER_ID, CHECK_ID, request);

        ArgumentCaptor<StockCheckCorrection> captor = ArgumentCaptor.forClass(StockCheckCorrection.class);
        verify(stockCheckCorrectionRepository).save(captor.capture());
        StockCheckCorrection saved = captor.getValue();

        assertThat(saved.getOriginalCount()).isEqualTo(10);
        assertThat(saved.getCorrectedCount()).isEqualTo(6);
        assertThat(saved.getCorrectedBy()).isEqualTo(owner);
        assertThat(saved.getReason()).isEqualTo("Recount after delivery");

        // correctCheck only ever changes currentCount/quantityNeeded -- the
        // stored recorder stays whoever originally submitted the check.
        assertThat(check.getCheckedBy()).isEqualTo(originalRecorder);

        // quantityNeeded resolved to 0 (no thresholds configured), so the
        // order-list side effect never fires.
        org.mockito.Mockito.verifyNoInteractions(orderListService);
    }
}
