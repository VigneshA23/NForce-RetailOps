package com.nforce.retailops.controller;

import com.nforce.retailops.dto.LoginRequest;
import com.nforce.retailops.dto.LoginResponse;
import com.nforce.retailops.dto.SessionConfigResponse;
import com.nforce.retailops.security.JwtService;
import com.nforce.retailops.service.AuthService;
import com.nforce.retailops.service.SessionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final SessionService sessionService;
    private final JwtService jwtService;

    public AuthController(AuthService authService, SessionService sessionService, JwtService jwtService) {
        this.authService = authService;
        this.sessionService = sessionService;
        this.jwtService = jwtService;
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request.email(), request.password()));
    }

    @GetMapping("/session-config")
    public ResponseEntity<SessionConfigResponse> sessionConfig() {
        return ResponseEntity.ok(new SessionConfigResponse(sessionService.getInactivityTimeoutMinutes()));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            if (jwtService.isTokenValid(token)) {
                sessionService.invalidate(jwtService.extractTokenId(token));
            }
        }
        return ResponseEntity.ok().build();
    }
}
