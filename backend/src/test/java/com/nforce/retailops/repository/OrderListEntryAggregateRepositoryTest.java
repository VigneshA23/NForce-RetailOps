package com.nforce.retailops.repository;

import static com.nforce.retailops.TestDecimals.bd;
import com.nforce.retailops.entity.OrderListEntry;
import com.nforce.retailops.entity.OrderStatus;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.Supplier;
import com.nforce.retailops.entity.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

// Exercises findOutstandingRowsGroupedByStore against a real database. The join
// shape is the whole substance of that query -- particularly the two left joins
// that keep ownerless and revoked-owner stores in the result -- and an inner join
// there would still compile and still pass a mocked service test, so it has to be
// proven here.
@SpringBootTest
@ActiveProfiles("test")
class OrderListEntryAggregateRepositoryTest {

    @Autowired private OrderListEntryRepository orderListEntryRepository;
    @Autowired private StoreRepository storeRepository;
    @Autowired private StoreOwnerRepository storeOwnerRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private StoreInventoryItemRepository storeInventoryItemRepository;
    @Autowired private SupplierRepository supplierRepository;

    private Store store(String name, long storeCode) {
        Store store = new Store();
        store.setName(name);
        store.setStoreCode(storeCode);
        store.setActive(true);
        return storeRepository.save(store);
    }

    private User owner(String email, String fullName) {
        Role ownerRole = roleRepository.findByName("OWNER_ADMIN").orElseGet(() -> {
            Role role = new Role();
            role.setName("OWNER_ADMIN");
            role.setDescription("OWNER_ADMIN");
            return roleRepository.save(role);
        });
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash("irrelevant");
        user.setFullName(fullName);
        user.getRoles().add(ownerRole);
        return userRepository.save(user);
    }

    private StoreOwner link(User owner, Store store, boolean active) {
        StoreOwner storeOwner = new StoreOwner();
        storeOwner.setOwner(owner);
        storeOwner.setStore(store);
        storeOwner.setActive(active);
        return storeOwnerRepository.save(storeOwner);
    }

    private int itemSeq = 0;

    // A fresh item per entry. V49's partial unique index forbids two non-RECEIVED
    // entries for the same store+item, so reusing one item would build a state
    // production cannot reach -- it only passes here because the test profile runs
    // on H2 with Flyway disabled and therefore without that index.
    private StoreInventoryItem item(Store store) {

        StoreInventoryItem item = new StoreInventoryItem();
        item.setStore(store);
        item.setName("Item " + ++itemSeq);
        item.setUnitOfMeasurement("L");
        item.setActive(true);
        return storeInventoryItemRepository.save(item);
    }

    private OrderListEntry entry(Store store, OrderStatus status) {
        OrderListEntry entry = new OrderListEntry();
        entry.setStore(store);
        entry.setStoreInventoryItem(item(store));
        entry.setQuantityNeeded(bd(3));
        entry.setStatus(status);
        return orderListEntryRepository.save(entry);
    }

    // OrderListEntry has no setCreatedAt and its @PrePersist assigns unconditionally,
    // so an old timestamp can only be established by overwriting after the insert.
    // The entity has no @DynamicUpdate, so the dirty-check UPDATE includes created_at.
    private OrderListEntry entryCreatedAt(Store store, OffsetDateTime createdAt) {
        OrderListEntry entry = entry(store, OrderStatus.NEEDS_ORDERING);
        orderListEntryRepository.saveAndFlush(entry);
        ReflectionTestUtils.setField(entry, "createdAt", createdAt);
        return orderListEntryRepository.saveAndFlush(entry);
    }

    private List<Object[]> outstandingRows() {
        return orderListEntryRepository.findOutstandingRowsGroupedByStore(OrderStatus.NEEDS_ORDERING);
    }

    private Supplier supplier(String name) {
        Supplier supplier = new Supplier();
        supplier.setName(name);
        return supplierRepository.save(supplier);
    }

    private OrderListEntry entry(Store store, OrderStatus status, Supplier supplier, int quantity) {
        OrderListEntry entry = new OrderListEntry();
        entry.setStore(store);
        entry.setStoreInventoryItem(item(store));
        entry.setQuantityNeeded(bd(quantity));
        entry.setSupplier(supplier);
        entry.setStatus(status);
        return orderListEntryRepository.save(entry);
    }

