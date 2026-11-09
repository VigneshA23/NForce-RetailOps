package com.nforce.retailops.service;

import com.nforce.retailops.dto.DailyCashEntryRequest;
import com.nforce.retailops.dto.DailyCashEntryResponse;
import com.nforce.retailops.entity.DailyCashEntry;
import com.nforce.retailops.entity.DailyCashEntryCorrection;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.DailyCashEntryNotFoundException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.DailyCashEntryCorrectionRepository;
import com.nforce.retailops.repository.DailyCashEntryRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.SuperAdminRepository;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DailyCashEntryServiceTest {

    @Mock DailyCashEntryRepository entryRepository;
    @Mock DailyCashEntryCorrectionRepository correctionRepository;
    @Mock StoreOwnerRepository storeOwnerRepository;
    @Mock UserRepository userRepository;
    @Mock StoreRepository storeRepository;
    @Mock SuperAdminRepository superAdminRepository;

    DailyCashEntryService service;
    Store store;
    User owner;

    @BeforeEach
    void setUp() {
        service = new DailyCashEntryService(entryRepository, correctionRepository, storeOwnerRepository,
            storeRepository, userRepository, superAdminRepository);
        store = mock(Store.class);
        when(store.getId()).thenReturn(5L);
        owner = mock(User.class);
        when(owner.getId()).thenReturn(9L);
        StoreOwner so = mock(StoreOwner.class);
        when(so.isActive()).thenReturn(true);
        when(so.getStore()).thenReturn(store);
        when(storeOwnerRepository.findByOwnerId(9L)).thenReturn(List.of(so));
        when(userRepository.getReferenceById(9L)).thenReturn(owner);
        when(entryRepository.save(any(DailyCashEntry.class))).thenAnswer(i -> i.getArgument(0));
        when(correctionRepository.findByEntryIdOrderByCorrectedAtAscIdAsc(any())).thenReturn(List.of());
    }

    private static DailyCashEntryRequest req(LocalDate date, String sales, String adj) {
        return new DailyCashEntryRequest(date, new BigDecimal(sales), new BigDecimal("100"),
            new BigDecimal("10"), new BigDecimal("90"), new BigDecimal("5"), new BigDecimal("20"), new BigDecimal(adj));
    }

    @Test
    void firstSaveCreatesEntryWithoutAuditRow() {
        LocalDate d = LocalDate.now();
        when(entryRepository.findByStoreIdAndBusinessDate(5L, d)).thenReturn(Optional.empty());

        DailyCashEntryResponse r = service.save(9L, req(d, "500", "-3.50"));

        assertEquals(new BigDecimal("500"), r.totalCashSales());
        assertEquals(new BigDecimal("-3.50"), r.otherAdjustments());
        assertEquals(d, r.businessDate());
        verify(correctionRepository, never()).save(any());
    }

    @Test
    void resaveUpdatesInPlaceAndAppendsPriorValues() {
        LocalDate d = LocalDate.now();
        DailyCashEntry existing = new DailyCashEntry();
        existing.setStore(store);
        existing.setBusinessDate(d);
        existing.setTotalCashSales(new BigDecimal("500"));
        existing.setOpeningDrawerCash(new BigDecimal("100"));
        existing.setCashRemoved(BigDecimal.ZERO);
        existing.setCashRemaining(BigDecimal.ZERO);
        existing.setCashExpenses(BigDecimal.ZERO);
        existing.setBankDeposits(BigDecimal.ZERO);
        existing.setOtherAdjustments(BigDecimal.ZERO);
        existing.setEnteredByUser(owner);
        existing.setUpdatedByUser(owner);
        existing.setEnteredAt(java.time.OffsetDateTime.now().minusHours(1));
        existing.setUpdatedAt(java.time.OffsetDateTime.now().minusHours(1));
        when(entryRepository.findByStoreIdAndBusinessDate(5L, d)).thenReturn(Optional.of(existing));

        DailyCashEntryResponse r = service.save(9L, req(d, "650", "0"));

        ArgumentCaptor<DailyCashEntryCorrection> cap = ArgumentCaptor.forClass(DailyCashEntryCorrection.class);
        verify(correctionRepository).save(cap.capture());
        assertEquals(new BigDecimal("500"), cap.getValue().getPreviousTotalCashSales());
        assertEquals(new BigDecimal("650"), r.totalCashSales());
    }

    @Test
    void superAdminSavesForChosenStoreAndIsRecordedAsSuperAdmin() {
        LocalDate d = LocalDate.now();
        SuperAdmin sa = mock(SuperAdmin.class);
        when(sa.getId()).thenReturn(3L);
        when(storeRepository.findById(5L)).thenReturn(Optional.of(store));
        when(superAdminRepository.getReferenceById(3L)).thenReturn(sa);
        when(entryRepository.findByStoreIdAndBusinessDate(5L, d)).thenReturn(Optional.empty());

        DailyCashEntryResponse r = service.saveForSuperAdmin(3L, 5L, req(d, "500", "0"));

        assertEquals(3L, r.enteredBySuperAdminId());
        assertEquals(null, r.enteredByUserId());
        assertEquals(3L, r.updatedBySuperAdminId());
    }

    @Test
    void superAdminUnknownStoreIsNotFound() {
        when(storeRepository.findById(99L)).thenReturn(Optional.empty());
        assertThrows(StoreNotFoundException.class,
            () -> service.saveForSuperAdmin(3L, 99L, req(LocalDate.now(), "1", "0")));
        assertThrows(StoreNotFoundException.class, () -> service.getForSuperAdmin(99L, null));
        verify(entryRepository, never()).save(any());
    }

    @Test
    void callerWithoutActiveStoreIsRejected() {
        when(storeOwnerRepository.findByOwnerId(anyLong())).thenReturn(List.of());
        assertThrows(StoreNotFoundException.class, () -> service.save(9L, req(LocalDate.now(), "1", "0")));
        assertThrows(StoreNotFoundException.class, () -> service.get(9L, null));
    }

    @Test
    void getMissingEntryIsNotFound() {
        when(entryRepository.findByStoreIdAndBusinessDate(anyLong(), any())).thenReturn(Optional.empty());
        assertThrows(DailyCashEntryNotFoundException.class, () -> service.get(9L, LocalDate.now()));
    }
}
