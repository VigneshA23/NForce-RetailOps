package com.nforce.retailops.service;

import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.StoreScopeInvalidException;
import com.nforce.retailops.repository.StoreOwnerRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class OwnerStoreScopeTest {

    private static final Long OWNER_ID = 7L;

    private final StoreOwnerRepository repository = mock(StoreOwnerRepository.class);

    @AfterEach
    void clearRequest() {
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void selectedStoreWithAnActiveLinkIsUsed() {
        StoreOwner link = link(10L, true);
        select("10");
        when(repository.findByStoreIdAndOwnerIdAndActiveTrue(10L, OWNER_ID)).thenReturn(Optional.of(link));

        assertThat(OwnerStoreScope.requireStoreId(repository, OWNER_ID)).isEqualTo(10L);
    }

    @Test
    void selectedStoreWhoseLinkIsInactiveIs404() {
        // The active-only lookup finds nothing for a deactivated/unassigned link.
        select("10");
        when(repository.findByStoreIdAndOwnerIdAndActiveTrue(10L, OWNER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> OwnerStoreScope.requireStore(repository, OWNER_ID))
            .isInstanceOf(StoreScopeInvalidException.class)
            .hasMessage("Store not found");
    }

    @Test
    void selectedStoreBelongingToAnotherOwnerIs404() {
        select("99");
        when(repository.findByStoreIdAndOwnerIdAndActiveTrue(99L, OWNER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> OwnerStoreScope.currentLink(repository, OWNER_ID))
            .isInstanceOf(StoreScopeInvalidException.class);
    }

    @Test
    void noSelectionWithExactlyOneActiveStoreFallsBackToIt() {
        when(repository.findByOwnerId(OWNER_ID)).thenReturn(List.of(link(10L, true), link(11L, false)));

        assertThat(OwnerStoreScope.requireStoreId(repository, OWNER_ID)).isEqualTo(10L);
    }

    @Test
    void noSelectionWithSeveralActiveStoresIsAmbiguousAnd404() {
        when(repository.findByOwnerId(OWNER_ID)).thenReturn(List.of(link(10L, true), link(11L, true)));

        assertThatThrownBy(() -> OwnerStoreScope.scopedStoreIds(repository, OWNER_ID))
            .isInstanceOf(StoreScopeInvalidException.class);
    }

    @Test
    void noStoresAtAllIsEmptyForListsAnd404ForRequire() {
        when(repository.findByOwnerId(OWNER_ID)).thenReturn(List.of());

        assertThat(OwnerStoreScope.scopedStoreIds(repository, OWNER_ID)).isEmpty();
        assertThatThrownBy(() -> OwnerStoreScope.requireLink(repository, OWNER_ID))
            .isInstanceOf(StoreScopeInvalidException.class);
    }

    @Test
    void malformedHeaderIs404() {
        select("not-a-number");

        assertThatThrownBy(OwnerStoreScope::selectedStoreId).isInstanceOf(StoreScopeInvalidException.class);
    }

    @Test
    void validateSelectedStoreRejectsAnUnlinkedStoreAndIgnoresNoHeader() {
        OwnerStoreAccessService service = new OwnerStoreAccessService(repository);
        service.validateSelectedStore(OWNER_ID); // no header: nothing to check

        select("12");
        when(repository.findByStoreIdAndOwnerIdAndActiveTrue(12L, OWNER_ID)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.validateSelectedStore(OWNER_ID))
            .isInstanceOf(StoreScopeInvalidException.class);
    }

    private static void select(String storeId) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(OwnerStoreScope.STORE_HEADER, storeId);
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }

    private static StoreOwner link(Long storeId, boolean active) {
        Store store = new Store();
        ReflectionTestUtils.setField(store, "id", storeId);
        User owner = new User();
        ReflectionTestUtils.setField(owner, "id", OWNER_ID);
        StoreOwner link = new StoreOwner();
        link.setStore(store);
        link.setOwner(owner);
        link.setActive(active);
        return link;
    }
}
