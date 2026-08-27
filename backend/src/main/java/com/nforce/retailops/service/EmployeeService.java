package com.nforce.retailops.service;

<<<<<<< Updated upstream
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
=======
import com.nforce.retailops.dto.CreateEmployeeRequest;
import com.nforce.retailops.dto.EmployeeResponse;
import com.nforce.retailops.dto.UpdateEmployeeRequest;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreEmployee;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.EmailAlreadyExistsException;
import com.nforce.retailops.exception.ResourceNotFoundException;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreRepository;
>>>>>>> Stashed changes
import com.nforce.retailops.repository.UserRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

<<<<<<< Updated upstream
=======
import java.util.Comparator;
>>>>>>> Stashed changes
import java.util.List;

@Service
public class EmployeeService {

    private static final String EMPLOYEE_ROLE_NAME = "EMPLOYEE";

<<<<<<< Updated upstream
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
=======
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final StoreRepository storeRepository;
    private final StoreEmployeeRepository storeEmployeeRepository;
    private final StoreAccessService storeAccessService;
    private final PasswordEncoder passwordEncoder;

    public EmployeeService(
        UserRepository userRepository,
        RoleRepository roleRepository,
        StoreRepository storeRepository,
        StoreEmployeeRepository storeEmployeeRepository,
        StoreAccessService storeAccessService,
        PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.storeRepository = storeRepository;
        this.storeEmployeeRepository = storeEmployeeRepository;
        this.storeAccessService = storeAccessService;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public List<EmployeeResponse> listEmployees(User admin) {
        List<Long> ownedStoreIds = storeAccessService.getOwnedStoreIds(admin);
        return storeEmployeeRepository.findByStore_IdIn(ownedStoreIds).stream()
            .sorted(Comparator.comparing(storeEmployee -> storeEmployee.getEmployee().getFullName()))
            .map(this::toResponse)
>>>>>>> Stashed changes
            .toList();
    }

    @Transactional
<<<<<<< Updated upstream
    public EmployeeResponse createEmployee(Long ownerId, EmployeeCreateRequest request) {
        Store store = resolveOwnerStore(ownerId, request.storeId());

        String email = request.email().trim();
        if (userRepository.findByEmailWithRoles(email).isPresent()) {
=======
    public EmployeeResponse createEmployee(User admin, CreateEmployeeRequest request) {
        Store store = storeAccessService.requireOwnedStore(admin, request.storeId());

        if (userRepository.findByEmailWithRoles(request.email()).isPresent()) {
>>>>>>> Stashed changes
            throw new EmailAlreadyExistsException("A user with this email already exists");
        }

        Role employeeRole = roleRepository.findByName(EMPLOYEE_ROLE_NAME)
            .orElseThrow(() -> new IllegalStateException(EMPLOYEE_ROLE_NAME + " role is not seeded"));

        User employee = new User();
<<<<<<< Updated upstream
        employee.setFullName(request.name().trim());
        employee.setEmail(email);
        employee.setPasswordHash(passwordEncoder.encode(request.password()));
=======
        employee.setFullName(request.fullName());
        employee.setEmail(request.email());
        employee.setPasswordHash(passwordEncoder.encode(request.password()));
        employee.setPhone(request.phone());
        employee.setShift(request.shift());
        employee.setEmploymentType(request.employmentType());
        employee.setGender(request.gender());
>>>>>>> Stashed changes
        employee.getRoles().add(employeeRole);
        employee = userRepository.save(employee);

        StoreEmployee storeEmployee = new StoreEmployee();
        storeEmployee.setStore(store);
        storeEmployee.setEmployee(employee);
<<<<<<< Updated upstream
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
=======
        storeEmployee = storeEmployeeRepository.save(storeEmployee);

        return toResponse(storeEmployee);
    }

    @Transactional
    public EmployeeResponse updateEmployee(User admin, Long employeeId, UpdateEmployeeRequest request) {
        StoreEmployee storeEmployee = requireOwnedEmployee(admin, employeeId);
        Store newStore = storeAccessService.requireOwnedStore(admin, request.storeId());

        User employee = storeEmployee.getEmployee();

        userRepository.findByEmailWithRoles(request.email())
            .filter(existing -> !existing.getId().equals(employee.getId()))
            .ifPresent(existing -> {
                throw new EmailAlreadyExistsException("A user with this email already exists");
            });

        employee.setFullName(request.fullName());
        employee.setEmail(request.email());
        employee.setPhone(request.phone());
        employee.setShift(request.shift());
        employee.setEmploymentType(request.employmentType());
        employee.setGender(request.gender());

        if (!storeEmployee.getStore().getId().equals(newStore.getId())) {
            storeEmployee.setStore(newStore);
        }

        return toResponse(storeEmployee);
    }

    @Transactional
    public EmployeeResponse updateStatus(User admin, Long employeeId, boolean active) {
        StoreEmployee storeEmployee = requireOwnedEmployee(admin, employeeId);
        storeEmployee.getEmployee().setActive(active);
        return toResponse(storeEmployee);
    }

    private StoreEmployee requireOwnedEmployee(User admin, Long employeeId) {
        StoreEmployee storeEmployee = storeEmployeeRepository.findByEmployee_Id(employeeId)
            .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));

        List<Long> ownedStoreIds = storeAccessService.getOwnedStoreIds(admin);
        if (!ownedStoreIds.contains(storeEmployee.getStore().getId())) {
            throw new AccessDeniedException("Employee does not belong to your stores");
        }

        return storeEmployee;
    }

    private EmployeeResponse toResponse(StoreEmployee storeEmployee) {
        User employee = storeEmployee.getEmployee();
        Store store = storeEmployee.getStore();
        return new EmployeeResponse(
            employee.getId(),
            "EMP-%03d".formatted(employee.getId()),
            employee.getFullName(),
            employee.getEmail(),
            employee.getPhone(),
            employee.getShift(),
            employee.getEmploymentType(),
            employee.getGender(),
            employee.isActive(),
            store.getId(),
            store.getName()
        );
>>>>>>> Stashed changes
    }
}
