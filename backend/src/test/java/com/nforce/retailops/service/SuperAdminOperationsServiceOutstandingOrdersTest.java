package com.nforce.retailops.service;

import com.nforce.retailops.dto.OutstandingOrdersOverviewResponse;
import com.nforce.retailops.entity.OrderStatus;
import com.nforce.retailops.repository.OrderListEntryRepository;
import com.nforce.retailops.repository.RaisedIssueRepository;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.TaskMakeupLinkRepository;
import com.nforce.retailops.repository.TaskRepository;
import com.nforce.retailops.repository.TaskResponseEntryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// The row cap, the platform total and the owner-name fallback are pure service
// logic over whatever tuples the repository returns, so they are tested here with
// stubbed Object[] rows. The query itself is covered by
// OrderListEntryAggregateRepositoryTest against a real database.
@ExtendWith(MockitoExtension.class)
class SuperAdminOperationsServiceOutstandingOrdersTest {

    @Mock private StoreOwnerRepository storeOwnerRepository;
    @Mock private TaskRepository taskRepository;
    @Mock private TaskResponseEntryRepository taskResponseEntryRepository;
    @Mock private TaskMakeupLinkRepository taskMakeupLinkRepository;
    @Mock private RaisedIssueRepository raisedIssueRepository;
    @Mock private StoreEmployeeRepository storeEmployeeRepository;
    @Mock private OrderListEntryRepository orderListEntryRepository;

    private SuperAdminOperationsService service;

    @BeforeEach
    void setUp() {
        service = new SuperAdminOperationsService(
            storeOwnerRepository,
            taskRepository,
            taskResponseEntryRepository,
            taskMakeupLinkRepository,
            raisedIssueRepository,
            storeEmployeeRepository,
            orderListEntryRepository
        );
    }

    private Object[] row(long storeId, String ownerName, long count) {
        return new Object[] {
            storeId, 9000L + storeId, "Store " + storeId, ownerName, count, OffsetDateTime.now().minusDays(1)
        };
    }

    private void stubRows(List<Object[]> rows) {
        when(orderListEntryRepository.findOutstandingRowsGroupedByStore(OrderStatus.NEEDS_ORDERING))
            .thenReturn(rows);
    }

    @Test
    void platformTotalCountsEveryStoreEvenWhenRowsAreTruncated() {
        // 52 stores: the first holds 3 outstanding entries, the other 51 hold 1 each.
        // True total is 54, but the 50 rows that survive the cap sum to only 52 --
        // so an implementation that totalled the returned list would report 52 here.
        List<Object[]> rows = new ArrayList<>();
        rows.add(row(1L, "Owner One", 3L));
        for (long i = 2; i <= 52; i++) {
            rows.add(row(i, "Owner " + i, 1L));
        }
        stubRows(rows);

        OutstandingOrdersOverviewResponse response = service.getOutstandingOrdersOverview();

        assertThat(response.platformOutstandingCount()).isEqualTo(54L);
        assertThat(response.stores()).hasSize(50);
        assertThat(response.storesWithOutstanding()).isEqualTo(52);
        assertThat(response.truncated()).isTrue();
    }

    @Test
    void doesNotMarkTruncatedForExactlyFiftyStores() {
        List<Object[]> rows = new ArrayList<>();
        for (long i = 1; i <= 50; i++) {
            rows.add(row(i, "Owner " + i, 2L));
        }
        stubRows(rows);

        OutstandingOrdersOverviewResponse response = service.getOutstandingOrdersOverview();

        assertThat(response.stores()).hasSize(50);
        assertThat(response.truncated()).isFalse();
        assertThat(response.storesWithOutstanding()).isEqualTo(50);
        assertThat(response.platformOutstandingCount()).isEqualTo(100L);
    }

    @Test
    void rendersUnassignedForAStoreWithNoActiveOwner() {
        // Explicit type witness: row() returns Object[], which List.of would
        // otherwise spread as varargs into a List<Object>.
        stubRows(List.<Object[]>of(row(7L, null, 4L)));

        OutstandingOrdersOverviewResponse response = service.getOutstandingOrdersOverview();

        assertThat(response.stores()).hasSize(1);
        assertThat(response.stores().get(0).ownerName()).isEqualTo("Unassigned");
        assertThat(response.stores().get(0).storeId()).isEqualTo(7L);
        assertThat(response.stores().get(0).outstandingCount()).isEqualTo(4L);
    }

    @Test
    void preservesRepositoryOrderingAndKeepsTheHighestCounts() {
        List<Object[]> rows = new ArrayList<>();
        // Already count-descending, as the query's order by guarantees.
        for (long i = 1; i <= 52; i++) {
            rows.add(row(i, "Owner " + i, 100L - i));
        }
        stubRows(rows);

        OutstandingOrdersOverviewResponse response = service.getOutstandingOrdersOverview();

        assertThat(response.stores()).extracting(r -> r.storeId())
            .startsWith(1L, 2L, 3L)
            .endsWith(50L);
        assertThat(response.stores()).extracting(r -> r.outstandingCount())
            .startsWith(99L, 98L, 97L);
    }

    @Test
    void returnsZeroTotalAndEmptyRowsWhenNothingIsOutstanding() {
        stubRows(List.of());

        OutstandingOrdersOverviewResponse response = service.getOutstandingOrdersOverview();

        assertThat(response.platformOutstandingCount()).isZero();
        assertThat(response.stores()).isEmpty();
        assertThat(response.storesWithOutstanding()).isZero();
        assertThat(response.truncated()).isFalse();
    }

    // Locks the status filter: "outstanding" is NEEDS_ORDERING only, never a
    // statusNot(RECEIVED) that would quietly fold in ORDERED entries.
    @Test
    void queriesOnlyForNeedsOrderingStatus() {
        stubRows(List.of());

        service.getOutstandingOrdersOverview();

        verify(orderListEntryRepository).findOutstandingRowsGroupedByStore(OrderStatus.NEEDS_ORDERING);
    }
}
