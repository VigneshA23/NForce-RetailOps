package com.nforce.retailops.security;

import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.SuperAdminRepository;
import com.nforce.retailops.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AppUserDetailsServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private SuperAdminRepository superAdminRepository;

    @InjectMocks
    private AppUserDetailsService service;

    @Test
    void resolvesASuperAdminEmailToASuperAdminPrincipal() {
        SuperAdmin superAdmin = new SuperAdmin();
        superAdmin.setEmail("sa@nforce.test");
        when(superAdminRepository.findByEmailIgnoreCase("sa@nforce.test")).thenReturn(Optional.of(superAdmin));
        when(userRepository.findByEmailWithRoles("sa@nforce.test")).thenReturn(Optional.empty());

        UserDetails details = service.loadUserByUsername("sa@nforce.test");

        assertThat(details).isInstanceOf(SuperAdminUserDetails.class);
    }

    @Test
    void resolvesAUserEmailToAUserPrincipal() {
        User user = new User();
        user.setEmail("u@nforce.test");
        when(superAdminRepository.findByEmailIgnoreCase("u@nforce.test")).thenReturn(Optional.empty());
        when(userRepository.findByEmailWithRoles("u@nforce.test")).thenReturn(Optional.of(user));

        assertThat(service.loadUserByUsername("u@nforce.test")).isInstanceOf(AppUserDetails.class);
    }

    @Test
    void failsLoudlyWhenAnEmailExistsInBothTables() {
        when(superAdminRepository.findByEmailIgnoreCase("x@nforce.test")).thenReturn(Optional.of(new SuperAdmin()));
        when(userRepository.findByEmailWithRoles("x@nforce.test")).thenReturn(Optional.of(new User()));

        assertThatThrownBy(() -> service.loadUserByUsername("x@nforce.test"))
            .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void unknownEmailIsNotFound() {
        when(superAdminRepository.findByEmailIgnoreCase("n@nforce.test")).thenReturn(Optional.empty());
        when(userRepository.findByEmailWithRoles("n@nforce.test")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.loadUserByUsername("n@nforce.test"))
            .isInstanceOf(UsernameNotFoundException.class);
    }
}
