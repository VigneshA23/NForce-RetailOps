package com.nforce.retailops.service;

import com.nforce.retailops.dto.StoreCashTargetRequest;
import com.nforce.retailops.dto.StoreCashTargetResponse;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreCashTarget;
import com.nforce.retailops.entity.StoreCashTargetChange;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.StoreCashTargetChangeRepository;
import com.nforce.retailops.repository.StoreCashTargetRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
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

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class StoreCashTargetServiceTest {

    @Mock StoreCashTargetRepository targetRepository;
    @Mock StoreCashTargetChangeRepository changeRepository;
    @Mock StoreOwnerRepository storeOwnerRepository;
    @Mock StoreRepository storeRepository;
    @Mock UserRepository userRepository;
    @Mock SuperAdminRepository superAdminRepository;

    StoreCashTargetService service;
    Store store;
    StoreCashTarget existing;

    @BeforeEach
    void setUp() {
        service = new StoreCashTargetService(targetRepository, changeRepository,
            storeOwnerRepository, storeRepository, userRepository, superAdminRepository);
        store = mock(Store.class);
        when(store.getId()).thenReturn(7L);
        when(storeRepository.findById(7L)).thenReturn(Optional.of(store));
        existing = new StoreCashTarget();
        existing.setStore(store);
        existing.setTargetAmount(new BigDecimal("150.00"));
        when(targetRepository.findByStoreId(7L)).thenReturn(Optional.of(existing));
        when(targetRepository.save(any())).thenAnswer(i -> i.getArgument(0));
    }

    @Test
    void superAdminUpdateChangesAmountAndRecordsSuperAdminActor() {
        SuperAdmin sa = mock(SuperAdmin.class);
        when(sa.getId()).thenReturn(3L);
        when(superAdminRepository.getReferenceById(3L)).thenReturn(sa);

        StoreCashTargetResponse r = service.updateForSuperAdmin(3L, 7L,
            new StoreCashTargetRequest(new BigDecimal("200.00")));

        assertEquals(new BigDecimal("200.00"), r.targetAmount());
        assertEquals(3L, r.updatedBySuperAdminId());
        assertNull(r.updatedByUserId());
        ArgumentCaptor<StoreCashTargetChange> c = ArgumentCaptor.forClass(StoreCashTargetChange.class);
        verify(changeRepository).save(c.capture());
        assertEquals(new BigDecimal("150.00"), c.getValue().getPreviousAmount());
        assertEquals(sa, c.getValue().getChangedBySuperAdmin());
        assertNull(c.getValue().getChangedByUser());
    }

    @Test
    void unchangedAmountWritesNoAuditRow() {
        service.updateForSuperAdmin(3L, 7L, new StoreCashTargetRequest(new BigDecimal("150")));
        verify(changeRepository, never()).save(any());
    }

    @Test
    void missingRowIsCreatedWithoutSettingAmountFromJava() {
        when(targetRepository.findByStoreId(7L)).thenReturn(Optional.empty());
        when(targetRepository.saveAndFlush(any())).thenAnswer(i -> {
            StoreCashTarget t = i.getArgument(0);
            assertNull(t.getTargetAmount()); // default comes from the DB
            t.setTargetAmount(new BigDecimal("150.00")); // simulate read-back
            return t;
        });
        assertEquals(new BigDecimal("150.00"), service.getForSuperAdmin(7L).targetAmount());
    }

    @Test
    void unknownStoreIs404() {
        assertThrows(StoreNotFoundException.class, () -> service.getForSuperAdmin(99L));
    }

    @Test
    void ownerWithoutActiveStoreIsRejected() {
        when(storeOwnerRepository.findByOwnerId(1L)).thenReturn(java.util.List.of());
        assertThrows(StoreNotFoundException.class,
            () -> service.update(1L, new StoreCashTargetRequest(BigDecimal.TEN)));
        verify(changeRepository, never()).save(any());
    }
}
