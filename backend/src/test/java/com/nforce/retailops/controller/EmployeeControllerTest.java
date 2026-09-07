package com.nforce.retailops.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreEmployee;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class EmployeeControllerTest {

    private static final String PASSWORD = "correct-horse-battery-staple";

    @Autowired private MockMvc mockMvc;
    @Autowired private RoleRepository roleRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private StoreEmployeeRepository storeEmployeeRepository;
    @Autowired private StoreRepository storeRepository;
    @Autowired private StoreOwnerRepository storeOwnerRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @Transactional
    void ownerAdminCannotListAllEmployees() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        user("employee-all-denied@nforce.test", ownerRole);

        String token = login("employee-all-denied@nforce.test");

        mockMvc.perform(get("/api/employees/all")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void superAdminCanListAllEmployeesAcrossOwners() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role employeeRole = role("EMPLOYEE");
        Role superRole = role("SUPER_ADMIN");
        User owner = user("employee-all-owner@nforce.test", ownerRole);
        User employeeUser = user("employee-all-worker@nforce.test", employeeRole);
        employeeUser.setFullName("Directory Test Employee");
        userRepository.save(employeeUser);
        user("employee-all-super@nforce.test", superRole);

        StoreEmployee storeEmployee = new StoreEmployee();
        storeEmployee.setEmployee(employeeUser);
        storeEmployee.setCreatedByOwner(owner);
        storeEmployee.setPhone("555-0100");
        storeEmployee.setShift("Morning");
        storeEmployee.setEmployeeType("Full Time");
        storeEmployee.setGender("Female");
        storeEmployeeRepository.save(storeEmployee);

        String token = login("employee-all-super@nforce.test");

        mockMvc.perform(get("/api/employees/all")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[*].name", hasItem("Directory Test Employee")))
            .andExpect(jsonPath("$[*].ownerName", hasItem("Test User")));
    }

    @Test
    @Transactional
    void ownerAdminCannotCreateAnEmployee() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        user("employee-create-denied@nforce.test", ownerRole);

        String token = login("employee-create-denied@nforce.test");

        mockMvc.perform(post("/api/employees")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"name":"Nope","email":"nope@nforce.test","phone":"555-0100",\
                    "shift":"Morning","employeeType":"Full Time","gender":"Female"}"""))
            .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void ownerAdminSeesAnUnassignedEmployeeInTheDirectoryAndCanAssignAndUnassignTheirStore() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role employeeRole = role("EMPLOYEE");
        User owner = user("assign-owner@nforce.test", ownerRole);
        Store store = store("Assign Test Store", 8100L);
        linkOwnerToStore(owner, store);

        User employeeUser = user("assign-worker@nforce.test", employeeRole);
        employeeUser.setFullName("Directory Employee");
        userRepository.save(employeeUser);
        StoreEmployee storeEmployee = new StoreEmployee();
        storeEmployee.setEmployee(employeeUser);
        storeEmployee.setPhone("555-0199");
        storeEmployee.setShift("Morning");
        storeEmployee.setEmployeeType("Full Time");
        storeEmployee.setGender("Female");
        storeEmployee = storeEmployeeRepository.save(storeEmployee);

        String token = login("assign-owner@nforce.test");

        mockMvc.perform(get("/api/employees/directory")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[*].name", hasItem("Directory Employee")))
            .andExpect(jsonPath("$[?(@.name=='Directory Employee')].assignedToMyStore", hasItem(false)));

        mockMvc.perform(post("/api/employees/" + storeEmployee.getId() + "/assignment")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.stores[*].name", hasItem("Assign Test Store")));

        mockMvc.perform(get("/api/employees")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[*].name", hasItem("Directory Employee")));

        mockMvc.perform(delete("/api/employees/" + storeEmployee.getId() + "/assignment")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.stores").isEmpty());
    }

    @Test
    @Transactional
    void ownerAdminCannotHardDeleteAnEmployee() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role employeeRole = role("EMPLOYEE");
        User owner = user("delete-denied-owner@nforce.test", ownerRole);
        User employeeUser = user("delete-denied-worker@nforce.test", employeeRole);
        StoreEmployee storeEmployee = new StoreEmployee();
        storeEmployee.setEmployee(employeeUser);
        storeEmployee.setCreatedByOwner(owner);
        storeEmployee.setPhone("555-0201");
        storeEmployee.setShift("Morning");
        storeEmployee.setEmployeeType("Full Time");
        storeEmployee.setGender("Female");
        storeEmployee = storeEmployeeRepository.save(storeEmployee);

        String token = login("delete-denied-owner@nforce.test");

        mockMvc.perform(delete("/api/employees/" + storeEmployee.getId())
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void superAdminCanHardDeleteAnEmployee() throws Exception {
        Role superRole = role("SUPER_ADMIN");
        Role employeeRole = role("EMPLOYEE");
        user("delete-super@nforce.test", superRole);
        User employeeUser = user("delete-target-worker@nforce.test", employeeRole);
        StoreEmployee storeEmployee = new StoreEmployee();
        storeEmployee.setEmployee(employeeUser);
        storeEmployee.setPhone("555-0202");
        storeEmployee.setShift("Morning");
        storeEmployee.setEmployeeType("Full Time");
        storeEmployee.setGender("Female");
        storeEmployee = storeEmployeeRepository.save(storeEmployee);

        String token = login("delete-super@nforce.test");

        mockMvc.perform(delete("/api/employees/" + storeEmployee.getId())
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isNoContent());
    }

    @Test
    @Transactional
    void aSecondOwnerCanAssignTheirStoreToAnEmployeeAlreadyAssignedElsewhere() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role employeeRole = role("EMPLOYEE");
        User ownerA = user("shared-owner-a@nforce.test", ownerRole);
        User ownerB = user("shared-owner-b@nforce.test", ownerRole);
        linkOwnerToStore(ownerA, store("Shared Store A", 8101L));
        linkOwnerToStore(ownerB, store("Shared Store B", 8102L));

        User employeeUser = user("shared-worker@nforce.test", employeeRole);
        employeeUser.setFullName("Shared Employee");
        userRepository.save(employeeUser);
        StoreEmployee storeEmployee = new StoreEmployee();
        storeEmployee.setEmployee(employeeUser);
        storeEmployee.setPhone("555-0198");
        storeEmployee.setShift("Morning");
        storeEmployee.setEmployeeType("Full Time");
        storeEmployee.setGender("Female");
        storeEmployee = storeEmployeeRepository.save(storeEmployee);

        String tokenA = login("shared-owner-a@nforce.test");
        String tokenB = login("shared-owner-b@nforce.test");

        mockMvc.perform(post("/api/employees/" + storeEmployee.getId() + "/assignment")
                .header("Authorization", "Bearer " + tokenA))
            .andExpect(status().isOk());

        mockMvc.perform(post("/api/employees/" + storeEmployee.getId() + "/assignment")
                .header("Authorization", "Bearer " + tokenB))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.stores[*].name", hasItem("Shared Store A")))
            .andExpect(jsonPath("$.stores[*].name", hasItem("Shared Store B")));
    }

    private Store store(String name, long storeCode) {
        Store store = new Store();
        store.setName(name);
        store.setStoreCode(storeCode);
        store.setActive(true);
        return storeRepository.save(store);
    }

    private void linkOwnerToStore(User owner, Store store) {
        StoreOwner storeOwner = new StoreOwner();
        storeOwner.setOwner(owner);
        storeOwner.setStore(store);
        storeOwnerRepository.save(storeOwner);
    }

    private Role role(String name) {
        return roleRepository.findByName(name).orElseGet(() -> {
            Role role = new Role();
            role.setName(name);
            role.setDescription(name);
            return roleRepository.save(role);
        });
    }

    private User user(String email, Role role) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(PASSWORD));
        user.setFullName("Test User");
        user.getRoles().add(role);
        return userRepository.save(user);
    }

    private String login(String email) throws Exception {
        String body = objectMapper.writeValueAsString(new LoginPayload(email, PASSWORD));
        String responseJson = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
        return objectMapper.readTree(responseJson).get("token").asText();
    }

    private record LoginPayload(String email, String password) {}
}
