package com.nforce.retailops.service;

import com.nforce.retailops.entity.Notification;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreEmployee;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.NotificationRepository;
import com.nforce.retailops.repository.StockCheckRepository;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

// Chases yesterday's missing End of Day counts. There is no job: the notice is
// raised the first time anyone from the store loads their notifications on a
// day (see NotificationController), one notification per recipient per store
// listing every item counted at Start of Day yesterday with no End of Day and
// no "could not count". Recipients are the store's employees and its active
// owner. Only yesterday is ever chased, so a day that was missed and not
// answered by the end of today simply stays "Not Counted".
@Service
public class MissedEndOfDayService {

    static final String CATEGORY = "MISSED_END_OF_DAY";
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("d MMM", Locale.ENGLISH);

    private final StockCheckRepository stockCheckRepository;
    private final NotificationRepository notificationRepository;
    private final StoreEmployeeRepository storeEmployeeRepository;
    private final StoreOwnerRepository storeOwnerRepository;

    // (user, store, day) combinations already handled, so the 60s notification
    // polling doesn't re-query. Losing it (restart, cold start) only costs one
    // extra, idempotent check.
    private final Set<String> handled = ConcurrentHashMap.newKeySet();
    private volatile LocalDate handledDay = LocalDate.MIN;

    public MissedEndOfDayService(
        StockCheckRepository stockCheckRepository,
        NotificationRepository notificationRepository,
        StoreEmployeeRepository storeEmployeeRepository,
        StoreOwnerRepository storeOwnerRepository
    ) {
        this.stockCheckRepository = stockCheckRepository;
        this.notificationRepository = notificationRepository;
        this.storeEmployeeRepository = storeEmployeeRepository;
        this.storeOwnerRepository = storeOwnerRepository;
    }

    // Called on the user's notification load. Covers every store they can open:
    // an employee's assigned stores, or an owner's active store.
    @Transactional
    public void ensureNoticesFor(Long userId) {
        LocalDate today = LocalDate.now();
        if (!today.equals(handledDay)) {
            synchronized (this) {
                if (!today.equals(handledDay)) {
                    handled.clear();
                    handledDay = today;
                }
            }
        }
        Map<Long, Store> stores = new LinkedHashMap<>();
        storeEmployeeRepository.findByEmployeeId(userId)
            .ifPresent(se -> se.getStores().forEach(s -> stores.put(s.getId(), s)));
        storeOwnerRepository.findByOwnerIdAndActiveTrue(userId)
            .ifPresent(so -> stores.put(so.getStore().getId(), so.getStore()));
        for (Store store : stores.values()) {
            if (handled.add(userId + ":" + store.getId())) {
                ensureNoticesForStore(store, today.minusDays(1));
            }
        }
    }

    // Creates the notice for every recipient of the store that doesn't have one
    // yet for that day. Nothing is created when nothing is pending.
    void ensureNoticesForStore(Store store, LocalDate date) {
        int pending = stockCheckRepository.findMissedEndOfDay(store.getId(), date).size();
        if (pending == 0) {
            return;
        }
        List<User> recipients = new ArrayList<>();
        storeEmployeeRepository.findDistinctByStoresIdInOrderByIdAscFetchEmployee(List.of(store.getId()))
            .stream().map(StoreEmployee::getEmployee).filter(User::isActive).forEach(recipients::add);
        storeOwnerRepository.findByStoreIdAndActiveTrue(store.getId())
            .map(StoreOwner::getOwner).filter(User::isActive).ifPresent(recipients::add);

        String dedupKey = "MISSED_EOD:" + store.getId() + ":" + date;
        for (User recipient : recipients) {
            if (notificationRepository.existsByRecipientUserIdAndDedupKey(recipient.getId(), dedupKey)) {
                continue;
            }
            Notification n = new Notification();
            n.setRecipientUser(recipient);
            n.setCategory(CATEGORY);
            n.setPriority("HIGH");
            n.setTitle("End of Day missing for " + date.format(DAY));
            n.setMessage(pending + (pending == 1 ? " item was" : " items were") + " counted at Start of Day on "
                + date.format(DAY) + " but never at End of Day at " + store.getName()
                + ". Enter the count, or explain why it could not be counted. Start of Day for these items"
                + " is blocked until then.");
            n.setLinkPath("/notifications");
            n.setStore(store);
            n.setDedupKey(dedupKey);
            n.setMissedEodDate(date);
            notificationRepository.save(n);
        }
    }
}
