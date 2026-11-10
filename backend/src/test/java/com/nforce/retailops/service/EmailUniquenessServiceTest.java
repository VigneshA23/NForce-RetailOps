package com.nforce.retailops.service;

import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.EmailAlreadyExistsException;
import com.nforce.retailops.repository.SuperAdminRepository;
import com.nforce.retailops.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EmailUniquenessServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private SuperAdminRepository superAdminRepository;

    @InjectMocks
    private EmailUniquenessService service;

    @Test
    void rejectsAnEmailUsedByAUser() {
        when(userRepository.findByEmailWithRoles("a@nforce.test")).thenReturn(Optional.of(new User()));

        assertThatThrownBy(() -> service.assertAvailable("a@nforce.test"))
            .isInstanceOf(EmailAlreadyExistsException.class);
    }

    @Test
    void rejectsAnEmailUsedByASuperAdmin() {
        when(userRepository.findByEmailWithRoles("a@nforce.test")).thenReturn(Optional.empty());
        when(superAdminRepository.findByEmailIgnoreCase("a@nforce.test")).thenReturn(Optional.of(new SuperAdmin()));

        assertThatThrownBy(() -> service.assertAvailable("a@nforce.test"))
            .isInstanceOf(EmailAlreadyExistsException.class);
    }

    @Test
    void acceptsAnEmailFreeInBothTables() {
        when(userRepository.findByEmailWithRoles("a@nforce.test")).thenReturn(Optional.empty());
        when(superAdminRepository.findByEmailIgnoreCase("a@nforce.test")).thenReturn(Optional.empty());

        assertThatCode(() -> service.assertAvailable("a@nforce.test")).doesNotThrowAnyException();
    }
}
