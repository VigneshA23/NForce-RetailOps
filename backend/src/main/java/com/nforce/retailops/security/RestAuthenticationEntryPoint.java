package com.nforce.retailops.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Map;

/**
 * Returns 401 (not Spring's default 403) whenever a request reaches a
 * protected endpoint without a valid, active session — missing token,
 * malformed/expired token, or a token whose server-side session has been
 * revoked (logout) or expired from inactivity. This is what lets the
 * frontend distinguish "you're logged out" (401) from "you're logged in but
 * not allowed to do this" (403, still handled by GlobalExceptionHandler).
 */
@Component
public class RestAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void commence(
        HttpServletRequest request,
        HttpServletResponse response,
        AuthenticationException authException
    ) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(
            response.getWriter(),
            Map.of("message", "Your session has expired or is invalid. Please log in again.")
        );
    }
}
