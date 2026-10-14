package com.nforce.retailops.service;

import com.nforce.retailops.dto.StockReceiptRequestResponse;
import com.nforce.retailops.entity.StockReceiptRequest;
import com.nforce.retailops.entity.StockReceiptRequestStatus;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.StockReceiptRequestAlreadyDecidedException;
import com.nforce.retailops.exception.StockReceiptRequestNotFoundException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.StockReceiptRequestRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

// Owner/Admin's decision on an employee's received-stock request. Approving
// applies the delivery to stock (and, for an existing order, moves it Ordered
// -> Received); rejecting leaves everything as it was. Either way it is
// final, and the employee is told. A request outside the caller's own store
// is masked as 404, like the rest of the store-scoped endpoints.
@Service
public class StockReceiptApprovalService {

    private final StockReceiptRequestRepository requestRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final UserRepository userRepository;
    private final StockCheckService stockCheckService;
    private final OrderListService orderListService;
    private final NotificationService notificationService;

    public StockReceiptApprovalService(
        StockReceiptRequestRepository requestRepository,
        StoreOwnerRepository storeOwnerRepository,
        UserRepository userRepository,
        StockCheckService stockCheckService,
        OrderListService orderListService,
        NotificationService notificationService
    ) {
        this.requestRepository = requestRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.userRepository = userRepository;
        this.stockCheckService = stockCheckService;
        this.orderListService = orderListService;
        this.notificationService = notificationService;
    }

    @Transactional
    public StockReceiptRequestResponse approve(Long ownerId, Long requestId) {
        StockReceiptRequest request = requirePendingRequest(ownerId, requestId);
        if (request.getOrderListEntry() != null) {
            User owner = userRepository.getReferenceById(ownerId);
            orderListService.confirmReceivedByApproval(request.getOrderListEntry(), request.getQuantity(), owner.getFullName());
        }
        stockCheckService.applyApprovedDelivery(request);
        decide(request, StockReceiptRequestStatus.APPROVED, ownerId);
        notificationService.notifyEmployeeOfStockReceiptDecision(request, true);
        return StockReceiptRequestResponse.from(request);
    }

    @Transactional
    public StockReceiptRequestResponse reject(Long ownerId, Long requestId) {
        StockReceiptRequest request = requirePendingRequest(ownerId, requestId);
        decide(request, StockReceiptRequestStatus.REJECTED, ownerId);
        notificationService.notifyEmployeeOfStockReceiptDecision(request, false);
        return StockReceiptRequestResponse.from(request);
    }

    private StockReceiptRequest requirePendingRequest(Long ownerId, Long requestId) {
        Long storeId = storeOwnerRepository.findByOwnerId(ownerId).stream()
            .filter(StoreOwner::isActive)
            .findFirst()
            .orElseThrow(() -> new StoreNotFoundException("Store not found"))
            .getStore().getId();
        StockReceiptRequest request = requestRepository.findByIdAndStoreId(requestId, storeId)
            .orElseThrow(() -> new StockReceiptRequestNotFoundException("Request not found"));
        if (!request.isPending()) {
            throw new StockReceiptRequestAlreadyDecidedException(
                "This request was already " + request.getStatus().name().toLowerCase() + ".");
        }
        return request;
    }

    private void decide(StockReceiptRequest request, StockReceiptRequestStatus status, Long ownerId) {
        User owner = userRepository.getReferenceById(ownerId);
        request.setStatus(status);
        request.setDecidedBy(owner);
        request.setDecidedAt(OffsetDateTime.now());
        requestRepository.save(request);
    }
}
