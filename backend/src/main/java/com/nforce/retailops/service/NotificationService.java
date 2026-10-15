package com.nforce.retailops.service;

import com.nforce.retailops.dto.MissedEndOfDayResponse;
import com.nforce.retailops.dto.NotificationResponse;
import com.nforce.retailops.entity.AdminCorrection;
import com.nforce.retailops.entity.Notification;
import com.nforce.retailops.entity.OrderListEntry;
import com.nforce.retailops.entity.RaisedIssue;
import com.nforce.retailops.entity.StockCheckSnapshot;
import com.nforce.retailops.entity.StockReceiptRequest;
import com.nforce.retailops.entity.StockReceiptRequestType;
import com.nforce.retailops.entity.StockCheck;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.entity.TaskResponseEntry;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.NotificationNotFoundException;
import com.nforce.retailops.repository.NotificationRepository;
import com.nforce.retailops.repository.StockCheckRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class NotificationService {

    private static final int MAX_NOTIFICATIONS = 100;

    private static final Map<String, String> PRIORITY_BY_CATEGORY;
    static {
        PRIORITY_BY_CATEGORY = new HashMap<>();
        PRIORITY_BY_CATEGORY.put("ISSUE_RAISED",                  "HIGH");
        PRIORITY_BY_CATEGORY.put("ISSUE_RESOLVED",               "HIGH");
        PRIORITY_BY_CATEGORY.put("ISSUE_ACKNOWLEDGED",           "MEDIUM");
        PRIORITY_BY_CATEGORY.put("STORE_DEACTIVATED",             "HIGH");
        PRIORITY_BY_CATEGORY.put("ACCOUNT_DEACTIVATED",           "HIGH");
        PRIORITY_BY_CATEGORY.put("EMPLOYEE_ACCOUNT_DEACTIVATED",  "HIGH");
        PRIORITY_BY_CATEGORY.put("EMPLOYEE_REMOVED",              "HIGH");
        PRIORITY_BY_CATEGORY.put("CORRECTION_MADE",               "MEDIUM");
        PRIORITY_BY_CATEGORY.put("RESPONSE_NEEDS_ATTENTION",      "HIGH");
        PRIORITY_BY_CATEGORY.put("STORE_REACTIVATED",             "MEDIUM");
        PRIORITY_BY_CATEGORY.put("ACCOUNT_REACTIVATED",           "MEDIUM");
        PRIORITY_BY_CATEGORY.put("EMPLOYEE_ACCOUNT_REACTIVATED",  "MEDIUM");
        PRIORITY_BY_CATEGORY.put("TASK_ADDED",                    "LOW");
        PRIORITY_BY_CATEGORY.put("TASK_MAKEUP_FULFILLED",         "LOW");
        PRIORITY_BY_CATEGORY.put("CATEGORY_ADDED",                "LOW");
        PRIORITY_BY_CATEGORY.put("STOCK_ITEM_ADDED",              "MEDIUM");
        PRIORITY_BY_CATEGORY.put("STOCK_ITEM_REACTIVATED",        "MEDIUM");
        PRIORITY_BY_CATEGORY.put("EMPLOYEE_ASSIGNED",             "LOW");
        PRIORITY_BY_CATEGORY.put("NEW_EMPLOYEE_JOINED",           "LOW");
        // Super Admin categories
        PRIORITY_BY_CATEGORY.put("STORE_ZERO_ACTIVITY",           "HIGH");
        PRIORITY_BY_CATEGORY.put("OWNER_EMAIL_FAILED",            "HIGH");
        PRIORITY_BY_CATEGORY.put("ISSUES_OVERDUE",                "MEDIUM");
        PRIORITY_BY_CATEGORY.put("ISSUE_NUDGE",                   "HIGH");
        PRIORITY_BY_CATEGORY.put("STORE_OWNER_VACANT",            "HIGH");
        PRIORITY_BY_CATEGORY.put("STOCK_CHECK_CORRECTED",         "MEDIUM");
        PRIORITY_BY_CATEGORY.put("STOCK_RECEIPT_REQUEST",         "HIGH");
        PRIORITY_BY_CATEGORY.put("STOCK_RECEIPT_APPROVED",        "MEDIUM");
        PRIORITY_BY_CATEGORY.put("STOCK_RECEIPT_REJECTED",        "HIGH");
        PRIORITY_BY_CATEGORY.put("MISSED_END_OF_DAY",             "HIGH");
        PRIORITY_BY_CATEGORY.put("STOCK_OUT_URGENT",              "HIGH");
    }

    private final NotificationRepository notificationRepository;
    private final StockCheckRepository stockCheckRepository;

    public NotificationService(NotificationRepository notificationRepository, StockCheckRepository stockCheckRepository) {
        this.notificationRepository = notificationRepository;
        this.stockCheckRepository = stockCheckRepository;
    }

    // A missed End of Day notice carries its items, looked up live so a row
    // answered by someone else already shows as answered.
    private NotificationResponse toResponse(Notification n) {
        if (n.getMissedEodDate() == null || n.getStore() == null) {
            return NotificationResponse.from(n);
        }
        return NotificationResponse.from(n, MissedEndOfDayResponse.of(
            n.getMissedEodDate(), stockCheckRepository.findForStoreOnDate(n.getStore().getId(), n.getMissedEodDate())));
    }

    // MAX_NOTIFICATIONS is a per-page cap (abuse guard), not an absolute limit --
    // callers page through with page/size to reach older notifications.
    private static PageRequest pageRequest(int page, int size) {
        int clampedPage = Math.max(page, 0);
        int clampedSize = Math.min(Math.max(size, 1), MAX_NOTIFICATIONS);
        return PageRequest.of(clampedPage, clampedSize);
    }

    // Generic notification creation — the single entry point for all new notification types.
    // Priority is resolved automatically from the category; callers do not need to set it.
    @Transactional
    public void send(User recipient, String category, String title, String message, String linkPath) {
        send(recipient, category, title, message, linkPath, null);
    }

    @Transactional
    public void sendForStore(User recipient, String category, String title, String message, String linkPath, Store store) {
        Notification n = new Notification();
        n.setRecipientUser(recipient);
        n.setCategory(category);
        n.setTitle(title);
        n.setMessage(message);
        n.setLinkPath(linkPath);
        n.setStore(store);
        n.setPriority(PRIORITY_BY_CATEGORY.getOrDefault(category, "MEDIUM"));
        notificationRepository.save(n);
    }

    // Issue-related form: relatedIssue lets the frontend deep-link straight to
    // the issue, and cascades the notification away if the issue is purged.
    @Transactional
    public void send(User recipient, String category, String title, String message, String linkPath, RaisedIssue relatedIssue) {
        Notification n = new Notification();
        n.setRecipientUser(recipient);
        n.setCategory(category);
        n.setTitle(title);
        n.setMessage(message);
        n.setLinkPath(linkPath);
        n.setRelatedIssue(relatedIssue);
        if (relatedIssue != null) {
            n.setStore(relatedIssue.getStore());
        }
        n.setPriority(PRIORITY_BY_CATEGORY.getOrDefault(category, "MEDIUM"));
        notificationRepository.save(n);
    }

    // Super Admin targeted notification — separate from user notifications because
    // Super Admins have their own identity table and are not in the users table.
    @Transactional
    public void sendToSuperAdmin(SuperAdmin recipient, String category, String title, String message, String linkPath, String dedupKey) {
        sendToSuperAdmin(recipient, category, title, message, linkPath, dedupKey, null);
    }

    // Store-scoped form — lets a '/checklist' notification deep-link straight into
    // that store instead of leaving the Super Admin to pick one from a dropdown.
    @Transactional
    public void sendToSuperAdmin(SuperAdmin recipient, String category, String title, String message, String linkPath, String dedupKey, Store store) {
        Notification n = new Notification();
        n.setRecipientSuperAdmin(recipient);
        n.setCategory(category);
        n.setTitle(title);
        n.setMessage(message);
        n.setLinkPath(linkPath);
        n.setDedupKey(dedupKey);
        n.setStore(store);
        n.setPriority(PRIORITY_BY_CATEGORY.getOrDefault(category, "MEDIUM"));
        notificationRepository.save(n);
    }

    @Transactional(readOnly = true)
    public boolean superAdminNotificationExists(Long superAdminId, String dedupKey) {
        return notificationRepository.existsByRecipientSuperAdminIdAndDedupKey(superAdminId, dedupKey);
    }

    // ISSUE_RAISED kept separate: sets the relatedIssue FK used by the detail
    // panel in the Notifications page. All other categories go through send().
    @Transactional
    public void createForIssue(RaisedIssue issue, User owner) {
        String employeeName = issue.getEmployeeUser().getFullName();
        String storeName = issue.getStore().getName();
        String notePreview = issue.getNote().length() > 80
            ? issue.getNote().substring(0, 80) + "…"
            : issue.getNote();

        Notification n = new Notification();
        n.setRecipientUser(owner);
        n.setCategory("ISSUE_RAISED");
        n.setPriority("HIGH");
        n.setTitle(employeeName + " raised an issue at " + storeName);
        n.setMessage(notePreview);
        n.setRelatedIssue(issue);
        n.setStore(issue.getStore());
        n.setLinkPath("/issues");
        notificationRepository.save(n);
    }

    // Notifies the employee who raised the issue when the admin acknowledges or resolves it.
    // Scoped to the single reporter — never fan-out to all store employees.
    @Transactional
    public void createForIssueUpdate(RaisedIssue issue, String newStatus) {
        User employee = issue.getEmployeeUser();
        String storeName = issue.getStore().getName();
        String notePreview = issue.getNote().length() > 60
            ? issue.getNote().substring(0, 60) + "…"
            : issue.getNote();

        String responseText = issue.getResponseText();
        boolean hasResponse = responseText != null && !responseText.isBlank();

        if ("ACKNOWLEDGED".equals(newStatus)) {
            send(employee, "ISSUE_ACKNOWLEDGED",
                "Your issue at " + storeName + " was acknowledged",
                hasResponse
                    ? "Response: " + responseText
                    : "The admin has seen your issue: \"" + notePreview + "\"",
                "/issues", issue);
        } else if ("RESOLVED".equals(newStatus)) {
            send(employee, "ISSUE_RESOLVED",
                "Your issue at " + storeName + " has been resolved",
                hasResponse
                    ? "Response: " + responseText
                    : "The admin has resolved your issue: \"" + notePreview + "\"",
                "/issues", issue);
        }
    }

    // Tells the store owner a Super Admin acted on one of their store's issues,
    // so the owner's own Issues view isn't silently changed under them.
    @Transactional
    public void notifyOwnerOfSuperAdminIssueUpdate(RaisedIssue issue, User owner, String newStatus) {
        String storeName = issue.getStore().getName();
        String notePreview = issue.getNote().length() > 80
            ? issue.getNote().substring(0, 80) + "…"
            : issue.getNote();
        boolean resolved = "RESOLVED".equals(newStatus);
        send(owner, resolved ? "ISSUE_RESOLVED" : "ISSUE_ACKNOWLEDGED",
            "A Super Admin " + (resolved ? "resolved" : "acknowledged") + " an issue at " + storeName,
            "\"" + notePreview + "\"",
            "/issues", issue);
    }

    // Tells the store owner a Super Admin corrected one of their store's
    // historical stock-check entries (RTS-306), mirroring
    // notifyOwnerOfSuperAdminIssueUpdate above -- same reason this exists:
    // the owner's own Stock Check History view changed under them.
    @Transactional
    public void notifyOwnerOfSuperAdminStockCheckCorrection(StockCheck check, User owner) {
        send(owner, "STOCK_CHECK_CORRECTED",
            "A Super Admin corrected a stock count at " + check.getStore().getName(),
            check.getStoreInventoryItem().getName() + " on " + check.getCheckDate(),
            "/inventory");
    }

    // An employee reported a mid-day shortage (RTS-368). Sent whether or not
    // the order list changed, so the admin always hears about it; the message
    // says if existing orders already cover the requirement.
    @Transactional
    public void notifyOwnerOfReportedShortage(StoreInventoryItem storeItem, User employee, BigDecimal currentStock,
                                              BigDecimal required, boolean addedToOrderList, String note, User owner) {
        String store = storeItem.getStore().getName();
        String item = storeItem.getName();
        String unit = storeItem.getUnitOfMeasurement();
        StringBuilder message = new StringBuilder(employee.getFullName())
            .append(" reported ").append(item).append(" running low: ")
            .append(currentStock.stripTrailingZeros().toPlainString()).append(' ').append(unit).append(" left. ");
        if (addedToOrderList) {
            message.append("Added to the order list to reach today's minimum.");
        } else {
            message.append("Existing orders already cover today's minimum.");
        }
        if (note != null && !note.isBlank()) {
            message.append(" Note: ").append(note.trim());
        }
        send(owner, "STOCK_SHORTAGE_REPORTED", "Shortage reported at " + store, message.toString(), "/orders");
    }

    // An item is completely out of stock (counted zero at Start of Day, or
    // reported as zero mid-day): the admin needs to order it straight away.
    @Transactional
    public void notifyOwnerOfStockOut(StoreInventoryItem storeItem, User employee, String source, User owner) {
        String store = storeItem.getStore().getName();
        String item = storeItem.getName();
        String message = "There is no stock of " + item + " in the store"
            + (employee != null ? " (" + source + " count by " + employee.getFullName() + ")" : "")
            + ". It needs urgent ordering.";
        send(owner, "STOCK_OUT_URGENT", "Out of stock: " + item + " at " + store, message, "/orders");
    }

    // An employee reported received stock at End of Day: asks the admin to
    // approve it. linkPath "/notifications" opens the All Notifications page,
    // where the request itself is shown with Approve / Reject.
    @Transactional
    public void notifyOwnerOfStockReceiptRequest(StockReceiptRequest request, User owner) {
        String employee = request.getRequestedBy().getFullName();
        String store = request.getStore().getName();
        String item = request.getStoreInventoryItem().getName();
        String unit = request.getStoreInventoryItem().getUnitOfMeasurement();
        OrderListEntry order = request.getOrderListEntry();

        Notification n = new Notification();
        n.setRecipientUser(owner);
        n.setCategory("STOCK_RECEIPT_REQUEST");
        n.setPriority("HIGH");
        String countName = request.getSnapshot() == StockCheckSnapshot.START_OF_DAY ? "Start of Day" : "End of Day";
        if (request.getType() == StockReceiptRequestType.LOWER_COUNT) {
            n.setTitle(employee + " submitted a lower Start of Day count at " + store);
            n.setMessage(employee + " counted " + item + " " + request.getQuantity() + " " + unit
                + " below the last End of Day. Reason: " + request.getReason()
                + ". Approve to accept the count, or reject to ask for a recount.");
        } else if (order == null) {
            n.setTitle(employee + " reported received stock at " + store);
            n.setMessage(employee + " reported receiving " + request.getQuantity() + " " + unit + " of " + item
                + " that is not on an existing order with the " + countName
                + " count, and is requesting approval for the received quantity.");
        } else {
            n.setTitle(employee + " is requesting approval to confirm an order as received at " + store);
            n.setMessage(employee + " is requesting approval to confirm Order #" + order.getId() + " for " + item
                + " (" + order.totalQuantityOrdered() + " " + unit + " ordered) as received: "
                + request.getQuantity() + " " + unit + " reported.");
        }
        n.setLinkPath("/notifications");
        n.setStockReceiptRequest(request);
        notificationRepository.save(n);
    }

    // Tells the employee how the admin decided.
    @Transactional
    public void notifyEmployeeOfStockReceiptDecision(StockReceiptRequest request, boolean approved) {
        String item = request.getStoreInventoryItem().getName();
        String unit = request.getStoreInventoryItem().getUnitOfMeasurement();
        String countName = request.getSnapshot() == StockCheckSnapshot.START_OF_DAY ? "Start of Day" : "End of Day";
        if (request.getType() == StockReceiptRequestType.LOWER_COUNT) {
            if (approved) {
                send(request.getRequestedBy(), "STOCK_RECEIPT_APPROVED", "Lower Start of Day approved",
                    "Your lower Start of Day count for " + item + " was approved.", "/stock-check");
            } else {
                send(request.getRequestedBy(), "STOCK_RECEIPT_REJECTED", "Lower Start of Day rejected",
                    "Your lower Start of Day count for " + item + " was rejected. Please recount and save "
                        + "the Start of Day count again.", "/stock-check");
            }
            return;
        }
        String subject = request.getOrderListEntry() == null
            ? request.getQuantity() + " " + unit + " of " + item
            : "Order #" + request.getOrderListEntry().getId() + " for " + item;
        if (approved) {
            send(request.getRequestedBy(), "STOCK_RECEIPT_APPROVED",
                "Received stock approved",
                "Your report of received stock was approved: " + subject + ". Stock has been updated.",
                "/stock-check");
        } else {
            send(request.getRequestedBy(), "STOCK_RECEIPT_REJECTED",
                "Received stock rejected",
                "Your report of received stock was rejected: " + subject
                    + ". Stock was not changed. Please review your " + countName + " count for " + item + ".",
                "/stock-check");
        }
    }

    @Transactional
    public void nudgeOwnerForIssue(RaisedIssue issue, User owner) {
        String storeName = issue.getStore().getName();
        String notePreview = issue.getNote().length() > 80
            ? issue.getNote().substring(0, 80) + "…"
            : issue.getNote();
        send(owner, "ISSUE_NUDGE",
            "Action required: unresolved issue at " + storeName,
            "A Super Admin is requesting you resolve this issue: \"" + notePreview + "\"",
            "/issues", issue);
    }

    @Transactional(readOnly = true)
    public boolean issueNudgedSince(Long issueId, OffsetDateTime since) {
        return notificationRepository.existsByRelatedIssueIdAndCategoryAndCreatedAtAfter(issueId, "ISSUE_NUDGE", since);
    }

    // Deep-links the employee straight to the flagged/corrected task: '/checklist'
    // (Today's Tasks) when the response's own date is today, '/audit' (History)
    // for a past date -- with the task id and date encoded as a query string, no
    // schema change needed since linkPath is already a free-text column. See
    // EMPLOYEE_NOTIFICATION_ROUTES/handleNotificationNavigate on the frontend.
    private static String employeeTaskLinkPath(TaskResponseEntry entry) {
        boolean isToday = entry.getResponseDate().equals(LocalDate.now());
        String base = isToday ? "/checklist" : "/audit";
        return base + "?taskId=" + entry.getTask().getId() + "&date=" + entry.getResponseDate();
    }

    @Transactional
    public void createForFlag(AdminCorrection correction) {
        TaskResponseEntry entry = correction.getTaskResponse();
        User employee = entry.getEmployee();
        String taskName = entry.getTask().getName();
        String reason = correction.getReason();
        send(employee, "RESPONSE_NEEDS_ATTENTION",
            "Your \"" + taskName + "\" response needs correction",
            reason != null && !reason.isBlank()
                ? "Admin feedback: " + reason
                : "The store admin has flagged your response for correction.",
            employeeTaskLinkPath(entry));
    }

    @Transactional
    public void createForCorrection(AdminCorrection correction) {
        TaskResponseEntry entry = correction.getTaskResponse();
        User employee = entry.getEmployee();
        String taskName = entry.getTask().getName();
        String reason = correction.getReason();
        send(employee, "CORRECTION_MADE",
            "Your \"" + taskName + "\" response was corrected",
            reason != null && !reason.isBlank()
                ? "Reason: " + reason
                : "Your response was reviewed and corrected by the store admin.",
            employeeTaskLinkPath(entry));
    }

    @Transactional
    public void createForStoreStatus(Store store, User owner, boolean active) {
        send(owner,
            active ? "STORE_REACTIVATED" : "STORE_DEACTIVATED",
            store.getName() + (active ? " has been reactivated" : " has been deactivated"),
            active
                ? "Your store has been reactivated by a Super Admin. You can now access it."
                : "Your store has been deactivated by a Super Admin.",
            active ? "/home" : null);
    }

    @Transactional
    public void createForAccountStatus(User owner, boolean active) {
        send(owner,
            active ? "ACCOUNT_REACTIVATED" : "ACCOUNT_DEACTIVATED",
            active ? "Your account has been reactivated" : "Your account has been deactivated",
            active
                ? "Your NForce account has been reactivated by a Super Admin."
                : "Your NForce account has been deactivated by a Super Admin.",
            active ? "/profile" : null);
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> list(Long userId, int page, int size) {
        return notificationRepository
            .findByRecipientUserIdOrderByCreatedAtDesc(userId, pageRequest(page, size))
            .stream()
            .map(this::toResponse)
            .toList();
    }

    @Transactional(readOnly = true)
    public Map<String, Long> unreadCount(Long userId) {
        return Map.of("count", notificationRepository.countByRecipientUserIdAndReadFalse(userId));
    }

    @Transactional
    public NotificationResponse markRead(Long notificationId, Long userId) {
        Notification n = notificationRepository.findByIdAndRecipientUserId(notificationId, userId)
            .orElseThrow(() -> new NotificationNotFoundException("Notification not found"));
        n.setRead(true);
        return toResponse(notificationRepository.save(n));
    }

    @Transactional
    public void markAllRead(Long userId) {
        notificationRepository.markAllReadByRecipientUserId(userId);
    }

    @Transactional
    public void delete(Long notificationId, Long userId) {
        Notification n = notificationRepository.findByIdAndRecipientUserId(notificationId, userId)
            .orElseThrow(() -> new NotificationNotFoundException("Notification not found"));
        notificationRepository.delete(n);
    }

    // Super Admin variants of the same read/list operations
    @Transactional(readOnly = true)
    public List<NotificationResponse> listForSuperAdmin(Long superAdminId, int page, int size) {
        return notificationRepository
            .findByRecipientSuperAdminIdOrderByCreatedAtDesc(superAdminId, pageRequest(page, size))
            .stream()
            .map(NotificationResponse::from)
            .toList();
    }

    @Transactional(readOnly = true)
    public Map<String, Long> unreadCountForSuperAdmin(Long superAdminId) {
        return Map.of("count", notificationRepository.countByRecipientSuperAdminIdAndReadFalse(superAdminId));
    }

    @Transactional
    public NotificationResponse markReadForSuperAdmin(Long notificationId, Long superAdminId) {
        Notification n = notificationRepository.findByIdAndRecipientSuperAdminId(notificationId, superAdminId)
            .orElseThrow(() -> new NotificationNotFoundException("Notification not found"));
        n.setRead(true);
        return NotificationResponse.from(notificationRepository.save(n));
    }

    @Transactional
    public void markAllReadForSuperAdmin(Long superAdminId) {
        notificationRepository.markAllReadByRecipientSuperAdminId(superAdminId);
    }

    @Transactional
    public void deleteForSuperAdmin(Long notificationId, Long superAdminId) {
        Notification n = notificationRepository.findByIdAndRecipientSuperAdminId(notificationId, superAdminId)
            .orElseThrow(() -> new NotificationNotFoundException("Notification not found"));
        notificationRepository.delete(n);
    }
}
