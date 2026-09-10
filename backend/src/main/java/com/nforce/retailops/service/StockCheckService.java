package com.nforce.retailops.service;

import com.nforce.retailops.dto.AdHocShortageRequest;
import com.nforce.retailops.dto.DailyStockCheckItemResponse;
import com.nforce.retailops.dto.StockCheckCorrectionRequest;
import com.nforce.retailops.dto.StockCheckResponse;
import com.nforce.retailops.dto.StockCheckSubmitRequest;
import com.nforce.retailops.entity.StockCheck;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.InventoryItemNotAssignedException;
import com.nforce.retailops.exception.StoreInventoryItemNotFoundException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.StockCheckRepository;
import com.nforce.retailops.repository.StoreInventoryItemRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

// Employee-facing daily stock check + ad-hoc shortage reporting, and
// Owner/Admin's after-the-fact correction of a past check. Store membership
// is enforced by the caller via UserProfileService.requireAssignedStore
// before any method here runs, the same convention TaskService/RaisedIssueService
// already use for /me endpoints.
@Service
public class StockCheckService {

    private final StoreInventoryItemRepository storeInventoryItemRepository;
    private final StockCheckRepository stockCheckRepository;
    private final UserRepository userRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final OrderListService orderListService;
    private final UserProfileService userProfileService;

    public StockCheckService(
        StoreInventoryItemRepository storeInventoryItemRepository,
        StockCheckRepository stockCheckRepository,
        UserRepository userRepository,
        StoreOwnerRepository storeOwnerRepository,
        OrderListService orderListService,
        UserProfileService userProfileService
    ) {
        this.storeInventoryItemRepository = storeInventoryItemRepository;
        this.stockCheckRepository = stockCheckRepository;
        this.userRepository = userRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.orderListService = orderListService;
        this.userProfileService = userProfileService;
    }

    private static boolean isWeekend(LocalDate date) {
        DayOfWeek day = date.getDayOfWeek();
        return day == DayOfWeek.SATURDAY || day == DayOfWeek.SUNDAY;
    }

    private static Integer resolveMinTarget(StoreInventoryItem item, LocalDate date) {
        if (isWeekend(date) && item.getMinWeekend() != null) {
            return item.getMinWeekend();
        }
        return item.getMinWeekday();
    }

    // ---- Employee: today's checklist --------------------------------------

    @Transactional(readOnly = true)
    public List<DailyStockCheckItemResponse> getTodayChecklist(Long employeeUserId, Long storeId) {
        userProfileService.requireAssignedStore(employeeUserId, storeId);
        LocalDate today = LocalDate.now();
        List<StoreInventoryItem> items = storeInventoryItemRepository.findByStoreIdAndActiveTrueOrderById(storeId);

        Map<Long, StockCheck> todaysChecksByItemId = stockCheckRepository
            .findByStoreInventoryItemIdInAndCheckDate(items.stream().map(StoreInventoryItem::getId).toList(), today)
            .stream()
            .collect(Collectors.toMap(sc -> sc.getStoreInventoryItem().getId(), sc -> sc));

        return items.stream()
            .map(item -> {
                StockCheck todaysCheck = todaysChecksByItemId.get(item.getId());
                return new DailyStockCheckItemResponse(
                    item.getId(),
                    item.getInventoryItem().getName(),
                    item.getInventoryItem().getCategory().getName(),
                    item.getInventoryItem().getUnitOfMeasurement(),
                    resolveMinTarget(item, today),
                    todaysCheck != null ? todaysCheck.getCurrentCount() : null,
                    todaysCheck != null ? todaysCheck.getQuantityNeeded() : null,
                    todaysCheck != null
                );
            })
            .toList();
    }

    // ---- Employee: submit a count -----------------------------------------

