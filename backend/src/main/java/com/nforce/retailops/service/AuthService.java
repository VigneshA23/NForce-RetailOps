package com.nforce.retailops.service;

import com.nforce.retailops.dto.LoginResponse;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.UserRepository;
import com.nforce.retailops.security.JwtService;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional(readOnly = true)
    public LoginResponse login(String email, String password) {
        User user = userRepository.findByEmailWithRoles(email)
            .filter(User::isActive)
            .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new BadCredentialsException("Invalid email or password");
        }

        List<String> roleNames = user.getRoles().stream().map(Role::getName).toList();
        String primaryRole = roleNames.contains("OWNER_ADMIN") ? "OWNER_ADMIN" : "EMPLOYEE";

        String token = jwtService.generateToken(user.getEmail(), roleNames);

        return new LoginResponse(token, primaryRole, user.getFullName());
    }
}
