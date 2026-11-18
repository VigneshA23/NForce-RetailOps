package com.nforce.retailops.security;

import com.nforce.retailops.service.OwnerStoreAccessService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Re-checks, on every Owner/Admin request, that the store named in the
 * X-Store-Id header is one the admin is still actively linked to. A failure is
 * a 404 (StoreScopeInvalidException, via GlobalExceptionHandler), so an admin
 * unassigned mid-session is turned away on their next request whichever
 * endpoint it hits. Requests without the header pass through; endpoints that
 * need a store resolve it via OwnerStoreAccessService, which applies the same
 * rule plus the "exactly one store" fallback.
 *
 * <p>Not applied to the endpoints the UI needs in order to recover from a
 * revoked store: login/session, the profile, and the store list itself (see
 * WebMvcConfig).
 */
@Component
public class StoreScopeInterceptor implements HandlerInterceptor {

    private final OwnerStoreAccessService ownerStoreAccessService;

    public StoreScopeInterceptor(OwnerStoreAccessService ownerStoreAccessService) {
        this.ownerStoreAccessService = ownerStoreAccessService;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null
                && authentication.getPrincipal() instanceof AppUserDetails details
                && details.getAuthorities().stream()
                    .anyMatch(a -> "ROLE_OWNER_ADMIN".equals(a.getAuthority()))) {
            ownerStoreAccessService.validateSelectedStore(details.getUser().getId());
        }
        return true;
    }
}
