package com.nforce.retailops.service;

import com.nforce.retailops.dto.LoginResponse;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.repository.SuperAdminRepository;
import com.nforce.retailops.security.JwtService;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class SuperAdminAuthService {

    private final SuperAdminRepository superAdminRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public SuperAdminAuthService(
        SuperAdminRepository superAdminRepository,
        PasswordEncoder passwordEncoder,
        JwtService jwtService
    ) {
        this.superAdminRepository = superAdminRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional(readOnly = true)
    public LoginResponse login(String email, String password) {
        SuperAdmin superAdmin = superAdminRepository.findByEmailIgnoreCase(email)
            .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));

        if (!passwordEncoder.matches(password, superAdmin.getPasswordHash())) {
            throw new BadCredentialsException("Invalid email or password");
        }

        String token = jwtService.generateToken(superAdmin.getEmail(), List.of("SUPER_ADMIN"));

        return new LoginResponse(token, "SUPER_ADMIN", superAdmin.getName());
    }
}
