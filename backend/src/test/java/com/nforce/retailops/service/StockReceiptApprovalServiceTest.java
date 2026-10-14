package com.nforce.retailops.service;

import static com.nforce.retailops.TestDecimals.bd;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.nforce.retailops.dto.StockReceiptRequestResponse;
import com.nforce.retailops.entity.OrderListEntry;
import com.nforce.retailops.entity.OrderStatus;
import com.nforce.retailops.entity.StockReceiptRequest;
import com.nforce.retailops.entity.StockReceiptRequestStatus;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.InvalidOrderEntryTransitionException;
import com.nforce.retailops.exception.StockReceiptRequestAlreadyDecidedException;
import com.nforce.retailops.exception.StockReceiptRequestNotFoundException;
import com.nforce.retailops.repository.StockReceiptRequestRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class StockReceiptApprovalServiceTest {

    private static final Long OWNER_ID = 1L;
    private static final Long STORE_ID = 10L;
    private static final Long REQUEST_ID = 5L;

    @Mock private StockReceiptRequestRepository requestRepository;
    @Mock private StoreOwnerRepository storeOwnerRepository;
    @Mock private UserRepository userRepository;
    @Mock private StockCheckService stockCheckService;
    @Mock private OrderListService orderListService;
    @Mock private NotificationService notificationService;

    @InjectMocks
    private StockReceiptApprovalService service;

    private StockReceiptRequest request;
    private OrderListEntry order;

    @BeforeEach
    void setUp() {
        Store store = new Store();
        ReflectionTestUtils.setField(store, "id", STORE_ID);
        store.setName("Main St");

        StoreOwner storeOwner = new StoreOwner();
        storeOwner.setStore(store);
        when(storeOwnerRepository.findByOwnerId(OWNER_ID)).thenReturn(List.of(storeOwner));

        User employee = new User();
        employee.setFullName("Sarah");
        User owner = new User();
        owner.setFullName("Olivia");
        when(userRepository.getReferenceById(OWNER_ID)).thenReturn(owner);

        StoreInventoryItem milk = new StoreInventoryItem();
        ReflectionTestUtils.setField(milk, "id", 20L);
        milk.setStore(store);
        milk.setName("Milk");
        milk.setUnitOfMeasurement("L");

        order = new OrderListEntry();
        ReflectionTestUtils.setField(order, "id", 77L);
        order.setStoreInventoryItem(milk);
        order.setStatus(OrderStatus.ORDERED);
        order.setQuantityNeeded(bd(12));

        request = new StockReceiptRequest();
        ReflectionTestUtils.setField(request, "id", REQUEST_ID);
        request.setStore(store);
        request.setStoreInventoryItem(milk);
        request.setCheckDate(LocalDate.now());
        request.setQuantity(bd(12));
        request.setRequestedBy(employee);

        when(requestRepository.findByIdAndStoreId(REQUEST_ID, STORE_ID)).thenReturn(Optional.of(request));
    }

    @Test
    void approvingNewStockAppliesTheDeliveryAndTouchesNoOrder() {
        StockReceiptRequestResponse response = service.approve(OWNER_ID, REQUEST_ID);

        verify(stockCheckService).applyApprovedDelivery(request);
        verify(orderListService, never()).confirmReceivedByApproval(any(), any());
        assertThat(request.getStatus()).isEqualTo(StockReceiptRequestStatus.APPROVED);
        assertThat(request.getDecidedAt()).isNotNull();
        assertThat(response.kind()).isEqualTo("NEW_STOCK");
        verify(notificationService).notifyEmployeeOfStockReceiptDecision(request, true);
    }

    @Test
    void approvingAnExistingOrderMarksItReceivedAndAppliesTheDelivery() {
        request.setOrderListEntry(order);

        StockReceiptRequestResponse response = service.approve(OWNER_ID, REQUEST_ID);

        verify(orderListService).confirmReceivedByApproval(order, bd(12));
        verify(stockCheckService).applyApprovedDelivery(request);
        assertThat(response.kind()).isEqualTo("EXISTING_ORDER");
        assertThat(response.orderId()).isEqualTo(77L);
    }

    @Test
    void approvalFailsAndChangesNothingWhenTheOrderIsNoLongerOrdered() {
        request.setOrderListEntry(order);
        org.mockito.Mockito.doThrow(new InvalidOrderEntryTransitionException("no longer Ordered"))
            .when(orderListService).confirmReceivedByApproval(any(), any());

        assertThatThrownBy(() -> service.approve(OWNER_ID, REQUEST_ID))
            .isInstanceOf(InvalidOrderEntryTransitionException.class);
        verify(stockCheckService, never()).applyApprovedDelivery(any());
        assertThat(request.isPending()).isTrue();
    }

    @Test
    void rejectingLeavesStockAndOrderAlone() {
        request.setOrderListEntry(order);

        service.reject(OWNER_ID, REQUEST_ID);

        verify(stockCheckService, never()).applyApprovedDelivery(any());
        verify(orderListService, never()).confirmReceivedByApproval(any(), any());
        assertThat(request.getStatus()).isEqualTo(StockReceiptRequestStatus.REJECTED);
        verify(notificationService).notifyEmployeeOfStockReceiptDecision(request, false);
    }

    @Test
    void aDecidedRequestCannotBeDecidedAgain() {
        request.setStatus(StockReceiptRequestStatus.APPROVED);

        assertThatThrownBy(() -> service.approve(OWNER_ID, REQUEST_ID))
            .isInstanceOf(StockReceiptRequestAlreadyDecidedException.class);
        assertThatThrownBy(() -> service.reject(OWNER_ID, REQUEST_ID))
            .isInstanceOf(StockReceiptRequestAlreadyDecidedException.class);
        verify(stockCheckService, never()).applyApprovedDelivery(any());
    }

    @Test
    void aRequestFromAnotherStoreIsReportedAsNotFound() {
        when(requestRepository.findByIdAndStoreId(99L, STORE_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.approve(OWNER_ID, 99L))
            .isInstanceOf(StockReceiptRequestNotFoundException.class);
    }
}
