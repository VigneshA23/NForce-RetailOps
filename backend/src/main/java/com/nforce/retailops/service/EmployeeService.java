package com.nforce.retailops.service;

import com.nforce.retailops.dto.EmployeeCreateRequest;
import com.nforce.retailops.dto.EmployeeResponse;
import com.nforce.retailops.dto.EmployeeUpdateRequest;
import com.nforce.retailops.dto.StoreOptionResponse;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreEmployee;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.EmailAlreadyExistsException;
import com.nforce.retailops.exception.EmployeeNotFoundException;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.UserRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class EmployeeService {

    private static final String EMPLOYEE_ROLE_NAME = "EMPLOYEE";

    private final StoreEmployeeRepository storeEmployeeRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    public EmployeeService(
        StoreEmployeeRepository storeEmployeeRepository,
        StoreOwnerRepository storeOwnerRepository,
        UserRepository userRepository,
        RoleRepository roleRepository,
        PasswordEncoder passwordEncoder
    ) {
        this.storeEmployeeRepository = storeEmployeeRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
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
            Store store = storeOwnerRepository.findByStoreIdAndOwnerId(storeId, ownerId)
                .map(StoreOwner::getStore)
                .orElseThrow(() -> new AccessDeniedException("You cannot assign employees to another store"));
            stores.add(store);
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
        List<Long> storeIds = storeOwnerRepository.findByOwnerId(ownerId).stream()
            .map(StoreOwner::getStore)
            .map(Store::getId)
            .toList();

        Map<Long, StoreEmployee> employeesById = new LinkedHashMap<>();
        if (!storeIds.isEmpty()) {
            for (StoreEmployee storeEmployee : storeEmployeeRepository.findDistinctByStoresIdInOrderByIdAsc(storeIds)) {
                employeesById.put(storeEmployee.getId(), storeEmployee);
            }
        }
        for (StoreEmployee storeEmployee : storeEmployeeRepository.findByCreatedByOwnerId(ownerId)) {
            employeesById.putIfAbsent(storeEmployee.getId(), storeEmployee);
        }

        return employeesById.values().stream()
            .sorted(Comparator.comparing(StoreEmployee::getId))
            .map(EmployeeResponse::from)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<StoreOptionResponse> listAssignableStores(Long ownerId) {
        return storeOwnerRepository.findByOwnerId(ownerId).stream()
            .map(StoreOwner::getStore)
            .map(StoreOptionResponse::from)
            .toList();
    }

    @Transactional
    public EmployeeResponse createEmployee(Long ownerId, EmployeeCreateRequest request) {
        Set<Store> stores = resolveOwnerStores(ownerId, request.storeIds());

        String email = request.email().trim();
        if (userRepository.findByEmailWithRoles(email).isPresent()) {
            throw new EmailAlreadyExistsException("A user with this email already exists");
        }

        Role employeeRole = roleRepository.findByName(EMPLOYEE_ROLE_NAME)
            .orElseThrow(() -> new IllegalStateException(EMPLOYEE_ROLE_NAME + " role is not seeded"));

        User employee = new User();
        employee.setFullName(request.name().trim());
        employee.setEmail(email);
        employee.setPasswordHash(passwordEncoder.encode(request.password()));
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

        return EmployeeResponse.from(storeEmployee);
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
        storeEmployeeRepository.delete(storeEmployee);
        userRepository.delete(employee);
    }
}
