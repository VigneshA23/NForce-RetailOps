package com.nforce.retailops.security;

import com.nforce.retailops.service.SessionService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final AppUserDetailsService userDetailsService;
    private final SessionService sessionService;

    public JwtAuthenticationFilter(
        JwtService jwtService,
        AppUserDetailsService userDetailsService,
        SessionService sessionService
    ) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
        this.sessionService = sessionService;
    }

    @Override
    protected void doFilterInternal(
        @NonNull HttpServletRequest request,
        @NonNull HttpServletResponse response,
        @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);

        if (jwtService.isTokenValid(token) && SecurityContextHolder.getContext().getAuthentication() == null) {
            String tokenId = jwtService.extractTokenId(token);

            // The JWT signature/expiry is valid, but the session behind it may have
            // been revoked (logout) or expired from inactivity — that check is the
            // server-side source of truth, not just the token's own expiry.
            if (sessionService.validateAndTouch(tokenId)) {
                String email = jwtService.extractEmail(token);

                // The account itself is re-read on every request, so an account
                // deactivated or deleted mid-session stops being able to act here
                // rather than at token expiry. Leaving the SecurityContext unset
                // makes this fall through to a clean 401 from the entry point.
                UserDetails userDetails;
                try {
                    userDetails = userDetailsService.loadUserByUsername(email);
                } catch (UsernameNotFoundException ex) {
                    sessionService.invalidate(tokenId);
                    filterChain.doFilter(request, response);
                    return;
                }

                if (!userDetails.isEnabled()) {
                    sessionService.invalidate(tokenId);
                    filterChain.doFilter(request, response);
                    return;
                }

                if (requiresPasswordReset(userDetails) && !isPasswordResetExempt(request)) {
                    response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                    response.setContentType("application/json");
                    response.getWriter().write("{\"message\":\"Password reset required\"}");
                    return;
                }

                var authToken = new UsernamePasswordAuthenticationToken(
                    userDetails, null, userDetails.getAuthorities()
                );
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        }

        filterChain.doFilter(request, response);
    }

    // Only a plain owner/employee account (AppUserDetails) can carry a temp
    // password -- super admins never go through that flow.
    private boolean requiresPasswordReset(UserDetails userDetails) {
        return userDetails instanceof AppUserDetails appUserDetails && appUserDetails.getUser().isMustResetPassword();
    }

    // Kept minimal on purpose: the reset endpoint itself, logout (so a user
    // stuck on a temp password can still sign out), and /api/me (so the
    // frontend can re-identify "still needs to reset" after a page reload).
    private boolean isPasswordResetExempt(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.equals("/api/auth/reset-password")
            || path.equals("/api/auth/logout")
            || path.equals("/api/me");
    }
}
