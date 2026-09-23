package com.nforce.retailops.security;

import com.nforce.retailops.service.SessionService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

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

        // Diagnostic timing: this runs on EVERY authenticated request, BEFORE it
        // reaches any controller -- so if a request looks fast once it hits a
        // controller's own timing (e.g. TaskMakeupLinkService's [MissedTasks] log)
        // but the client already timed out, the gap is almost always sitting here,
        // in one of these two DB calls, not in the endpoint's own logic.
        long filterStart = System.nanoTime();
        log.info("[JwtFilter] START {} {}", request.getMethod(), request.getRequestURI());

        if (jwtService.isTokenValid(token)) {
            String tokenId = jwtService.extractTokenId(token);

            // The JWT signature/expiry is valid, but the session behind it may have
            // been revoked (logout) or expired from inactivity — that check is the
            // server-side source of truth, not just the token's own expiry.
            long sessionStart = System.nanoTime();
            log.info("[JwtFilter] -> sending to DB: sessionService.validateAndTouch");
            boolean sessionValid = sessionService.validateAndTouch(tokenId);
            log.info("[JwtFilter] <- received from DB: sessionService.validateAndTouch ({} ms)", elapsedMs(sessionStart));

            if (sessionValid) {
                String email = jwtService.extractEmail(token);

                // The account itself is re-read on every request, so an account
                // deactivated or deleted mid-session stops being able to act here
                // rather than at token expiry. Leaving the SecurityContext unset
                // makes this fall through to a clean 401 from the entry point.
                UserDetails userDetails;
                long userLookupStart = System.nanoTime();
                log.info("[JwtFilter] -> sending to DB: userDetailsService.loadUserByUsername");
                try {
                    userDetails = userDetailsService.loadUserByUsername(email);
                    log.info("[JwtFilter] <- received from DB: userDetailsService.loadUserByUsername ({} ms)", elapsedMs(userLookupStart));
                } catch (UsernameNotFoundException ex) {
                    log.info("[JwtFilter] <- received from DB: userDetailsService.loadUserByUsername, not found ({} ms)", elapsedMs(userLookupStart));
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

        log.info("[JwtFilter] DONE {} {} -- handing off to controller ({} ms)",
            request.getMethod(), request.getRequestURI(), elapsedMs(filterStart));
        filterChain.doFilter(request, response);
    }

    private static long elapsedMs(long startNanos) {
        return (System.nanoTime() - startNanos) / 1_000_000;
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