    // Same onwards-overwrite trick as entryCreatedAt above, but for an entry
    // carrying a supplier and a specific quantity.
    private OrderListEntry entryCreatedAt(Store store, OrderStatus status, Supplier supplier, int quantity, OffsetDateTime createdAt) {
        OrderListEntry entry = entry(store, status, supplier, quantity);
        orderListEntryRepository.saveAndFlush(entry);
        ReflectionTestUtils.setField(entry, "createdAt", createdAt);
        return orderListEntryRepository.saveAndFlush(entry);
    }

    private static OffsetDateTime rangeStart(LocalDate date) {
        return date.atStartOfDay(ZoneId.systemDefault()).toOffsetDateTime();
    }

    private static OffsetDateTime rangeEndExclusive(LocalDate date) {
        return date.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toOffsetDateTime();
    }

    // ---- findSupplierMetricsForStore (Owner/Admin Supplier Purchasing Summary) ----

    @Test
    @Transactional
    void onlyOrderedAndReceivedEntriesContributeToSupplierMetrics() {
        Store store = store("Store Metrics A", 8200L);
        Supplier supplierA = supplier("Supplier Metrics A");

        entry(store, OrderStatus.ORDERED, supplierA, 5);
        entry(store, OrderStatus.RECEIVED, supplierA, 7);
        entry(store, OrderStatus.NEEDS_ORDERING, supplierA, 10);

        List<Object[]> rows = orderListEntryRepository.findSupplierMetricsForStore(
            store.getId(), OrderStatus.PURCHASED_STATUSES,
            rangeStart(LocalDate.now().minusDays(1)), rangeEndExclusive(LocalDate.now()));

        assertThat(rows).hasSize(1);
        assertThat(rows.get(0)[1]).isEqualTo("Supplier Metrics A");
        assertThat(((Number) rows.get(0)[2]).longValue()).isEqualTo(2L);
        assertThat(((Number) rows.get(0)[3]).longValue()).isEqualTo(12L);
    }

    @Test
    @Transactional
    void supplierMetricsAreScopedToOneStoreNotAnother() {
        Store storeOne = store("Store Metrics One", 8201L);
        Store storeTwo = store("Store Metrics Two", 8202L);
        Supplier supplierA = supplier("Supplier Shared A");

        entry(storeOne, OrderStatus.ORDERED, supplierA, 10);
        entry(storeTwo, OrderStatus.ORDERED, supplierA, 20);

        List<Object[]> rows = orderListEntryRepository.findSupplierMetricsForStore(
            storeOne.getId(), OrderStatus.PURCHASED_STATUSES,
            rangeStart(LocalDate.now().minusDays(1)), rangeEndExclusive(LocalDate.now()));

        assertThat(rows).hasSize(1);
        assertThat(((Number) rows.get(0)[3]).longValue()).isEqualTo(10L);
    }

    @Test
    @Transactional
    void supplierMetricsRespectInclusiveDateBoundaries() {
        Store store = store("Store Metrics Dates", 8203L);
        Supplier supplierA = supplier("Supplier Dates A");

        entryCreatedAt(store, OrderStatus.ORDERED, supplierA, 1, rangeStart(LocalDate.of(2026, 8, 31)));
        entryCreatedAt(store, OrderStatus.ORDERED, supplierA, 2, rangeStart(LocalDate.of(2026, 9, 1)));
        entryCreatedAt(store, OrderStatus.ORDERED, supplierA, 4, rangeStart(LocalDate.of(2026, 9, 2)));
        entryCreatedAt(store, OrderStatus.ORDERED, supplierA, 8, rangeStart(LocalDate.of(2026, 9, 4)));
        entryCreatedAt(store, OrderStatus.ORDERED, supplierA, 16, rangeStart(LocalDate.of(2026, 9, 5)));

        List<Object[]> rows = orderListEntryRepository.findSupplierMetricsForStore(
            store.getId(), OrderStatus.PURCHASED_STATUSES,
            rangeStart(LocalDate.of(2026, 9, 1)), rangeEndExclusive(LocalDate.of(2026, 9, 4)));

        // Sep 1 (2) + Sep 2 (4) + Sep 4 (8) = 14; Aug 31 and Sep 5 excluded.
        assertThat(rows).hasSize(1);
        assertThat(((Number) rows.get(0)[2]).longValue()).isEqualTo(3L);
        assertThat(((Number) rows.get(0)[3]).longValue()).isEqualTo(14L);
    }

