package com.nforce.retailops.service;

import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.exception.StoreScopeInvalidException;
import com.nforce.retailops.repository.StoreOwnerRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.List;
import java.util.Optional;

/**
 * The single rule for which store an Owner/Admin request is about. Every owner
 * service resolves "my store" through here instead of guessing from the
 * admin's links, because an admin may be actively linked to several stores.
 *
 * <ul>
 *   <li>The UI sends the store the admin picked in the {@value #STORE_HEADER}
 *       header. It must name a store the admin is <em>actively</em> linked to,
 *       otherwise {@link StoreScopeInvalidException} (404, never 403).</li>
 *   <li>Without the header the request is allowed only when the admin has
 *       exactly one active store, so single-store admins and older clients
 *       keep working unchanged. With two or more it is ambiguous and refused
 *       the same way.</li>
 * </ul>
 * The link is re-read on every call, so unassigning an admin takes effect on
 * their very next request.
 *
 * <p>Static and repository-taking, rather than a bean, so the services that
 * use it keep their constructors (and their unit tests) unchanged. Spring code
 * that wants a bean uses {@link OwnerStoreAccessService}.
 */
public final class OwnerStoreScope {

    public static final String STORE_HEADER = "X-Store-Id";

    private OwnerStoreScope() {
    }

    /** Every store the admin is actively linked to. */
    public static List<StoreOwner> activeLinks(StoreOwnerRepository repository, Long ownerId) {
        return repository.findByOwnerId(ownerId).stream()
            .filter(StoreOwner::isActive)
            .toList();
    }

    /**
     * Lenient form for list-style endpoints: empty when the admin has no stores
     * at all, so they get an empty list rather than an error. A bad header, or
     * several stores and no header, is still a 404.
     */
    public static Optional<StoreOwner> currentLink(StoreOwnerRepository repository, Long ownerId) {
        Optional<Long> selected = selectedStoreId();
        if (selected.isPresent()) {
            return Optional.of(repository.findByStoreIdAndOwnerIdAndActiveTrue(selected.get(), ownerId)
                .orElseThrow(StoreScopeInvalidException::new));
        }
        List<StoreOwner> links = activeLinks(repository, ownerId);
        if (links.isEmpty()) {
            return Optional.empty();
        }
        if (links.size() == 1) {
            return Optional.of(links.get(0));
        }
        throw new StoreScopeInvalidException();
    }

    /** The selected store's active link, or 404 if there isn't a usable one. */
    public static StoreOwner requireLink(StoreOwnerRepository repository, Long ownerId) {
        return currentLink(repository, ownerId).orElseThrow(StoreScopeInvalidException::new);
    }

    public static Store requireStore(StoreOwnerRepository repository, Long ownerId) {
        return requireLink(repository, ownerId).getStore();
    }

    public static Long requireStoreId(StoreOwnerRepository repository, Long ownerId) {
        return requireStore(repository, ownerId).getId();
    }

    /** The selected store as a one-element list, or empty if the admin has no stores. */
    public static List<Long> scopedStoreIds(StoreOwnerRepository repository, Long ownerId) {
        return currentLink(repository, ownerId)
            .map(link -> List.of(link.getStore().getId()))
            .orElse(List.of());
    }

    /** The header's store id: empty when absent, blank or outside a request; 404 when malformed. */
    public static Optional<Long> selectedStoreId() {
        if (!(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes)) {
            return Optional.empty();
        }
        HttpServletRequest request = attributes.getRequest();
        String raw = request.getHeader(STORE_HEADER);
        if (raw == null || raw.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.of(Long.parseLong(raw.trim()));
        } catch (NumberFormatException ex) {
            throw new StoreScopeInvalidException();
        }
    }
}
