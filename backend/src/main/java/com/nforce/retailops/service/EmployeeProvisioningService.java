package com.nforce.retailops.service;

import com.nforce.retailops.dto.EmployeeCreateRequest;
import com.nforce.retailops.dto.EmployeeResponse;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreEmployee;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.EmailAlreadyExistsException;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;

/**
 * Persists (and, on mail failure, un-persists) the employee account row work
 * from {@link EmployeeService#createEmployee}, each in its own short-lived
 * transaction. Split out into a separate bean specifically so the two
 * {@code REQUIRES_NEW} transactions below are real, independent ones -- a
 * same-class private method carrying {@code @Transactional} would be silently
 * ignored on self-invocation, since Spring's proxy-based AOP never sees calls
 * that don't go through the bean's own proxy. Keeping this off the same
 * transaction as the synchronous Resend call in createEmployee is the whole
 * point: it lets the DB connection used here be returned to the pool before
 * that external HTTP call ever starts.
 */
@Service
public class EmployeeProvisioningService {

    public record ProvisionedEmployee(
        Long userId,
        Long storeEmployeeId,
        String email,
        String fullName,
        String temporaryPassword,
        EmployeeResponse response
    ) {}

    private static final String EMPLOYEE_ROLE_NAME = "EMPLOYEE";

    private final StoreEmployeeRepository storeEmployeeRepository;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final TemporaryPasswordGenerator temporaryPasswordGenerator;

    public EmployeeProvisioningService(
        StoreEmployeeRepository storeEmployeeRepository,
        UserRepository userRepository,
        RoleRepository roleRepository,
        PasswordEncoder passwordEncoder,
        TemporaryPasswordGenerator temporaryPasswordGenerator
    ) {
        this.storeEmployeeRepository = storeEmployeeRepository;
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.temporaryPasswordGenerator = temporaryPasswordGenerator;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public ProvisionedEmployee createEmployeeAccount(Long ownerId, EmployeeCreateRequest request, Set<Store> stores) {
        String email = request.email().trim();
        if (userRepository.findByEmailWithRoles(email).isPresent()) {
            throw new EmailAlreadyExistsException("A user with this email already exists");
        }

        Role employeeRole = roleRepository.findByName(EMPLOYEE_ROLE_NAME)
            .orElseThrow(() -> new IllegalStateException(EMPLOYEE_ROLE_NAME + " role is not seeded"));

        String temporaryPassword = temporaryPasswordGenerator.generate();

        User employee = new User();
        employee.setFullName(request.name().trim());
        employee.setEmail(email);
        employee.setPasswordHash(passwordEncoder.encode(temporaryPassword));
        employee.setMustResetPassword(true);
        employee.getRoles().add(employeeRole);
        employee = userRepository.save(employee);

        StoreEmployee storeEmployee = new StoreEmployee();
        storeEmployee.setStores(stores);
        storeEmployee.setEmployee(employee);
        storeEmployee.setCreatedByOwner(userRepository.getReferenceById(ownerId));
        storeEmployee.setPhone(request.phone().trim());
        storeEmployee.setShift(request.shift());
        storeEmployee.setEmployeeType(request.employeeType());
        storeEmployee.setGender(request.gender());
        storeEmployee = storeEmployeeRepository.save(storeEmployee);

        return new ProvisionedEmployee(
            employee.getId(),
            storeEmployee.getId(),
            employee.getEmail(),
            employee.getFullName(),
            temporaryPassword,
            EmployeeResponse.from(storeEmployee)
        );
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void deleteUnreachableEmployee(Long storeEmployeeId, Long userId) {
        storeEmployeeRepository.deleteById(storeEmployeeId);
        userRepository.deleteById(userId);
    }
}
