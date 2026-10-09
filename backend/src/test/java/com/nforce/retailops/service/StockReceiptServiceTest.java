package com.nforce.retailops.service;

import static com.nforce.retailops.TestDecimals.bd;

import com.nforce.retailops.entity.StockCheck;
import com.nforce.retailops.entity.StockCheckCorrection;
import com.nforce.retailops.entity.StockCheckReceipt;
import com.nforce.retailops.entity.StockCheckSnapshot;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.StockCheckCorrectionRepository;
import com.nforce.retailops.repository.StockCheckReceiptRepository;
import com.nforce.retailops.repository.StockCheckRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class StockReceiptServiceTest {

    private static final Long ITEM_ID = 20L;

    @Mock private StockCheckRepository stockCheckRepository;
    @Mock private StockCheckCorrectionRepository stockCheckCorrectionRepository;
    @Mock private StockCheckReceiptRepository stockCheckReceiptRepository;

    @InjectMocks
    private StockReceiptService stockReceiptService;

    private StoreInventoryItem item(String min) {
        StoreInventoryItem item = new StoreInventoryItem();
        ReflectionTestUtils.setField(item, "id", ITEM_ID);
        item.setMinWeekday(bd(Integer.parseInt(min)));
        item.setMinWeekend(bd(Integer.parseInt(min)));
        return item;
    }

    private StockCheck check(StoreInventoryItem item, User user) {
        StockCheck check = new StockCheck();
        check.setStoreInventoryItem(item);
        check.setCheckDate(LocalDate.now());
        return check;
    }

    @Test
    void tracksTheDeliveryApartFromStartOfDayWhenEndOfDayIsNotTakenYet() {
        StoreInventoryItem item = item("10");
        User user = new User();
        StockCheck check = check(item, user);
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(8), bd(2), user, OffsetDateTime.now(), false);
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now())).thenReturn(Optional.of(check));
        when(stockCheckRepository.save(any(StockCheck.class))).thenAnswer(inv -> inv.getArgument(0));

        StockReceiptService.Result result = stockReceiptService.applyReceipt(item, bd(6), user, null);

        assertThat(check.getStartOfDayAvailable()).isEqualByComparingTo(bd(8));
        assertThat(check.getStartOfDayDeadStock()).isEqualByComparingTo(bd(2));
        assertThat(check.getQuantityReceived()).isEqualByComparingTo(bd(6));
        assertThat(result.stockUpdated()).isTrue();
        assertThat(result.currentStock()).isEqualByComparingTo(bd(12));
        assertThat(result.requiredToday()).isEqualByComparingTo(bd(10));
        assertThat(result.reorderQuantity()).isEqualByComparingTo(bd(0));
    }

    @Test
    void reportsTheRemainingShortfallWhenTheDeliveryIsNotEnough() {
        StoreInventoryItem item = item("10");
        User user = new User();
        StockCheck check = check(item, user);
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(2), bd(0), user, OffsetDateTime.now(), false);
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now())).thenReturn(Optional.of(check));
        when(stockCheckRepository.save(any(StockCheck.class))).thenAnswer(inv -> inv.getArgument(0));

        StockReceiptService.Result result = stockReceiptService.applyReceipt(item, bd(3), user, null);

        assertThat(result.currentStock()).isEqualByComparingTo(bd(5));
        assertThat(result.reorderQuantity()).isEqualByComparingTo(bd(5));
    }

    @Test
    void addsToEndOfDayWhenTakenAndRecomputesTomorrowsOrderQuantity() {
        StoreInventoryItem item = item("10");
        User user = new User();
        StockCheck check = check(item, user);
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(20), bd(0), user, OffsetDateTime.now(), false);
        check.recordSnapshot(StockCheckSnapshot.END_OF_DAY, bd(4), bd(0), user, OffsetDateTime.now(), false);
        check.setQuantityNeeded(bd(6));
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now())).thenReturn(Optional.of(check));
        when(stockCheckRepository.save(any(StockCheck.class))).thenAnswer(inv -> inv.getArgument(0));

        StockReceiptService.Result result = stockReceiptService.applyReceipt(item, bd(4), user, null);

        assertThat(check.getStartOfDayAvailable()).isEqualByComparingTo(bd(20));
        assertThat(check.getEndOfDayAvailable()).isEqualByComparingTo(bd(8));
        assertThat(check.getQuantityReceived()).isEqualByComparingTo(bd(4));
        assertThat(check.stockUsed()).isEqualByComparingTo(bd(16));
        assertThat(check.getQuantityNeeded()).isEqualByComparingTo(bd(2));
        assertThat(result.reorderQuantity()).isEqualByComparingTo(bd(2));
    }

    @Test
    void recordsAnEndOfDayCorrectionWithTheReceivedReason() {
        StoreInventoryItem item = item("10");
        User user = new User();
        StockCheck check = check(item, user);
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(8), bd(0), user, OffsetDateTime.now(), false);
        check.recordSnapshot(StockCheckSnapshot.END_OF_DAY, bd(3), bd(0), user, OffsetDateTime.now(), false);
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now())).thenReturn(Optional.of(check));
        when(stockCheckRepository.save(any(StockCheck.class))).thenAnswer(inv -> inv.getArgument(0));

        stockReceiptService.applyReceipt(item, bd(6), user, null);

        ArgumentCaptor<StockCheckCorrection> captor = ArgumentCaptor.forClass(StockCheckCorrection.class);
        verify(stockCheckCorrectionRepository).save(captor.capture());
        StockCheckCorrection correction = captor.getValue();
        assertThat(correction.getSnapshot()).isEqualTo(StockCheckSnapshot.END_OF_DAY);
        assertThat(correction.getOriginalCount()).isEqualByComparingTo(bd(3));
        assertThat(correction.getCorrectedCount()).isEqualByComparingTo(bd(9));
        assertThat(correction.getCorrectedByUser()).isSameAs(user);
        assertThat(correction.getReason()).isEqualTo(StockReceiptService.CORRECTION_REASON);
    }

    @Test
    void deliveryBeforeEndOfDayIsNotCountedAsNegativeUsage() {
        StoreInventoryItem item = item("10");
        User user = new User();
        StockCheck check = check(item, user);
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(5), bd(0), user, OffsetDateTime.now(), false);
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now())).thenReturn(Optional.of(check));
        when(stockCheckRepository.save(any(StockCheck.class))).thenAnswer(inv -> inv.getArgument(0));

        stockReceiptService.applyReceipt(item, bd(10), user, null);
        verify(stockCheckCorrectionRepository, never()).save(any());
        check.recordSnapshot(StockCheckSnapshot.END_OF_DAY, bd(12), bd(0), user, OffsetDateTime.now(), false);

        assertThat(check.stockUsed()).isEqualByComparingTo(bd(3));
        assertThat(check.getCurrentCount()).isEqualByComparingTo(bd(12));
    }

    @Test
    void changesNothingWhenThereIsNoStockCountForToday() {
        StoreInventoryItem item = item("10");
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now())).thenReturn(Optional.empty());

        StockReceiptService.Result result = stockReceiptService.applyReceipt(item, bd(6), new User(), null);

        assertThat(result.stockUpdated()).isFalse();
        assertThat(result.currentStock()).isNull();
        assertThat(result.requiredToday()).isEqualByComparingTo(bd(10));
        verify(stockCheckRepository, never()).save(any());
        verify(stockCheckCorrectionRepository, never()).save(any());
    }

    @Test
    void addsTheDeliveryOnTopOfTheLatestCountWhenThereIsNoRowForToday() {
        StoreInventoryItem item = item("10");
        User user = new User();
        StockCheck yesterday = check(item, user);
        yesterday.setCheckDate(LocalDate.now().minusDays(1));
        yesterday.recordSnapshot(StockCheckSnapshot.END_OF_DAY, bd(4), bd(0), user, OffsetDateTime.now(), false);
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now())).thenReturn(Optional.empty());
        when(stockCheckRepository.findRecentForItem(any(), any(Pageable.class))).thenReturn(List.of(yesterday));

        StockReceiptService.Result result = stockReceiptService.applyReceipt(item, bd(6), user, null);

        assertThat(result.stockUpdated()).isTrue();
        assertThat(result.currentStock()).isEqualByComparingTo(bd(10));
        assertThat(result.reorderQuantity()).isEqualByComparingTo(bd(0));
        ArgumentCaptor<StockCheckReceipt> captor = ArgumentCaptor.forClass(StockCheckReceipt.class);
        verify(stockCheckReceiptRepository).save(captor.capture());
        assertThat(captor.getValue().getStockCheck()).isNull();
        assertThat(captor.getValue().getQuantity()).isEqualByComparingTo(bd(6));
        assertThat(captor.getValue().getCountAfter()).isEqualByComparingTo(bd(10));
        verify(stockCheckRepository, never()).save(any());
    }

    @Test
    void recordsWhoReceivedTheDeliveryAgainstTodaysRow() {
        StoreInventoryItem item = item("10");
        User user = new User();
        StockCheck check = check(item, user);
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(8), bd(0), user, OffsetDateTime.now(), false);
        when(stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(ITEM_ID, LocalDate.now())).thenReturn(Optional.of(check));
        when(stockCheckRepository.save(any(StockCheck.class))).thenAnswer(inv -> inv.getArgument(0));

        stockReceiptService.applyReceipt(item, bd(6), user, null);

        ArgumentCaptor<StockCheckReceipt> captor = ArgumentCaptor.forClass(StockCheckReceipt.class);
        verify(stockCheckReceiptRepository).save(captor.capture());
        assertThat(captor.getValue().getStockCheck()).isSameAs(check);
        assertThat(captor.getValue().getCountAfter()).isEqualByComparingTo(bd(14));
        assertThat(captor.getValue().getReceivedByUser()).isSameAs(user);
    }

    @Test
    void changesNothingWhenThereIsNoActorToAttributeTheChangeTo() {
        StoreInventoryItem item = item("10");

        StockReceiptService.Result result = stockReceiptService.applyReceipt(item, bd(6), null, null);

        assertThat(result.stockUpdated()).isFalse();
        verify(stockCheckRepository, never()).save(any());
    }
}
