package com.nforce.retailops.security;

import com.nforce.retailops.repository.SuperAdminRepository;
import com.nforce.retailops.repository.UserRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AppUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;
    private final SuperAdminRepository superAdminRepository;

    public AppUserDetailsService(UserRepository userRepository, SuperAdminRepository superAdminRepository) {
        this.userRepository = userRepository;
        this.superAdminRepository = superAdminRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String email) {
        return userRepository.findByEmailWithRoles(email)
            .<UserDetails>map(AppUserDetails::new)
            .or(() -> superAdminRepository.findByEmailIgnoreCase(email).map(SuperAdminUserDetails::new))
            .orElseThrow(() -> new UsernameNotFoundException("No user found with email " + email));
    }
}
