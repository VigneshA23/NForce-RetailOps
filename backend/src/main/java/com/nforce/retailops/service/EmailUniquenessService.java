package com.nforce.retailops.service;

import com.nforce.retailops.exception.EmailAlreadyExistsException;
import com.nforce.retailops.repository.SuperAdminRepository;
import com.nforce.retailops.repository.UserRepository;
import org.springframework.stereotype.Service;

/**
 * users and super_admins share no key space but share a login namespace: an
 * email present in either must not be written into the other. Every email-write
 * site goes through here.
 */
@Service
public class EmailUniquenessService {

    private final UserRepository userRepository;
    private final SuperAdminRepository superAdminRepository;

    public EmailUniquenessService(UserRepository userRepository, SuperAdminRepository superAdminRepository) {
        this.userRepository = userRepository;
        this.superAdminRepository = superAdminRepository;
    }

    /** Throws EmailAlreadyExistsException if the email is taken in either table. */
    public void assertAvailable(String email) {
        if (userRepository.findByEmailWithRoles(email).isPresent()
            || superAdminRepository.findByEmailIgnoreCase(email).isPresent()) {
            throw new EmailAlreadyExistsException("A user with this email already exists");
        }
    }
}
