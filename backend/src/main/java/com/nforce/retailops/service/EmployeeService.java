package com.nforce.retailops.service;

import com.nforce.retailops.dto.EmployeeCreateRequest;
import com.nforce.retailops.dto.EmployeeResponse;
import com.nforce.retailops.dto.EmployeeUpdateRequest;
import com.nforce.retailops.dto.StoreOptionResponse;
import com.nforce.retailops.dto.UpdateEmployeeStatusRequest;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreEmployee;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.EmailAlreadyExistsException;
import com.nforce.retailops.exception.EmailDeliveryException;
import com.nforce.retailops.exception.EmployeeNotFoundException;
import com.nforce.retailops.exception.StoreInactiveException;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class EmployeeService {

    private static final Logger log = LoggerFactory.getLogger(EmployeeService.class);

    private final StoreEmployeeRepository storeEmployeeRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final UserRepository userRepository;
    private final SessionService sessionService;
    private final MailService mailService;
    private final EmployeeProvisioningService employeeProvisioningService;
    private final PasswordEncoder passwordEncoder;
    private final TemporaryPasswordGenerator temporaryPasswordGenerator;

    public EmployeeService(
        StoreEmployeeRepository storeEmployeeRepository,
        StoreOwnerRepository storeOwnerRepository,
        UserRepository userRepository,
        SessionService sessionService,
        MailService mailService,
        EmployeeProvisioningService employeeProvisioningService,
        PasswordEncoder passwordEncoder,
        TemporaryPasswordGenerator temporaryPasswordGenerator
    ) {
        this.storeEmployeeRepository = storeEmployeeRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.userRepository = userRepository;
        this.sessionService = sessionService;
        this.mailService = mailService;
        this.employeeProvisioningService = employeeProvisioningService;
        this.passwordEncoder = passwordEncoder;
        this.temporaryPasswordGenerator = temporaryPasswordGenerator;
    }

    // Store assignment is optional: an employee can be created or edited with no
    // stores at all. Every store id that IS provided must individually be one the
    // caller owns.
    private Set<Store> resolveOwnerStores(Long ownerId, List<Long> storeIds) {
        if (storeIds == null || storeIds.isEmpty()) {
            return new LinkedHashSet<>();
        }
        Set<Store> stores = new LinkedHashSet<>();
        for (Long storeId : storeIds) {
            StoreOwner storeOwner = storeOwnerRepository.findByStoreIdAndOwnerId(storeId, ownerId)
                .orElseThrow(() -> new AccessDeniedException("You cannot assign employees to another store"));
            if (!storeOwner.isActive()) {
                throw new StoreInactiveException("\"" + storeOwner.getStore().getName() + "\" has been deactivated and cannot be assigned employees");
            }
            stores.add(storeOwner.getStore());
        }
        return stores;
    }

    private boolean ownsAnyStore(StoreEmployee storeEmployee, Long ownerId) {
        return storeEmployee.getStores().stream()
            .anyMatch(store -> storeOwnerRepository.findByStoreIdAndOwnerId(store.getId(), ownerId).isPresent());
    }

    // An owner can manage an employee either through shared store assignment, or
    // because they were the one who created the employee (which matters once an
    // employee has no stores assigned at all).
    private boolean canManageEmployee(StoreEmployee storeEmployee, Long ownerId) {
        User createdByOwner = storeEmployee.getCreatedByOwner();
        if (createdByOwner != null && createdByOwner.getId().equals(ownerId)) {
            return true;
        }
        return ownsAnyStore(storeEmployee, ownerId);
    }

    @Transactional(readOnly = true)
    public List<EmployeeResponse> listEmployees(Long ownerId) {
        List<Long> storeIds = storeOwnerRepository.findByOwnerIdAndActiveTrue(ownerId)
            .map(so -> List.of(so.getStore().getId()))
            .orElseGet(List::of);

        Map<Long, StoreEmployee> employeesById = new LinkedHashMap<>();
        if (!storeIds.isEmpty()) {
            for (StoreEmployee storeEmployee : storeEmployeeRepository.findDistinctByStoresIdInOrderByIdAscFetchEmployee(storeIds)) {
                employeesById.put(storeEmployee.getId(), storeEmployee);
            }
        }
        for (StoreEmployee storeEmployee : storeEmployeeRepository.findByCreatedByOwnerIdFetchEmployee(ownerId)) {
            employeesById.putIfAbsent(storeEmployee.getId(), storeEmployee);
        }

        List<StoreEmployee> employees = employeesById.values().stream()
            .sorted(Comparator.comparing(StoreEmployee::getId))
            .toList();

        if (employees.isEmpty()) {
            return List.of();
        }

        Map<Long, List<StoreOptionResponse>> storesByEmployeeId = new LinkedHashMap<>();
        List<Long> employeeIds = employees.stream().map(StoreEmployee::getId).toList();
        for (Object[] row : storeEmployeeRepository.findStoreRowsGroupedByEmployeeIds(employeeIds)) {
            storesByEmployeeId
                .computeIfAbsent((Long) row[0], key -> new ArrayList<>())
                .add(new StoreOptionResponse((Long) row[1], (String) row[2]));
        }

        return employees.stream()
            .map(storeEmployee -> EmployeeResponse.from(
                storeEmployee,
                storesByEmployeeId.getOrDefault(storeEmployee.getId(), List.of())
            ))
            .toList();
    }

    @Transactional(readOnly = true)
    public List<StoreOptionResponse> listAssignableStores(Long ownerId) {
        return storeOwnerRepository.findByOwnerIdAndActiveTrue(ownerId)
            .map(so -> List.of(StoreOptionResponse.from(so.getStore())))
            .orElseGet(List::of);
    }

    // Deliberately NOT @Transactional: the account is persisted in its own
    // short-lived transaction (EmployeeProvisioningService), so the mail send
    // below never holds a pooled DB connection for the duration of that
    // external HTTP call. If mail delivery fails, the account is explicitly
    // compensated away (in a second short transaction) rather than relying on
    // an implicit rollback -- an employee must not be left unable to ever
    // learn their own password.
    public EmployeeResponse createEmployee(Long ownerId, EmployeeCreateRequest request) {
        Set<Store> stores = resolveOwnerStores(ownerId, request.storeIds());

        EmployeeProvisioningService.ProvisionedEmployee provisioned =
            employeeProvisioningService.createEmployeeAccount(ownerId, request, stores);

        try {
            mailService.sendTemporaryPassword(provisioned.email(), provisioned.fullName(), provisioned.temporaryPassword());
        } catch (EmailDeliveryException ex) {
            try {
                employeeProvisioningService.deleteUnreachableEmployee(provisioned.storeEmployeeId(), provisioned.userId());
            } catch (RuntimeException cleanupEx) {
                log.error("Failed to clean up employee {} after a mail delivery failure -- account may be orphaned",
                    provisioned.userId(), cleanupEx);
                ex.addSuppressed(cleanupEx);
            }
            throw ex;
        }

        return provisioned.response();
    }

    @Transactional
    public EmployeeResponse updateEmployee(Long ownerId, Long id, EmployeeUpdateRequest request) {
        StoreEmployee storeEmployee = storeEmployeeRepository.findById(id)
            .orElseThrow(() -> new EmployeeNotFoundException("Employee not found"));

        if (!canManageEmployee(storeEmployee, ownerId)) {
            throw new EmployeeNotFoundException("Employee not found");
        }

        Set<Store> stores = resolveOwnerStores(ownerId, request.storeIds());

        String email = request.email().trim();
        User employee = storeEmployee.getEmployee();
        if (!employee.getEmail().equalsIgnoreCase(email)
            && userRepository.findByEmailWithRoles(email).isPresent()) {
            throw new EmailAlreadyExistsException("A user with this email already exists");
        }

        employee.setFullName(request.name().trim());
        employee.setEmail(email);
        userRepository.save(employee);

        storeEmployee.setStores(stores);
        storeEmployee.setPhone(request.phone().trim());
        storeEmployee.setShift(request.shift());
        storeEmployee.setEmployeeType(request.employeeType());
        storeEmployee.setGender(request.gender());
        storeEmployee = storeEmployeeRepository.save(storeEmployee);

        return EmployeeResponse.from(storeEmployee);
    }

    @Transactional
    public void deleteEmployee(Long ownerId, Long id) {
        StoreEmployee storeEmployee = storeEmployeeRepository.findById(id)
            .orElseThrow(() -> new EmployeeNotFoundException("Employee not found"));

        if (!canManageEmployee(storeEmployee, ownerId)) {
            throw new EmployeeNotFoundException("Employee not found");
        }

        User employee = storeEmployee.getEmployee();
        sessionService.invalidateAllForUser(employee.getEmail());
        storeEmployeeRepository.delete(storeEmployee);
        userRepository.delete(employee);
    }

    @Transactional
    public void resetEmployeePassword(Long ownerId, Long id) {
        StoreEmployee storeEmployee = storeEmployeeRepository.findById(id)
            .orElseThrow(() -> new EmployeeNotFoundException("Employee not found"));

        if (!canManageEmployee(storeEmployee, ownerId)) {
            throw new EmployeeNotFoundException("Employee not found");
        }

        User employee = storeEmployee.getEmployee();
        String temporaryPassword = temporaryPasswordGenerator.generate();
        employee.setPasswordHash(passwordEncoder.encode(temporaryPassword));
        employee.setMustResetPassword(true);
        userRepository.save(employee);

        // The old password stops working the moment this runs, so any session
        // still holding a token issued against it is invalidated immediately
        // rather than staying valid until that token's own expiry.
        sessionService.invalidateAllForUser(employee.getEmail());

        // Thrown on failure, which rolls back the password change above -- an
        // employee must not be locked out of an account whose new password
        // they were never actually told.
        mailService.sendPasswordReset(employee.getEmail(), employee.getFullName(), temporaryPassword);
    }

    @Transactional
    public EmployeeResponse setEmployeeActive(Long ownerId, Long id, UpdateEmployeeStatusRequest request) {
        StoreEmployee storeEmployee = storeEmployeeRepository.findById(id)
            .orElseThrow(() -> new EmployeeNotFoundException("Employee not found"));

        if (!canManageEmployee(storeEmployee, ownerId)) {
            throw new EmployeeNotFoundException("Employee not found");
        }

        User employee = storeEmployee.getEmployee();
        employee.setActive(request.active());
        userRepository.save(employee);

        // Deactivation has to bite immediately: without this the employee keeps
        // working off the token they already hold until it expires.
        if (!request.active()) {
            sessionService.invalidateAllForUser(employee.getEmail());
        }

        return EmployeeResponse.from(storeEmployee);
    }
}
