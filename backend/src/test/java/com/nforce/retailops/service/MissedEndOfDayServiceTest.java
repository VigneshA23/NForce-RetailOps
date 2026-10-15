package com.nforce.retailops.service;

import com.nforce.retailops.entity.Notification;
import com.nforce.retailops.entity.StockCheck;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreEmployee;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.NotificationRepository;
import com.nforce.retailops.repository.StockCheckRepository;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MissedEndOfDayServiceTest {

    private static final Long STORE_ID = 10L;
    private final LocalDate yesterday = LocalDate.now().minusDays(1);

    @Mock private StockCheckRepository stockCheckRepository;
    @Mock private NotificationRepository notificationRepository;
    @Mock private StoreEmployeeRepository storeEmployeeRepository;
    @Mock private StoreOwnerRepository storeOwnerRepository;

    @InjectMocks
    private MissedEndOfDayService service;

    private Store store;
    private User employee;
    private User otherEmployee;
    private User owner;

    @BeforeEach
    void setUp() {
        store = new Store();
        ReflectionTestUtils.setField(store, "id", STORE_ID);
        store.setName("Plano");

        employee = user(2L);
        otherEmployee = user(3L);
        owner = user(1L);

        StoreEmployee a = storeEmployee(employee);
        StoreEmployee b = storeEmployee(otherEmployee);
        when(storeEmployeeRepository.findByEmployeeId(2L)).thenReturn(Optional.of(a));
        when(storeEmployeeRepository.findByEmployeeId(1L)).thenReturn(Optional.empty());
        when(storeEmployeeRepository.findDistinctByStoresIdInOrderByIdAscFetchEmployee(anyList())).thenReturn(List.of(a, b));

        StoreOwner storeOwner = new StoreOwner();
        storeOwner.setStore(store);
        storeOwner.setOwner(owner);
        when(storeOwnerRepository.findByOwnerIdAndActiveTrue(2L)).thenReturn(Optional.empty());
        when(storeOwnerRepository.findByOwnerIdAndActiveTrue(1L)).thenReturn(Optional.of(storeOwner));
        when(storeOwnerRepository.findByStoreIdAndActiveTrue(STORE_ID)).thenReturn(Optional.of(storeOwner));
    }

    private static User user(Long id) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", id);
        u.setActive(true);
        return u;
    }

    private StoreEmployee storeEmployee(User u) {
        StoreEmployee se = new StoreEmployee();
        se.setEmployee(u);
        Set<Store> stores = new LinkedHashSet<>();
        stores.add(store);
        ReflectionTestUtils.setField(se, "stores", stores);
        return se;
    }

    private void oneItemPending() {
        when(stockCheckRepository.findMissedEndOfDay(STORE_ID, yesterday)).thenReturn(List.of(new StockCheck()));
    }

    @Test
    void firstLoadNotifiesEveryEmployeeAndTheOwnerOnce() {
        oneItemPending();

        service.ensureNoticesFor(2L);

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository, times(3)).save(captor.capture());
        assertThat(captor.getAllValues()).extracting(n -> n.getRecipientUser().getId()).containsExactlyInAnyOrder(1L, 2L, 3L);
        Notification n = captor.getAllValues().get(0);
        assertThat(n.getCategory()).isEqualTo("MISSED_END_OF_DAY");
        assertThat(n.getMissedEodDate()).isEqualTo(yesterday);
        assertThat(n.getStore()).isEqualTo(store);
        assertThat(n.getLinkPath()).isEqualTo("/notifications");
        assertThat(n.getDedupKey()).isEqualTo("MISSED_EOD:" + STORE_ID + ":" + yesterday);
    }

    @Test
    void theOwnersOwnLoadAlsoRaisesTheNotice() {
        oneItemPending();

        service.ensureNoticesFor(1L);

        verify(notificationRepository, times(3)).save(any(Notification.class));
    }

    @Test
    void nothingIsCreatedWhenNoItemIsPending() {
        when(stockCheckRepository.findMissedEndOfDay(STORE_ID, yesterday)).thenReturn(List.of());

        service.ensureNoticesFor(2L);

        verify(notificationRepository, never()).save(any(Notification.class));
    }

    @Test
    void someoneWhoAlreadyHasTheNoticeIsSkipped() {
        oneItemPending();
        when(notificationRepository.existsByRecipientUserIdAndDedupKey(eq(3L), anyString())).thenReturn(true);

        service.ensureNoticesFor(2L);

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository, times(2)).save(captor.capture());
        assertThat(captor.getAllValues()).extracting(n -> n.getRecipientUser().getId()).containsExactlyInAnyOrder(1L, 2L);
    }

    @Test
    void repeatLoadsTheSameDayDoNotQueryAgain() {
        oneItemPending();

        service.ensureNoticesFor(2L);
        service.ensureNoticesFor(2L);
        service.ensureNoticesFor(2L);

        verify(stockCheckRepository, times(1)).findMissedEndOfDay(anyLong(), any());
    }

    @Test
    void aDeactivatedEmployeeIsNotNotified() {
        oneItemPending();
        otherEmployee.setActive(false);

        service.ensureNoticesFor(2L);

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository, times(2)).save(captor.capture());
        assertThat(captor.getAllValues()).extracting(n -> n.getRecipientUser().getId()).doesNotContain(3L);
    }
}
