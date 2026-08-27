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

import java.util.List;

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

    // An owner can now have multiple stores, so "the owner's store" no longer
    // makes sense - callers must say which store, and we verify they own it.
    private Store resolveOwnerStore(Long ownerId, Long storeId) {
        return storeOwnerRepository.findByStoreIdAndOwnerId(storeId, ownerId)
            .map(StoreOwner::getStore)
            .orElseThrow(() -> new AccessDeniedException("You cannot assign employees to another store"));
    }

    @Transactional(readOnly = true)
    public List<EmployeeResponse> listEmployees(Long ownerId) {
        return storeOwnerRepository.findByOwnerId(ownerId).stream()
            .map(StoreOwner::getStore)
            .flatMap(store -> storeEmployeeRepository.findByStoreIdOrderByIdAsc(store.getId()).stream())
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
        Store store = resolveOwnerStore(ownerId, request.storeId());

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
        storeEmployee.setStore(store);
        storeEmployee.setEmployee(employee);
        storeEmployee.setPhone(request.phone().trim());
        storeEmployee.setShift(request.shift());
        storeEmployee.setEmployeeType(request.employeeType());
        storeEmployee.setGender(request.gender());
        storeEmployee = storeEmployeeRepository.save(storeEmployee);

        return EmployeeResponse.from(storeEmployee);
    }

    @Transactional
    public EmployeeResponse updateEmployee(Long ownerId, Long id, EmployeeUpdateRequest request) {
        Store store = resolveOwnerStore(ownerId, request.storeId());

        StoreEmployee storeEmployee = storeEmployeeRepository.findByIdAndStoreId(id, store.getId())
            .orElseThrow(() -> new EmployeeNotFoundException("Employee not found"));

        String email = request.email().trim();
        User employee = storeEmployee.getEmployee();
        if (!employee.getEmail().equalsIgnoreCase(email)
            && userRepository.findByEmailWithRoles(email).isPresent()) {
            throw new EmailAlreadyExistsException("A user with this email already exists");
        }

        employee.setFullName(request.name().trim());
        employee.setEmail(email);
        userRepository.save(employee);

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

        boolean ownsStore = storeOwnerRepository
            .findByStoreIdAndOwnerId(storeEmployee.getStore().getId(), ownerId)
            .isPresent();
        if (!ownsStore) {
            throw new EmployeeNotFoundException("Employee not found");
        }

        User employee = storeEmployee.getEmployee();
        storeEmployeeRepository.delete(storeEmployee);
        userRepository.delete(employee);
    }
}
