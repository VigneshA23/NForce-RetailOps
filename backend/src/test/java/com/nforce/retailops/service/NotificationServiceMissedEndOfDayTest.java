package com.nforce.retailops.service;

import com.nforce.retailops.dto.MissedEndOfDayResponse;
import com.nforce.retailops.dto.NotificationResponse;
import com.nforce.retailops.dto.StockCheckResponse;
import com.nforce.retailops.entity.InventoryItemImage;
import com.nforce.retailops.entity.Notification;
import com.nforce.retailops.entity.StockCheck;
import com.nforce.retailops.entity.StockCheckSnapshot;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.NotificationRepository;
import com.nforce.retailops.repository.StockCheckRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

// The "End of Day missing" notice lists its items live, and a day explained as
// not countable surfaces its reason wherever the stock check is shown.
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class NotificationServiceMissedEndOfDayTest {

    private static final Long STORE_ID = 10L;
    private final LocalDate yesterday = LocalDate.now().minusDays(1);

    @Mock private NotificationRepository notificationRepository;
    @Mock private StockCheckRepository stockCheckRepository;

    @InjectMocks
    private NotificationService notificationService;

    private Store store;
    private User sarah;

    @BeforeEach
    void setUp() {
        store = new Store();
        ReflectionTestUtils.setField(store, "id", STORE_ID);
        sarah = new User();
        ReflectionTestUtils.setField(sarah, "id", 2L);
        sarah.setFullName("Sarah");
    }

    private StockCheck row(long itemId, String name, int sodAvailable) {
        StoreInventoryItem item = new StoreInventoryItem();
        ReflectionTestUtils.setField(item, "id", itemId);
        item.setStore(store);
        item.setName(name);
        item.setUnitOfMeasurement("g");
        item.setActive(true);
        InventoryItemImage image = new InventoryItemImage();
        ReflectionTestUtils.setField(image, "id", itemId * 100);
        item.setImage(image);
        StockCheck check = new StockCheck();
        check.setStore(store);
        check.setStoreInventoryItem(item);
        check.setCheckDate(yesterday);
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, BigDecimal.valueOf(sodAvailable), BigDecimal.ZERO,
            sarah, OffsetDateTime.now().minusDays(1), false);
        return check;
    }

    private Notification notice() {
        Notification n = new Notification();
        n.setCategory("MISSED_END_OF_DAY");
        n.setTitle("End of Day missing");
        n.setMessage("x");
        n.setStore(store);
        n.setMissedEodDate(yesterday);
        return n;
    }

    @Test
    void theNoticeCarriesItsItemsWithTheirCurrentState() {
        StockCheck butter = row(1, "Butter", 300);
        StockCheck milk = row(2, "Milk", 8);
        milk.recordSnapshot(StockCheckSnapshot.END_OF_DAY, BigDecimal.valueOf(3), BigDecimal.ZERO, sarah, OffsetDateTime.now(), false);
        StockCheck cashew = row(3, "Cashew", 5);
        cashew.skipEndOfDay("the supplier delivery blocked the stockroom so nothing could be reached or counted today", sarah, OffsetDateTime.now());
        when(stockCheckRepository.findForStoreOnDate(STORE_ID, yesterday)).thenReturn(List.of(milk, butter, cashew));
        when(notificationRepository.findByRecipientUserIdOrderByCreatedAtDesc(any(), any(Pageable.class))).thenReturn(List.of(notice()));

        List<NotificationResponse> list = notificationService.list(2L, 0, 10);

        MissedEndOfDayResponse missed = list.get(0).missedEod();
        assertThat(missed.date()).isEqualTo(yesterday);
        assertThat(missed.items()).extracting(MissedEndOfDayResponse.Item::itemName).containsExactly("Butter", "Cashew", "Milk");
        assertThat(missed.items()).extracting(MissedEndOfDayResponse.Item::status)
            .containsExactly(MissedEndOfDayResponse.PENDING, MissedEndOfDayResponse.COULD_NOT_COUNT, MissedEndOfDayResponse.COUNTED);
        MissedEndOfDayResponse.Item skipped = missed.items().get(1);
        assertThat(skipped.reason()).contains("stockroom");
        assertThat(skipped.answeredByName()).isEqualTo("Sarah");
        MissedEndOfDayResponse.Item counted = missed.items().get(2);
        assertThat(counted.endOfDayAvailable()).isEqualByComparingTo("3");
        assertThat(counted.answeredByName()).isEqualTo("Sarah");
        // Butter is item 1, so its display image is id 100 (see row()).
        MissedEndOfDayResponse.Item pending = missed.items().get(0);
        assertThat(pending.imageId()).isEqualTo(100L);
    }

    @Test
    void anOrdinaryNotificationHasNoMissedEndOfDay() {
        Notification plain = new Notification();
        plain.setCategory("TASK_ADDED");
        plain.setTitle("t");
        plain.setMessage("m");
        when(notificationRepository.findByRecipientUserIdOrderByCreatedAtDesc(any(), any(Pageable.class))).thenReturn(List.of(plain));

        assertThat(notificationService.list(2L, 0, 10).get(0).missedEod()).isNull();
    }

    @Test
    void anInactiveItemIsLeftOutOfTheNotice() {
        StockCheck butter = row(1, "Butter", 300);
        butter.getStoreInventoryItem().setActive(false);
        when(stockCheckRepository.findForStoreOnDate(STORE_ID, yesterday)).thenReturn(List.of(butter));
        when(notificationRepository.findByRecipientUserIdOrderByCreatedAtDesc(any(), any(Pageable.class))).thenReturn(List.of(notice()));

        assertThat(notificationService.list(2L, 0, 10).get(0).missedEod().items()).isEmpty();
    }

    @Test
    void aStockCheckResponseExposesTheReasonThatEndOfDayWasNotCounted() {
        StockCheck check = row(1, "Butter", 300);
        assertThat(StockCheckResponse.from(check).endOfDaySkipped()).isNull();

        check.skipEndOfDay("the freezer failed overnight and every tub had already melted so nothing could be counted", sarah, OffsetDateTime.now());

        StockCheckResponse response = StockCheckResponse.from(check);
        assertThat(response.endOfDay()).isNull();
        assertThat(response.endOfDaySkipped().reason()).contains("freezer failed");
        assertThat(response.endOfDaySkipped().byName()).isEqualTo("Sarah");
    }
}
