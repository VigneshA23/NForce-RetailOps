package com.nforce.retailops.entity;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;

// One store item's stock record for one business day, holding two
// independent snapshots: Start of Day (opening) and End of Day (closing).
// Exactly one row per store + item + day (unique index, V76) -- saving a
// snapshot again updates it in place; the previous values go to
// stock_check_corrections. Each snapshot records who first entered it and
// who last saved it.
//
// currentCount / quantityNeeded / checkedBy predate the split (V48) and are
// kept in sync rather than dropped, since other branches share the dev DB:
// currentCount = usable stock of the latest snapshot (EOD when present),
// quantityNeeded = quantity to order (computed on EOD save, 0 before),
// checkedBy = whoever last saved either snapshot.
@Entity
@Table(
    name = "stock_checks",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_stock_checks_store_item_date",
        columnNames = {"store_id", "store_inventory_item_id", "check_date"}
    )
)
public class StockCheck {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_inventory_item_id", nullable = false)
    private StoreInventoryItem storeInventoryItem;

    @Column(name = "check_date", nullable = false)
    private LocalDate checkDate;

    // ---- Start of Day ----
    @Column(name = "start_of_day_available")
    private Integer startOfDayAvailable;

    @Column(name = "start_of_day_dead_stock")
    private Integer startOfDayDeadStock;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "start_of_day_entered_by")
    private User startOfDayEnteredBy;

    @Column(name = "start_of_day_entered_at")
    private OffsetDateTime startOfDayEnteredAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "start_of_day_checked_by")
    private User startOfDayCheckedBy;

    @Column(name = "start_of_day_checked_at")
    private OffsetDateTime startOfDayCheckedAt;

    // ---- End of Day ----
    @Column(name = "end_of_day_available")
    private Integer endOfDayAvailable;

    @Column(name = "end_of_day_dead_stock")
    private Integer endOfDayDeadStock;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "end_of_day_entered_by")
    private User endOfDayEnteredBy;

    @Column(name = "end_of_day_entered_at")
    private OffsetDateTime endOfDayEnteredAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "end_of_day_checked_by")
    private User endOfDayCheckedBy;

    @Column(name = "end_of_day_checked_at")
    private OffsetDateTime endOfDayCheckedAt;

    // The next day's minimum, persisted when EOD is saved so a past report
    // stays accurate even if the item's thresholds change later.
    @Column(name = "required_tomorrow")
    private Integer requiredTomorrow;

    // ---- Legacy-compatible derived columns (see class comment) ----
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "checked_by_user_id", nullable = false)
    private User checkedBy;

    @Column(name = "current_count", nullable = false)
    private int currentCount;

    @Column(name = "quantity_needed", nullable = false)
    private int quantityNeeded;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public StockCheck() {
    }

    @PrePersist
    protected void onCreate() {
        OffsetDateTime now = OffsetDateTime.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    // ---- Snapshot helpers ----

    public boolean hasSnapshot(StockCheckSnapshot snapshot) {
        return availableFor(snapshot) != null;
    }

    public Integer availableFor(StockCheckSnapshot snapshot) {
        return snapshot == StockCheckSnapshot.START_OF_DAY ? startOfDayAvailable : endOfDayAvailable;
    }

    public Integer deadStockFor(StockCheckSnapshot snapshot) {
        return snapshot == StockCheckSnapshot.START_OF_DAY ? startOfDayDeadStock : endOfDayDeadStock;
    }

    // Available minus dead stock; null when the snapshot hasn't been taken.
    public Integer usableFor(StockCheckSnapshot snapshot) {
        Integer available = availableFor(snapshot);
        if (available == null) {
            return null;
        }
        Integer dead = deadStockFor(snapshot);
        return available - (dead == null ? 0 : dead);
    }

    // Start usable minus end usable; null until both snapshots exist. Can be
    // negative when a delivery arrived during the day.
    public Integer stockUsed() {
        Integer start = usableFor(StockCheckSnapshot.START_OF_DAY);
        Integer end = usableFor(StockCheckSnapshot.END_OF_DAY);
        return start == null || end == null ? null : start - end;
    }

    // Writes one snapshot's values and who/when, keeping the original enterer
    // on an edit. Also refreshes the legacy-compatible derived columns.
    //
    // isCorrection distinguishes an Owner/Admin correction from an employee's
    // own submission: a correction can fill in a snapshot that was never
    // recorded (e.g. backfilling a missed Start of Day), but it must never
    // claim "enteredBy" credit for doing so -- that stays reserved for
    // whoever's own submitCheck call is the genuine original entry, which may
    // happen AFTER a correction already put a value there. Gating on
    // enteredAt (rather than the available figure itself) is what makes that
    // possible: a correction leaves enteredAt untouched even when it's the
    // first non-null write, so a later genuine employee entry still gets
    // credited correctly.
    public void recordSnapshot(StockCheckSnapshot snapshot, int available, int deadStock, User by, OffsetDateTime at, boolean isCorrection) {
        if (snapshot == StockCheckSnapshot.START_OF_DAY) {
            if (startOfDayEnteredAt == null && !isCorrection) {
                startOfDayEnteredBy = by;
                startOfDayEnteredAt = at;
            }
            startOfDayAvailable = available;
            startOfDayDeadStock = deadStock;
            startOfDayCheckedBy = by;
            startOfDayCheckedAt = at;
        } else {
            if (endOfDayEnteredAt == null && !isCorrection) {
                endOfDayEnteredBy = by;
                endOfDayEnteredAt = at;
            }
            endOfDayAvailable = available;
            endOfDayDeadStock = deadStock;
            endOfDayCheckedBy = by;
            endOfDayCheckedAt = at;
        }
        checkedBy = by;
        Integer latestUsable = usableFor(StockCheckSnapshot.END_OF_DAY);
        currentCount = latestUsable != null ? latestUsable : usableFor(StockCheckSnapshot.START_OF_DAY);
    }

    public Long getId() {
        return id;
    }

    public Store getStore() {
        return store;
    }

    public void setStore(Store store) {
        this.store = store;
    }

    public StoreInventoryItem getStoreInventoryItem() {
        return storeInventoryItem;
    }

    public void setStoreInventoryItem(StoreInventoryItem storeInventoryItem) {
        this.storeInventoryItem = storeInventoryItem;
    }

    public LocalDate getCheckDate() {
        return checkDate;
    }

    public void setCheckDate(LocalDate checkDate) {
        this.checkDate = checkDate;
    }

    public Integer getStartOfDayAvailable() { return startOfDayAvailable; }
    public Integer getStartOfDayDeadStock() { return startOfDayDeadStock; }
    public User getStartOfDayEnteredBy() { return startOfDayEnteredBy; }
    public OffsetDateTime getStartOfDayEnteredAt() { return startOfDayEnteredAt; }
    public User getStartOfDayCheckedBy() { return startOfDayCheckedBy; }
    public OffsetDateTime getStartOfDayCheckedAt() { return startOfDayCheckedAt; }

    public Integer getEndOfDayAvailable() { return endOfDayAvailable; }
    public Integer getEndOfDayDeadStock() { return endOfDayDeadStock; }
    public User getEndOfDayEnteredBy() { return endOfDayEnteredBy; }
    public OffsetDateTime getEndOfDayEnteredAt() { return endOfDayEnteredAt; }
    public User getEndOfDayCheckedBy() { return endOfDayCheckedBy; }
    public OffsetDateTime getEndOfDayCheckedAt() { return endOfDayCheckedAt; }

    public Integer getRequiredTomorrow() {
        return requiredTomorrow;
    }

    public void setRequiredTomorrow(Integer requiredTomorrow) {
        this.requiredTomorrow = requiredTomorrow;
    }

    public User getCheckedBy() {
        return checkedBy;
    }

    public int getCurrentCount() {
        return currentCount;
    }

    public int getQuantityNeeded() {
        return quantityNeeded;
    }

    public void setQuantityNeeded(int quantityNeeded) {
        this.quantityNeeded = quantityNeeded;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }
}