    @Test
    @Transactional
    void supplierMetricsIncludeEntriesWithNoAssignedSupplierRatherThanDroppingThem() {
        Store store = store("Store Metrics NoSupplier", 8204L);

        entry(store, OrderStatus.ORDERED, null, 9);

        List<Object[]> rows = orderListEntryRepository.findSupplierMetricsForStore(
            store.getId(), OrderStatus.PURCHASED_STATUSES,
            rangeStart(LocalDate.now().minusDays(1)), rangeEndExclusive(LocalDate.now()));

        assertThat(rows).hasSize(1);
        assertThat(rows.get(0)[0]).isNull();
        assertThat(rows.get(0)[1]).isNull();
        assertThat(((Number) rows.get(0)[3]).longValue()).isEqualTo(9L);
    }

    @Test
    @Transactional
    void supplierMetricsReturnEmptyWhenNothingQualifiesInRange() {
        Store store = store("Store Metrics Empty", 8205L);
        entry(store, OrderStatus.NEEDS_ORDERING, supplier("Supplier Empty A"), 5);

        List<Object[]> rows = orderListEntryRepository.findSupplierMetricsForStore(
            store.getId(), OrderStatus.PURCHASED_STATUSES,
            rangeStart(LocalDate.now().minusDays(1)), rangeEndExclusive(LocalDate.now()));

        assertThat(rows).isEmpty();
    }

    // ---- findSupplierMetricsGroupedByStore (Super Admin, platform-wide) ----

    @Test
    @Transactional
    void supplierMetricsGroupedByStoreBreaksDownEachStoreSeparately() {
        Store storeOne = store("Store Platform One", 8210L);
        Store storeTwo = store("Store Platform Two", 8211L);
        Supplier supplierA = supplier("Supplier Platform A");

        entry(storeOne, OrderStatus.ORDERED, supplierA, 10);
        entry(storeTwo, OrderStatus.ORDERED, supplierA, 20);

        List<Object[]> rows = orderListEntryRepository.findSupplierMetricsGroupedByStore(
            OrderStatus.PURCHASED_STATUSES, rangeStart(LocalDate.now().minusDays(1)), rangeEndExclusive(LocalDate.now()));

        assertThat(rows).hasSize(2);
        assertThat(rows).extracting(row -> row[0], row -> ((Number) row[5]).longValue())
            .containsExactlyInAnyOrder(
                org.assertj.core.groups.Tuple.tuple(storeOne.getId(), 10L),
                org.assertj.core.groups.Tuple.tuple(storeTwo.getId(), 20L));
    }

    @Test
    @Transactional
    void supplierMetricsGroupedByStoreExcludesNeedsOrdering() {
        Store store = store("Store Platform Exclude", 8212L);
        Supplier supplierA = supplier("Supplier Platform Exclude A");

        entry(store, OrderStatus.NEEDS_ORDERING, supplierA, 99);

        List<Object[]> rows = orderListEntryRepository.findSupplierMetricsGroupedByStore(
            OrderStatus.PURCHASED_STATUSES, rangeStart(LocalDate.now().minusDays(1)), rangeEndExclusive(LocalDate.now()));

        assertThat(rows).isEmpty();
    }

    @Test
    @Transactional
    void excludesAStoreWhoseEntriesAreAllOrderedOrReceived() {
        Store outstanding = store("Store Outstanding", 8100L);
        Store settled = store("Store Settled", 8101L);

        entry(outstanding, OrderStatus.NEEDS_ORDERING);
        entry(outstanding, OrderStatus.NEEDS_ORDERING);
        entry(settled, OrderStatus.ORDERED);
        entry(settled, OrderStatus.RECEIVED);

        List<Object[]> rows = outstandingRows();

        assertThat(rows).hasSize(1);
        assertThat(rows.get(0)[0]).isEqualTo(outstanding.getId());
        assertThat(rows.get(0)[4]).isEqualTo(2L);
    }

    @Test
    @Transactional
    void groupsCountsPerStoreAcrossMultipleStores() {
        Store a = store("Store A", 8110L);
        Store b = store("Store B", 8111L);
        Store c = store("Store C", 8112L);

        for (int i = 0; i < 3; i++) entry(a, OrderStatus.NEEDS_ORDERING);
        entry(b, OrderStatus.NEEDS_ORDERING);
        for (int i = 0; i < 2; i++) entry(c, OrderStatus.NEEDS_ORDERING);

        List<Object[]> rows = outstandingRows();

        assertThat(rows).hasSize(3);
        assertThat(rows).extracting(row -> row[0], row -> row[4])
            .containsExactlyInAnyOrder(
                org.assertj.core.groups.Tuple.tuple(a.getId(), 3L),
                org.assertj.core.groups.Tuple.tuple(b.getId(), 1L),
                org.assertj.core.groups.Tuple.tuple(c.getId(), 2L));
    }

