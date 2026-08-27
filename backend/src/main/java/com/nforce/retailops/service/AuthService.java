package com.nforce.retailops.service;

import com.nforce.retailops.dto.LoginResponse;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.SuperAdminRepository;
import com.nforce.retailops.repository.UserRepository;
import com.nforce.retailops.security.JwtService;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final SuperAdminRepository superAdminRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(
        UserRepository userRepository,
        SuperAdminRepository superAdminRepository,
        PasswordEncoder passwordEncoder,
        JwtService jwtService
    ) {
        this.userRepository = userRepository;
        this.superAdminRepository = superAdminRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional(readOnly = true)
    public LoginResponse login(String email, String password) {
        Optional<SuperAdmin> superAdminMatch = superAdminRepository.findByEmailIgnoreCase(email);
        if (superAdminMatch.isPresent()) {
            return loginAsSuperAdmin(superAdminMatch.get(), password);
        }

        User user = userRepository.findByEmailWithRoles(email)
            .filter(User::isActive)
            .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));

        return loginAsUser(user, password);
    }

    private LoginResponse loginAsUser(User user, String password) {
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new BadCredentialsException("Invalid email or password");
        }

        List<String> roleNames = user.getRoles().stream().map(Role::getName).toList();
        String primaryRole = roleNames.contains("OWNER_ADMIN") ? "OWNER_ADMIN" : "EMPLOYEE";

        String token = jwtService.generateToken(user.getEmail(), roleNames);

        return new LoginResponse(token, primaryRole, user.getFullName());
    }

    private LoginResponse loginAsSuperAdmin(SuperAdmin superAdmin, String password) {
        if (!passwordEncoder.matches(password, superAdmin.getPasswordHash())) {
            throw new BadCredentialsException("Invalid email or password");
        }

        String token = jwtService.generateToken(superAdmin.getEmail(), List.of("SUPER_ADMIN"));

        return new LoginResponse(token, "SUPER_ADMIN", superAdmin.getName());
    }
}
