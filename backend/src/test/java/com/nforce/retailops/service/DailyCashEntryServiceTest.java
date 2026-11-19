package com.nforce.retailops.service;

import com.nforce.retailops.dto.DailyCashEntryRequest;
import com.nforce.retailops.dto.DailyCashEntryResponse;
import com.nforce.retailops.entity.DailyCashEntry;
import com.nforce.retailops.entity.DailyCashEntryCorrection;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.DailyCashEntryNotEditableException;
import com.nforce.retailops.exception.DailyCashEntryNotFoundException;
import com.nforce.retailops.exception.CorrectionReasonRequiredException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.DailyCashEntryCorrectionRepository;
import com.nforce.retailops.repository.DailyCashEntryRepository;
import com.nforce.retailops.repository.StoreEmployeeRepository;
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
    @Mock StoreEmployeeRepository storeEmployeeRepository;
    @Mock UserRepository userRepository;
    @Mock StoreRepository storeRepository;
    @Mock SuperAdminRepository superAdminRepository;
    @Mock CashFlagService flagService;
    @Mock com.nforce.retailops.repository.DailyCashEntryFlagRepository flagRepository;
    @Mock com.nforce.retailops.repository.DailyCashEntryFlagHistoryRepository flagHistoryRepository;

    DailyCashEntryService service;
    Store store;
    User owner;

    @BeforeEach
    void setUp() {
        service = new DailyCashEntryService(entryRepository, correctionRepository, storeOwnerRepository,
            storeEmployeeRepository, storeRepository, userRepository, superAdminRepository,
            flagService, flagRepository, flagHistoryRepository);
        store = mock(Store.class);
        when(store.getId()).thenReturn(5L);
        owner = mock(User.class);
        when(owner.getId()).thenReturn(9L);
        StoreOwner so = mock(StoreOwner.class);
        when(so.isActive()).thenReturn(true);
        when(so.getStore()).thenReturn(store);
        when(storeOwnerRepository.findByOwnerId(9L)).thenReturn(List.of(so));
        when(userRepository.getReferenceById(9L)).thenReturn(owner);
        when(storeRepository.lockByStoreId(5L)).thenReturn(Optional.of(store));
        when(entryRepository.save(any(DailyCashEntry.class))).thenAnswer(i -> i.getArgument(0));
        when(correctionRepository.findByEntryIdOrderByCorrectedAtAscIdAsc(any())).thenReturn(List.of());
    }

    private static DailyCashEntryRequest req(LocalDate date, String opening, String adj) {
        return req(date, opening, adj, null);
    }

    private static DailyCashEntryRequest req(LocalDate date, String opening, String adj, String reason) {
        // opening, removed 10, remaining 90, adjustments
        return new DailyCashEntryRequest(date, new BigDecimal(opening),
            new BigDecimal("10"), new BigDecimal("90"), new BigDecimal(adj), reason);
    }

    private DailyCashEntry existingEntry(LocalDate d) {
        DailyCashEntry existing = new DailyCashEntry();
        existing.setStore(store);
        existing.setBusinessDate(d);
        existing.setOpeningDrawerCash(new BigDecimal("500"));
        existing.setCashRemoved(BigDecimal.ZERO);
        existing.setCashRemaining(BigDecimal.ZERO);
        existing.setOtherAdjustments(BigDecimal.ZERO);
        existing.setEnteredByUser(owner);
        existing.setUpdatedByUser(owner);
        existing.setEnteredAt(java.time.OffsetDateTime.now().minusHours(1));
        existing.setUpdatedAt(java.time.OffsetDateTime.now().minusHours(1));
        return existing;
    }

    @Test
    void firstSaveCreatesEntryWithoutAuditRow() {
        LocalDate d = LocalDate.now();
        when(entryRepository.lockByStoreIdAndBusinessDate(5L, d)).thenReturn(Optional.empty());

        DailyCashEntryResponse r = service.save(9L, req(d, "500", "-3.50"));

        assertEquals(new BigDecimal("500"), r.openingDrawerCash());
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
        existing.setOpeningDrawerCash(new BigDecimal("500"));
        existing.setCashRemoved(BigDecimal.ZERO);
        existing.setCashRemaining(BigDecimal.ZERO);
        existing.setOtherAdjustments(BigDecimal.ZERO);
        existing.setEnteredByUser(owner);
        existing.setUpdatedByUser(owner);
        existing.setEnteredAt(java.time.OffsetDateTime.now().minusHours(1));
        existing.setUpdatedAt(java.time.OffsetDateTime.now().minusHours(1));
        when(entryRepository.lockByStoreIdAndBusinessDate(5L, d)).thenReturn(Optional.of(existing));

        DailyCashEntryResponse r = service.save(9L, req(d, "650", "0", "  Till miscounted  "));

        ArgumentCaptor<DailyCashEntryCorrection> cap = ArgumentCaptor.forClass(DailyCashEntryCorrection.class);
        verify(correctionRepository).save(cap.capture());
        DailyCashEntryCorrection c = cap.getValue();
        assertEquals(new BigDecimal("500"), c.getPreviousOpeningDrawerCash());
        assertEquals(new BigDecimal("650"), c.getNewOpeningDrawerCash());
        assertEquals(new BigDecimal("90"), c.getNewCashRemaining());
        assertEquals("Till miscounted", c.getReason());
        assertEquals(owner, c.getCorrectedByUser());
        assertEquals(new BigDecimal("650"), r.openingDrawerCash());
    }

    @Test
    void correctingAnExistingEntryWithoutAReasonIsRefusedAndChangesNothing() {
        LocalDate d = LocalDate.now();
        DailyCashEntry existing = existingEntry(d);
        when(entryRepository.lockByStoreIdAndBusinessDate(5L, d)).thenReturn(Optional.of(existing));

        assertThrows(CorrectionReasonRequiredException.class, () -> service.save(9L, req(d, "650", "0", "   ")));
        assertThrows(CorrectionReasonRequiredException.class, () -> service.save(9L, req(d, "650", "0", null)));

        assertEquals(new BigDecimal("500"), existing.getOpeningDrawerCash());
        verify(correctionRepository, never()).save(any());
        verify(entryRepository, never()).save(any());
    }

    @Test
    void resavingIdenticalFiguresIsNotACorrection() {
        LocalDate d = LocalDate.now();
        DailyCashEntry existing = existingEntry(d);
        existing.setCashRemoved(new BigDecimal("10"));
        existing.setCashRemaining(new BigDecimal("90"));
        when(entryRepository.lockByStoreIdAndBusinessDate(5L, d)).thenReturn(Optional.of(existing));

        service.save(9L, req(d, "500.00", "0"));

        verify(correctionRepository, never()).save(any());
    }

    @Test
    void theEntryShowsWhoLastCorrectedItAndWhen() {
        LocalDate d = LocalDate.now();
        DailyCashEntry existing = existingEntry(d);
        when(entryRepository.lockByStoreIdAndBusinessDate(5L, d)).thenReturn(Optional.of(existing));
        when(owner.getFullName()).thenReturn("Priya Admin");
        java.util.List<DailyCashEntryCorrection> saved = new java.util.ArrayList<>();
        when(correctionRepository.save(any(DailyCashEntryCorrection.class))).thenAnswer(i -> {
            saved.add(i.getArgument(0));
            return i.getArgument(0);
        });
        when(correctionRepository.findByEntryIdOrderByCorrectedAtAscIdAsc(any())).thenAnswer(i -> saved);

        DailyCashEntryResponse r = service.save(9L, req(d, "650", "0", "Typo in opening cash"));

        assertEquals("Priya Admin", r.correctedByName());
        assertEquals(saved.get(0).getCorrectedAt(), r.correctedAt());
        assertEquals(1, r.history().size());
        assertEquals("Typo in opening cash", r.history().get(0).reason());
        assertEquals(new BigDecimal("500"), r.history().get(0).previousOpeningDrawerCash());
        assertEquals(new BigDecimal("650"), r.history().get(0).newOpeningDrawerCash());
    }

    @Test
    void superAdminSavesForChosenStoreAndIsRecordedAsSuperAdmin() {
        LocalDate d = LocalDate.now();
        SuperAdmin sa = mock(SuperAdmin.class);
        when(sa.getId()).thenReturn(3L);
        when(storeRepository.findById(5L)).thenReturn(Optional.of(store));
        when(superAdminRepository.getReferenceById(3L)).thenReturn(sa);
        when(entryRepository.lockByStoreIdAndBusinessDate(5L, d)).thenReturn(Optional.empty());

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

    // ---- employee saves ----------------------------------------------------

    private User employee(long id, String name) {
        User u = mock(User.class);
        when(u.getId()).thenReturn(id);
        when(u.getFullName()).thenReturn(name);
        when(userRepository.getReferenceById(id)).thenReturn(u);
        when(storeEmployeeRepository.existsByEmployeeIdAndActiveStoreId(id, 5L)).thenReturn(true);
        return u;
    }

    @Test
    void employeeFirstSaveRecordsTheEmployeeAndWritesNoAuditRow() {
        LocalDate d = LocalDate.now();
        User emp = employee(21L, "Erin Employee");
        when(storeRepository.findById(5L)).thenReturn(Optional.of(store));
        when(entryRepository.lockByStoreIdAndBusinessDate(5L, d)).thenReturn(Optional.empty());

        DailyCashEntryResponse r = service.saveForEmployee(21L, 5L, req(d, "200", "0"));

        assertEquals(21L, r.enteredByUserId());
        assertEquals("Erin Employee", r.enteredByName());
        assertEquals(21L, r.updatedByUserId());
        assertEquals(null, r.enteredBySuperAdminId());
        verify(correctionRepository, never()).save(any());
    }

    @Test
    void secondEmployeeEditAppendsACorrectionNamingTheSecondEmployee() {
        LocalDate d = LocalDate.now();
        User first = employee(21L, "Erin Employee");
        User second = employee(22L, "Sam Second");
        when(storeRepository.findById(5L)).thenReturn(Optional.of(store));
        DailyCashEntry existing = new DailyCashEntry();
        existing.setStore(store);
        existing.setBusinessDate(d);
        existing.setOpeningDrawerCash(new BigDecimal("200"));
        existing.setCashRemoved(BigDecimal.ZERO);
        existing.setCashRemaining(BigDecimal.ZERO);
        existing.setOtherAdjustments(BigDecimal.ZERO);
        existing.setEnteredByUser(first);
        existing.setUpdatedByUser(first);
        existing.setEnteredAt(java.time.OffsetDateTime.now().minusHours(1));
        existing.setUpdatedAt(java.time.OffsetDateTime.now().minusHours(1));
        when(entryRepository.lockByStoreIdAndBusinessDate(5L, d)).thenReturn(Optional.of(existing));

        DailyCashEntryResponse r = service.saveForEmployee(22L, 5L, req(d, "250", "0"));

        ArgumentCaptor<DailyCashEntryCorrection> cap = ArgumentCaptor.forClass(DailyCashEntryCorrection.class);
        verify(correctionRepository).save(cap.capture());
        assertEquals(new BigDecimal("200"), cap.getValue().getPreviousOpeningDrawerCash());
        assertEquals(second, cap.getValue().getCorrectedByUser());
        assertEquals(first, cap.getValue().getPreviousUpdatedByUser());
        assertEquals(new BigDecimal("250"), r.openingDrawerCash());
        assertEquals(21L, r.enteredByUserId());
        assertEquals(22L, r.updatedByUserId());
    }

    @Test
    void employeeCannotSaveForANonTodayDate() {
        employee(21L, "Erin Employee");
        when(storeRepository.findById(5L)).thenReturn(Optional.of(store));
        assertThrows(DailyCashEntryNotEditableException.class,
            () -> service.saveForEmployee(21L, 5L, req(LocalDate.now().minusDays(1), "200", "0")));
        verify(entryRepository, never()).save(any());
    }

    @Test
    void employeeCannotSaveOrReadAStoreTheyAreNotAssignedTo() {
        when(storeEmployeeRepository.existsByEmployeeIdAndActiveStoreId(23L, 5L)).thenReturn(false);
        assertThrows(StoreNotFoundException.class,
            () -> service.saveForEmployee(23L, 5L, req(LocalDate.now(), "200", "0")));
        assertThrows(StoreNotFoundException.class, () -> service.getForEmployee(23L, 5L, null));
        verify(entryRepository, never()).save(any());
    }
}