    @Test
    @Transactional
    void ordersRowsByOutstandingCountDescending() {
        // Inserted smallest-first so insertion order cannot accidentally satisfy
        // the assertion.
        Store small = store("Store Small", 8120L);
        Store large = store("Store Large", 8121L);
        Store medium = store("Store Medium", 8122L);

        entry(small, OrderStatus.NEEDS_ORDERING);
        for (int i = 0; i < 3; i++) entry(large, OrderStatus.NEEDS_ORDERING);
        for (int i = 0; i < 2; i++) entry(medium, OrderStatus.NEEDS_ORDERING);

        List<Object[]> rows = outstandingRows();

        assertThat(rows).extracting(row -> row[0])
            .containsExactly(large.getId(), medium.getId(), small.getId());
    }

    @Test
    @Transactional
    void reportsOldestCreatedAtPerStore() {
        Store store = store("Store Aging", 8130L);
        OffsetDateTime oldest = OffsetDateTime.now().minusDays(5);

        entry(store, OrderStatus.NEEDS_ORDERING);
        entryCreatedAt(store, oldest);
        entry(store, OrderStatus.NEEDS_ORDERING);

        List<Object[]> rows = outstandingRows();

        assertThat(rows).hasSize(1);
        // Compared on the instant, not OffsetDateTime.equals: H2 round-trips the
        // stored offset while PostgreSQL normalises timestamptz to UTC, so an exact
        // equality assertion could pass here and mean something else in production.
        assertThat((OffsetDateTime) rows.get(0)[5]).isCloseTo(oldest, within(1, java.time.temporal.ChronoUnit.SECONDS));
    }

    @Test
    @Transactional
    void countsDistinctEntriesRatherThanJoinedRows() {
        Store store = store("Store Joined", 8140L);
        link(owner("agg-owner-joined@nforce.test", "Joined Owner"), store, true);

        entry(store, OrderStatus.NEEDS_ORDERING);
        entry(store, OrderStatus.NEEDS_ORDERING);

        List<Object[]> rows = outstandingRows();

        assertThat(rows).hasSize(1);
        assertThat(rows.get(0)[4]).isEqualTo(2L);
    }

    @Test
    @Transactional
    void includesAStoreWithNoStoreOwnerRowAtAll() {
        Store orphan = store("Store Orphan", 8150L);
        entry(orphan, OrderStatus.NEEDS_ORDERING);

        List<Object[]> rows = outstandingRows();

        assertThat(rows).hasSize(1);
        assertThat(rows.get(0)[0]).isEqualTo(orphan.getId());
        assertThat(rows.get(0)[3]).isNull();
    }

    @Test
    @Transactional
    void includesAStoreWhoseOwnerLinkIsInactive() {
        Store revoked = store("Store Revoked", 8160L);
        // The link keeps its owner reference after revocation, so this also proves
        // the active check sits in the ON clause rather than rendering a stale name.
        link(owner("agg-owner-revoked@nforce.test", "Revoked Owner"), revoked, false);
        entry(revoked, OrderStatus.NEEDS_ORDERING);

        List<Object[]> rows = outstandingRows();

        assertThat(rows).hasSize(1);
        assertThat(rows.get(0)[0]).isEqualTo(revoked.getId());
        assertThat(rows.get(0)[3]).isNull();
    }

    @Test
    @Transactional
    void returnsOwnerFullNameForAnActiveOwnerLink() {
        Store owned = store("Store Owned", 8170L);
        link(owner("agg-owner-active@nforce.test", "Dana Active"), owned, true);
        entry(owned, OrderStatus.NEEDS_ORDERING);

        List<Object[]> rows = outstandingRows();

        assertThat(rows).hasSize(1);
        assertThat(rows.get(0)[3]).isEqualTo("Dana Active");
    }

    private static org.assertj.core.data.TemporalUnitOffset within(long amount, java.time.temporal.TemporalUnit unit) {
        return new org.assertj.core.data.TemporalUnitWithinOffset(amount, unit);
    }
}
