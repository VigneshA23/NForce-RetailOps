package com.nforce.retailops.service;

import com.nforce.retailops.dto.SuperAdminCashCorrectionRequest;
import com.nforce.retailops.dto.SuperAdminCashFlagRequest;
import com.nforce.retailops.dto.SuperAdminCashReviewResponse;
import com.nforce.retailops.entity.DailyCashEntry;
import com.nforce.retailops.entity.DailyCashEntryCorrection;
import com.nforce.retailops.entity.DailyCashEntryFlag;
import com.nforce.retailops.entity.DailyCashEntryFlagAction;
import com.nforce.retailops.entity.DailyCashEntryFlagHistory;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.CashEntryFlagException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.DailyCashEntryCorrectionRepository;
import com.nforce.retailops.repository.DailyCashEntryFlagHistoryRepository;
import com.nforce.retailops.repository.DailyCashEntryFlagRepository;
import com.nforce.retailops.repository.DailyCashEntryRepository;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.SuperAdminRepository;
import com.nforce.retailops.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// Uses real entity POJOs (via ReflectionTestUtils where fields are
// generated-id-only) so the Byte Buddy / Java 26 incompatibility that
// prevents mocking JPA entities on this machine never trips.
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SuperAdminCashReviewServiceTest {

    private static final Long STORE_ID = 5L;
    private static final Long ENTRY_ID = 42L;
    private static final Long SA_ID = 1L;
    private static final Long EMPLOYEE_ID = 77L;

    @Mock DailyCashEntryRepository entryRepository;
    @Mock DailyCashEntryCorrectionRepository correctionRepository;
    @Mock DailyCashEntryFlagRepository flagRepository;
    @Mock DailyCashEntryFlagHistoryRepository flagHistoryRepository;
    @Mock StoreRepository storeRepository;
    @Mock StoreEmployeeRepository storeEmployeeRepository;
    @Mock SuperAdminRepository superAdminRepository;
    @Mock UserRepository userRepository;
    @Mock StoreCashTargetService cashTargetService;
    @Mock NotificationService notificationService;

    SuperAdminCashReviewService service;

    Store store;
    SuperAdmin superAdmin;
    User employee;

    @BeforeEach
    void setUp() {
        service = new SuperAdminCashReviewService(
            entryRepository, correctionRepository, flagRepository, flagHistoryRepository,
            storeRepository, storeEmployeeRepository, superAdminRepository, userRepository,
            cashTargetService, notificationService);

        store = new Store();
        ReflectionTestUtils.setField(store, "id", STORE_ID);
        store.setName("Keds Downtown");
        store.setStoreCode(101L);

        superAdmin = new SuperAdmin();
        ReflectionTestUtils.setField(superAdmin, "id", SA_ID);
        superAdmin.setName("Admin User");

        employee = new User();
        ReflectionTestUtils.setField(employee, "id", EMPLOYEE_ID);
        employee.setFullName("Casey Clerk");
        employee.setActive(true);

        when(storeRepository.findById(STORE_ID)).thenReturn(Optional.of(store));
        when(superAdminRepository.getReferenceById(SA_ID)).thenReturn(superAdmin);
        when(superAdminRepository.findById(SA_ID)).thenReturn(Optional.of(superAdmin));
        when(userRepository.findById(EMPLOYEE_ID)).thenReturn(Optional.of(employee));
        when(cashTargetService.getTargetAmount(STORE_ID)).thenReturn(new BigDecimal("500.00"));
        when(correctionRepository.findByEntryIdOrderByCorrectedAtAscIdAsc(any()))
            .thenReturn(List.of());
        when(flagRepository.findFirstByEntryIdAndResolvedAtIsNull(any())).thenReturn(Optional.empty());
        // The service post-save path calls recordCorrection(entry, reason) on
        // the entity returned by save() -- echo the argument back so it does
        // not receive null.
        when(entryRepository.save(any(DailyCashEntry.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    // ---- get() ------------------------------------------------------------

    @Test
    void get_noEntry_returnsEmptyPayloadWithTargetAndRunningExpected() {
        LocalDate date = LocalDate.parse("2026-11-18");
        when(entryRepository.findByStoreIdAndBusinessDate(STORE_ID, date)).thenReturn(Optional.empty());
        when(entryRepository.sumExpectedCashOnHandUpTo(STORE_ID, date))
            .thenReturn(new BigDecimal("1234.56"));

        SuperAdminCashReviewResponse response = service.get(STORE_ID, date);

        assertNull(response.entry());
        assertNull(response.flag());
        assertTrue(response.history().isEmpty());
        assertEquals(new BigDecimal("500.00"), response.cashTarget());
        assertEquals(new BigDecimal("1234.56"), response.expectedCashOnHand());
        assertEquals("Keds Downtown", response.storeName());
    }

    @Test
    void get_nullSum_treatedAsZero() {
        LocalDate date = LocalDate.parse("2026-11-18");
        when(entryRepository.findByStoreIdAndBusinessDate(STORE_ID, date)).thenReturn(Optional.empty());
        when(entryRepository.sumExpectedCashOnHandUpTo(STORE_ID, date)).thenReturn(null);

        assertEquals(BigDecimal.ZERO, service.get(STORE_ID, date).expectedCashOnHand());
    }

    @Test
    void get_withEntry_mapsFieldsAndStatusEntered() {
        LocalDate date = LocalDate.parse("2026-11-18");
        DailyCashEntry entry = baseEntry(date, employee, null);
        when(entryRepository.findByStoreIdAndBusinessDate(STORE_ID, date)).thenReturn(Optional.of(entry));
        when(entryRepository.sumExpectedCashOnHandUpTo(STORE_ID, date)).thenReturn(new BigDecimal("600"));

        SuperAdminCashReviewResponse response = service.get(STORE_ID, date);

        assertNotNull(response.entry());
        assertEquals("Entered", response.entry().status());
        assertEquals("Casey Clerk", response.entry().enteredBy().name());
        assertEquals(new BigDecimal("200"), response.entry().openingDrawerCash());
        assertNull(response.flag());
    }

    @Test
    void get_statusIsCorrected_whenHistoryExists() {
        LocalDate date = LocalDate.parse("2026-11-18");
        DailyCashEntry entry = baseEntry(date, employee, null);
        when(entryRepository.findByStoreIdAndBusinessDate(STORE_ID, date)).thenReturn(Optional.of(entry));
        when(entryRepository.sumExpectedCashOnHandUpTo(STORE_ID, date)).thenReturn(BigDecimal.ZERO);
        when(correctionRepository.findByEntryIdOrderByCorrectedAtAscIdAsc(ENTRY_ID))
            .thenReturn(List.of(someCorrection()));

        assertEquals("Corrected", service.get(STORE_ID, date).entry().status());
    }

    @Test
    void get_statusIsFlagged_whenOpenFlagExists() {
        LocalDate date = LocalDate.parse("2026-11-18");
        DailyCashEntry entry = baseEntry(date, employee, null);
        when(entryRepository.findByStoreIdAndBusinessDate(STORE_ID, date)).thenReturn(Optional.of(entry));
        when(entryRepository.sumExpectedCashOnHandUpTo(STORE_ID, date)).thenReturn(BigDecimal.ZERO);
        DailyCashEntryFlag flag = openFlag(entry, "Looks off by two hundred dollars");
        when(flagRepository.findFirstByEntryIdAndResolvedAtIsNull(ENTRY_ID))
            .thenReturn(Optional.of(flag));

        SuperAdminCashReviewResponse response = service.get(STORE_ID, date);
        assertEquals("Flagged", response.entry().status());
        assertNotNull(response.flag());
        assertEquals("Looks off by two hundred dollars", response.flag().comment());
    }

    @Test
    void get_unknownStore_throws404() {
        when(storeRepository.findById(9999L)).thenReturn(Optional.empty());
        assertThrows(StoreNotFoundException.class, () -> service.get(9999L, LocalDate.now()));
    }

    // ---- correct() --------------------------------------------------------

    @Test
    void correct_snapshotsPriorValues_thenOverwritesEntry() {
        LocalDate date = LocalDate.parse("2026-11-18");
        DailyCashEntry entry = baseEntry(date, employee, null);
        when(entryRepository.findById(ENTRY_ID)).thenReturn(Optional.of(entry));
        when(entryRepository.findByStoreIdAndBusinessDate(STORE_ID, date)).thenReturn(Optional.of(entry));
        when(entryRepository.sumExpectedCashOnHandUpTo(STORE_ID, date)).thenReturn(BigDecimal.ZERO);

        SuperAdminCashCorrectionRequest req = new SuperAdminCashCorrectionRequest(
            new BigDecimal("250"), new BigDecimal("40"),
            new BigDecimal("180"), new BigDecimal("-10"), "Opening count was off  ");

        service.correct(SA_ID, STORE_ID, ENTRY_ID, req);

        // Snapshot captured the pre-change values with the trimmed reason.
        ArgumentCaptor<DailyCashEntryCorrection> snapCaptor =
            ArgumentCaptor.forClass(DailyCashEntryCorrection.class);
        verify(correctionRepository).save(snapCaptor.capture());
        DailyCashEntryCorrection snap = snapCaptor.getValue();
        assertEquals(new BigDecimal("200"), snap.getPreviousOpeningDrawerCash());
        assertEquals("Opening count was off", snap.getReason());
        assertEquals(superAdmin, snap.getCorrectedBySuperAdmin());

        // Entry got the new values in place, Super Admin becomes updatedBy.
        assertEquals(new BigDecimal("250"), entry.getOpeningDrawerCash());
        assertEquals(new BigDecimal("-10"), entry.getOtherAdjustments());
        assertEquals(superAdmin, entry.getUpdatedBySuperAdmin());
        assertNull(entry.getUpdatedByUser());
        verify(entryRepository).save(entry);
    }

    @Test
    void correct_resolvesOpenFlagAsSideEffect() {
        LocalDate date = LocalDate.parse("2026-11-18");
        DailyCashEntry entry = baseEntry(date, employee, null);
        DailyCashEntryFlag open = openFlag(entry, "Counts look wrong today -- please review");
        when(entryRepository.findById(ENTRY_ID)).thenReturn(Optional.of(entry));
        when(entryRepository.findByStoreIdAndBusinessDate(STORE_ID, date)).thenReturn(Optional.of(entry));
        when(entryRepository.sumExpectedCashOnHandUpTo(STORE_ID, date)).thenReturn(BigDecimal.ZERO);
        when(flagRepository.findFirstByEntryIdAndResolvedAtIsNull(ENTRY_ID))
            .thenReturn(Optional.of(open))
            .thenReturn(Optional.empty()); // the re-read in get() sees it resolved

        service.correct(SA_ID, STORE_ID, ENTRY_ID, validCorrection());

        assertNotNull(open.getResolvedAt());
        assertEquals(superAdmin, open.getResolvedBySuperAdmin());
        ArgumentCaptor<DailyCashEntryFlagHistory> histCaptor =
            ArgumentCaptor.forClass(DailyCashEntryFlagHistory.class);
        verify(flagHistoryRepository).save(histCaptor.capture());
        assertEquals(DailyCashEntryFlagAction.RESOLVED, histCaptor.getValue().getAction());
    }

    // ---- raiseFlag() ------------------------------------------------------

    @Test
    void raiseFlag_savesFlag_notifiesEmployee_recordsHistory() {
        LocalDate date = LocalDate.parse("2026-11-18");
        DailyCashEntry entry = baseEntry(date, employee, null);
        when(entryRepository.findById(ENTRY_ID)).thenReturn(Optional.of(entry));
        when(entryRepository.findByStoreIdAndBusinessDate(STORE_ID, date)).thenReturn(Optional.of(entry));
        when(entryRepository.sumExpectedCashOnHandUpTo(STORE_ID, date)).thenReturn(BigDecimal.ZERO);
        when(storeEmployeeRepository.existsByEmployeeIdAndStoresId(EMPLOYEE_ID, STORE_ID)).thenReturn(true);
        when(flagRepository.save(any(DailyCashEntryFlag.class))).thenAnswer(inv -> {
            DailyCashEntryFlag f = inv.getArgument(0);
            ReflectionTestUtils.setField(f, "id", 1234L);
            return f;
        });

        service.raiseFlag(SA_ID, STORE_ID, ENTRY_ID,
            new SuperAdminCashFlagRequest("Opening drawer is clearly wrong today"));

        ArgumentCaptor<DailyCashEntryFlag> captor = ArgumentCaptor.forClass(DailyCashEntryFlag.class);
        verify(flagRepository).save(captor.capture());
        DailyCashEntryFlag flag = captor.getValue();
        assertEquals(employee, flag.getNotifiedUser());
        assertEquals(superAdmin, flag.getFlaggedBySuperAdmin());
        assertEquals("Opening drawer is clearly wrong today", flag.getComment());

        verify(notificationService).sendForStore(
            eq(employee), eq("CASH_ENTRY_FLAGGED"), anyString(), anyString(), anyString(), eq(store));

        ArgumentCaptor<DailyCashEntryFlagHistory> h = ArgumentCaptor.forClass(DailyCashEntryFlagHistory.class);
        verify(flagHistoryRepository).save(h.capture());
        assertEquals(DailyCashEntryFlagAction.RAISED, h.getValue().getAction());
    }

    @Test
    void raiseFlag_rejectsShortComment() {
        LocalDate date = LocalDate.parse("2026-11-18");
        DailyCashEntry entry = baseEntry(date, employee, null);
        when(entryRepository.findById(ENTRY_ID)).thenReturn(Optional.of(entry));

        CashEntryFlagException ex = assertThrows(CashEntryFlagException.class,
            () -> service.raiseFlag(SA_ID, STORE_ID, ENTRY_ID,
                new SuperAdminCashFlagRequest("Too short")));
        assertTrue(ex.getMessage().toLowerCase().contains("at least"));
        verify(flagRepository, never()).save(any());
        verify(notificationService, never()).sendForStore(any(), any(), any(), any(), any(), any());
    }

    @Test
    void raiseFlag_refused_whenEntryHasNoEmployeeAuthor() {
        LocalDate date = LocalDate.parse("2026-11-18");
        DailyCashEntry entry = baseEntry(date, null, superAdmin); // SA-entered
        when(entryRepository.findById(ENTRY_ID)).thenReturn(Optional.of(entry));

        CashEntryFlagException ex = assertThrows(CashEntryFlagException.class,
            () -> service.raiseFlag(SA_ID, STORE_ID, ENTRY_ID,
                new SuperAdminCashFlagRequest("Numbers do not add up at all")));
        assertTrue(ex.getMessage().toLowerCase().contains("correct the entry"));
        verify(notificationService, never()).sendForStore(any(), any(), any(), any(), any(), any());
    }

    @Test
    void raiseFlag_refused_whenEmployeeNoLongerAssignedToStore() {
        LocalDate date = LocalDate.parse("2026-11-18");
        DailyCashEntry entry = baseEntry(date, employee, null);
        when(entryRepository.findById(ENTRY_ID)).thenReturn(Optional.of(entry));
        when(storeEmployeeRepository.existsByEmployeeIdAndStoresId(EMPLOYEE_ID, STORE_ID))
            .thenReturn(false);

        CashEntryFlagException ex = assertThrows(CashEntryFlagException.class,
            () -> service.raiseFlag(SA_ID, STORE_ID, ENTRY_ID,
                new SuperAdminCashFlagRequest("Numbers do not add up at all")));
        assertTrue(ex.getMessage().toLowerCase().contains("no longer assigned"));
    }

    @Test
    void raiseFlag_refused_whenEmployeeInactive() {
        LocalDate date = LocalDate.parse("2026-11-18");
        employee.setActive(false);
        DailyCashEntry entry = baseEntry(date, employee, null);
        when(entryRepository.findById(ENTRY_ID)).thenReturn(Optional.of(entry));

        assertThrows(CashEntryFlagException.class,
            () -> service.raiseFlag(SA_ID, STORE_ID, ENTRY_ID,
                new SuperAdminCashFlagRequest("Numbers do not add up at all")));
    }

    @Test
    void raiseFlag_refused_whenFlagAlreadyOpen() {
        LocalDate date = LocalDate.parse("2026-11-18");
        DailyCashEntry entry = baseEntry(date, employee, null);
        when(entryRepository.findById(ENTRY_ID)).thenReturn(Optional.of(entry));
        when(flagRepository.findFirstByEntryIdAndResolvedAtIsNull(ENTRY_ID))
            .thenReturn(Optional.of(openFlag(entry, "already flagged comment here")));

        assertThrows(CashEntryFlagException.class,
            () -> service.raiseFlag(SA_ID, STORE_ID, ENTRY_ID,
                new SuperAdminCashFlagRequest("Please take another look at this")));
    }

    // ---- editFlag() / removeFlag() ---------------------------------------

    @Test
    void editFlag_updatesCommentAndAppendsHistory() {
        LocalDate date = LocalDate.parse("2026-11-18");
        DailyCashEntry entry = baseEntry(date, employee, null);
        DailyCashEntryFlag flag = openFlag(entry, "original comment with enough words");
        when(entryRepository.findById(ENTRY_ID)).thenReturn(Optional.of(entry));
        when(entryRepository.findByStoreIdAndBusinessDate(STORE_ID, date)).thenReturn(Optional.of(entry));
        when(entryRepository.sumExpectedCashOnHandUpTo(STORE_ID, date)).thenReturn(BigDecimal.ZERO);
        when(flagRepository.findFirstByEntryIdAndResolvedAtIsNull(ENTRY_ID))
            .thenReturn(Optional.of(flag));

        service.editFlag(SA_ID, STORE_ID, ENTRY_ID,
            new SuperAdminCashFlagRequest("revised comment with more detail here"));

        assertEquals("revised comment with more detail here", flag.getComment());
        assertNotNull(flag.getCommentUpdatedAt());
        ArgumentCaptor<DailyCashEntryFlagHistory> h = ArgumentCaptor.forClass(DailyCashEntryFlagHistory.class);
        verify(flagHistoryRepository).save(h.capture());
        assertEquals(DailyCashEntryFlagAction.COMMENT_EDITED, h.getValue().getAction());
        assertEquals("original comment with enough words", h.getValue().getPreviousComment());
    }

    @Test
    void editFlag_withoutOpenFlag_throws() {
        LocalDate date = LocalDate.parse("2026-11-18");
        DailyCashEntry entry = baseEntry(date, employee, null);
        when(entryRepository.findById(ENTRY_ID)).thenReturn(Optional.of(entry));
        when(flagRepository.findFirstByEntryIdAndResolvedAtIsNull(ENTRY_ID)).thenReturn(Optional.empty());
        assertThrows(CashEntryFlagException.class, () -> service.editFlag(SA_ID, STORE_ID, ENTRY_ID,
            new SuperAdminCashFlagRequest("new comment with enough words in it")));
    }

    @Test
    void removeFlag_marksResolvedAndRecordsHistory() {
        LocalDate date = LocalDate.parse("2026-11-18");
        DailyCashEntry entry = baseEntry(date, employee, null);
        DailyCashEntryFlag flag = openFlag(entry, "flagged for review eventually");
        when(entryRepository.findById(ENTRY_ID)).thenReturn(Optional.of(entry));
        when(entryRepository.findByStoreIdAndBusinessDate(STORE_ID, date)).thenReturn(Optional.of(entry));
        when(entryRepository.sumExpectedCashOnHandUpTo(STORE_ID, date)).thenReturn(BigDecimal.ZERO);
        when(flagRepository.findFirstByEntryIdAndResolvedAtIsNull(ENTRY_ID))
            .thenReturn(Optional.of(flag))
            .thenReturn(Optional.empty()); // post-resolve

        service.removeFlag(SA_ID, STORE_ID, ENTRY_ID);

        assertNotNull(flag.getResolvedAt());
        assertEquals(superAdmin, flag.getResolvedBySuperAdmin());
        ArgumentCaptor<DailyCashEntryFlagHistory> h = ArgumentCaptor.forClass(DailyCashEntryFlagHistory.class);
        verify(flagHistoryRepository).save(h.capture());
        assertEquals(DailyCashEntryFlagAction.REMOVED, h.getValue().getAction());
    }

    // ---- fixtures ---------------------------------------------------------

    private DailyCashEntry baseEntry(LocalDate date, User enteredBy, SuperAdmin enteredBySa) {
        DailyCashEntry entry = new DailyCashEntry();
        ReflectionTestUtils.setField(entry, "id", ENTRY_ID);
        entry.setStore(store);
        entry.setBusinessDate(date);
        entry.setOpeningDrawerCash(new BigDecimal("200"));
        entry.setCashRemoved(new BigDecimal("50"));
        entry.setCashRemaining(new BigDecimal("450"));
        entry.setOtherAdjustments(new BigDecimal("10"));
        entry.setDailyExpectedCash(new BigDecimal("460")); // cashRemaining + otherAdjustments
        entry.setEnteredByUser(enteredBy);
        entry.setEnteredBySuperAdmin(enteredBySa);
        entry.setEnteredAt(OffsetDateTime.now());
        entry.setUpdatedByUser(enteredBy);
        entry.setUpdatedBySuperAdmin(enteredBySa);
        entry.setUpdatedAt(OffsetDateTime.now());
        return entry;
    }

    private DailyCashEntryFlag openFlag(DailyCashEntry entry, String comment) {
        DailyCashEntryFlag flag = new DailyCashEntryFlag();
        ReflectionTestUtils.setField(flag, "id", 999L);
        flag.setEntry(entry);
        flag.setComment(comment);
        flag.setNotifiedUser(entry.getEnteredByUser());
        flag.setFlaggedBySuperAdmin(superAdmin);
        flag.setFlaggedAt(OffsetDateTime.now());
        return flag;
    }

    private DailyCashEntryCorrection someCorrection() {
        DailyCashEntryCorrection c = new DailyCashEntryCorrection();
        ReflectionTestUtils.setField(c, "id", 8L);
        ReflectionTestUtils.setField(c, "previousOpeningDrawerCash", new BigDecimal("100"));
        ReflectionTestUtils.setField(c, "previousCashRemoved", new BigDecimal("0"));
        ReflectionTestUtils.setField(c, "previousCashRemaining", new BigDecimal("100"));
        ReflectionTestUtils.setField(c, "previousOtherAdjustments", new BigDecimal("0"));
        ReflectionTestUtils.setField(c, "previousUpdatedAt", OffsetDateTime.now());
        ReflectionTestUtils.setField(c, "correctedAt", OffsetDateTime.now());
        ReflectionTestUtils.setField(c, "correctedBySuperAdmin", superAdmin);
        return c;
    }

    private SuperAdminCashCorrectionRequest validCorrection() {
        return new SuperAdminCashCorrectionRequest(
            new BigDecimal("210"), new BigDecimal("45"),
            new BigDecimal("190"), BigDecimal.ZERO, "Updating based on recount");
    }
}
