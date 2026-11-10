package com.nforce.retailops.security;

import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.SuperAdminRepository;
import com.nforce.retailops.repository.UserRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
public class AppUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;
    private final SuperAdminRepository superAdminRepository;

    public AppUserDetailsService(UserRepository userRepository, SuperAdminRepository superAdminRepository) {
        this.userRepository = userRepository;
        this.superAdminRepository = superAdminRepository;
    }

    /**
     * Same priority as AuthService.login: super_admins first. An email present
     * in both tables is a data-integrity violation and fails loudly rather than
     * silently picking a principal.
     */
    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String email) {
        Optional<SuperAdmin> superAdmin = superAdminRepository.findByEmailIgnoreCase(email);
        Optional<User> user = userRepository.findByEmailWithRoles(email);
        if (superAdmin.isPresent() && user.isPresent()) {
            throw new IllegalStateException("Email collision across users and super_admins: " + email);
        }
        return superAdmin.<UserDetails>map(SuperAdminUserDetails::new)
            .or(() -> user.map(AppUserDetails::new))
            .orElseThrow(() -> new UsernameNotFoundException("No user found with email " + email));
    }
}