    @Transactional
    public StockCheckResponse submitCheck(Long employeeUserId, StockCheckSubmitRequest request) {
        userProfileService.requireAssignedStore(employeeUserId, request.storeId());

        StoreInventoryItem item = storeInventoryItemRepository.findById(request.storeInventoryItemId())
            .orElseThrow(() -> new StoreInventoryItemNotFoundException("Store inventory item not found"));

        if (!item.getStore().getId().equals(request.storeId())) {
            throw new StoreInventoryItemNotFoundException("Store inventory item not found");
        }

        if (!item.isActive()) {
            throw new InventoryItemNotAssignedException("This item is not currently active for your store");
        }

        User employee = userRepository.getReferenceById(employeeUserId);
        LocalDate today = LocalDate.now();
        Integer minTarget = resolveMinTarget(item, today);
        int quantityNeeded = minTarget == null ? 0 : Math.max(0, minTarget - request.currentCount());

        StockCheck check = stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(item.getId(), today)
            .orElseGet(() -> {
                StockCheck created = new StockCheck();
                created.setStoreInventoryItem(item);
                created.setCheckDate(today);
                return created;
            });
        check.setCheckedBy(employee);
        check.setCurrentCount(request.currentCount());
        check.setQuantityNeeded(quantityNeeded);
        check = stockCheckRepository.save(check);

        if (quantityNeeded > 0) {
            orderListService.upsertShortage(
                item.getStore(), item.getInventoryItem(), quantityNeeded,
                null, false, employee, item.getPreferredSupplier()
            );
        }

        return StockCheckResponse.from(check);
    }

    // ---- Employee: ad-hoc shortage report ----------------------------------

    @Transactional
    public void reportAdHocShortage(Long employeeUserId, Long storeId, AdHocShortageRequest request) {
        userProfileService.requireAssignedStore(employeeUserId, storeId);

        StoreInventoryItem storeItem = storeInventoryItemRepository.findById(request.storeInventoryItemId())
            .orElseThrow(() -> new StoreInventoryItemNotFoundException("Store inventory item not found"));

        if (!storeItem.getStore().getId().equals(storeId) || !storeItem.isActive()) {
            throw new InventoryItemNotAssignedException("This item is not assigned to your store");
        }

        User employee = userRepository.getReferenceById(employeeUserId);
        orderListService.upsertShortage(
            storeItem.getStore(), storeItem.getInventoryItem(), request.quantity(),
            request.note(), true, employee, storeItem.getPreferredSupplier()
        );
    }

    // ---- Owner/Admin: historical review + correction -----------------------

    @Transactional(readOnly = true)
    public List<StockCheckResponse> listHistoricalChecks(Long ownerId, LocalDate startDate, LocalDate endDate) {
        StoreOwner storeOwner = storeOwnerRepository.findByOwnerIdAndActiveTrue(ownerId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
        return stockCheckRepository.findForStoreInRange(storeOwner.getStore().getId(), startDate, endDate).stream()
            .map(StockCheckResponse::from)
            .toList();
    }

    @Transactional
    public StockCheckResponse correctCheck(Long ownerId, Long checkId, StockCheckCorrectionRequest request) {
        StoreOwner storeOwner = storeOwnerRepository.findByOwnerIdAndActiveTrue(ownerId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));

        StockCheck check = stockCheckRepository.findByIdAndStoreInventoryItemStoreId(checkId, storeOwner.getStore().getId())
            .orElseThrow(() -> new StoreInventoryItemNotFoundException("Stock check not found"));

        StoreInventoryItem item = check.getStoreInventoryItem();
        Integer minTarget = resolveMinTarget(item, check.getCheckDate());
        int quantityNeeded = minTarget == null ? 0 : Math.max(0, minTarget - request.currentCount());

        check.setCurrentCount(request.currentCount());
        check.setQuantityNeeded(quantityNeeded);
        check = stockCheckRepository.save(check);

        // Only propagate to the order list if this correction is for TODAY's
        // check and still shows a shortage -- correcting a stale historical
        // entry shouldn't resurrect or distort today's live order queue.
        if (quantityNeeded > 0 && check.getCheckDate().isEqual(LocalDate.now())) {
            orderListService.upsertShortage(
                item.getStore(), item.getInventoryItem(), quantityNeeded,
                null, false, check.getCheckedBy(), item.getPreferredSupplier()
            );
        }

        return StockCheckResponse.from(check);
    }
}
