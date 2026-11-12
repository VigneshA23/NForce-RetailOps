package com.nforce.retailops.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nforce.retailops.entity.PrincipalType;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.ActiveSessionRepository;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.SuperAdminRepository;
import com.nforce.retailops.repository.UserRepository;
import com.nforce.retailops.exception.InvalidSuperAdminStatusChangeException;
import com.nforce.retailops.security.SuperAdminUserDetails;
import com.nforce.retailops.service.SessionService;
import com.nforce.retailops.service.SuperAdminAccountService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Security audit VULN-10: Super Admin revocation. A deactivated Super Admin
// must fail isEnabled(), lose every active session immediately and be unable
// to log in again; only another active Super Admin may do this, never on
// themselves.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class SuperAdminAccountControllerTest {

    private static final String PASSWORD = "correct-horse-battery-staple";
    private static final String ACTOR = "sa-revoker@nforce.test";
    private static final String TARGET = "sa-revoked@nforce.test";

    @Autowired private MockMvc mockMvc;
    @Autowired private SuperAdminRepository superAdminRepository;
    @Autowired private ActiveSessionRepository activeSessionRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private SuperAdminAccountService accountService;
    @Autowired private SessionService sessionService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private SuperAdmin actor;
    private SuperAdmin target;
    private String actorToken;

    @BeforeEach
    void setUp() throws Exception {
        actor = superAdmin(ACTOR);
        target = superAdmin(TARGET);
        actorToken = login(ACTOR);
    }

    @Test
    void newSuperAdminsAreActiveAndEnabled() {
        assertThat(target.isActive()).isTrue();
        assertThat(new SuperAdminUserDetails(target).isEnabled()).isTrue();
    }

    @Test
    void deactivatingEndsEverySessionImmediatelyAndBlocksLogin() throws Exception {
        String targetPhone = login(TARGET);
        String targetLaptop = login(TARGET);
        assertThat(sessionsOf(TARGET)).isEqualTo(2);
        mockMvc.perform(get("/api/super-admin/super-admins").header("Authorization", "Bearer " + targetPhone))
            .andExpect(status().isOk());

        mockMvc.perform(patch("/api/super-admin/super-admins/" + target.getId() + "/status")
                .header("Authorization", "Bearer " + actorToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"active\":false}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.active").value(false));

        // Sessions gone, both tokens dead on their very next request.
        assertThat(sessionsOf(TARGET)).isZero();
        mockMvc.perform(get("/api/super-admin/super-admins").header("Authorization", "Bearer " + targetPhone))
            .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/super-admin/super-admins").header("Authorization", "Bearer " + targetLaptop))
            .andExpect(status().isUnauthorized());

        // isEnabled() reads the column, and a fresh login is refused.
        SuperAdmin reloaded = superAdminRepository.findById(target.getId()).orElseThrow();
        assertThat(new SuperAdminUserDetails(reloaded).isEnabled()).isFalse();
        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(loginBody(TARGET)))
            .andExpect(status().isUnauthorized());

        // The acting Super Admin is untouched.
        mockMvc.perform(get("/api/super-admin/super-admins").header("Authorization", "Bearer " + actorToken))
            .andExpect(status().isOk());
    }

    @Test
    void reactivatingLetsTheSuperAdminLogInAgain() throws Exception {
        patchStatus(target.getId(), false).andExpect(status().isOk());

        patchStatus(target.getId(), true)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.active").value(true));

        String fresh = login(TARGET);
        mockMvc.perform(get("/api/super-admin/super-admins").header("Authorization", "Bearer " + fresh))
            .andExpect(status().isOk());
    }

    @Test
    void aSuperAdminCannotDeactivateThemselves() throws Exception {
        patchStatus(actor.getId(), false)
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.message").value("You cannot deactivate your own Super Admin account"));

        assertThat(superAdminRepository.findById(actor.getId()).orElseThrow().isActive()).isTrue();
        mockMvc.perform(get("/api/super-admin/super-admins").header("Authorization", "Bearer " + actorToken))
            .andExpect(status().isOk());
    }

    @Test
    void unknownSuperAdminIs404() throws Exception {
        patchStatus(999_999L, false).andExpect(status().isNotFound());
    }

    @Test
    void ownerAdminCannotDeactivateASuperAdmin() throws Exception {
        Role ownerRole = roleRepository.findByName("OWNER_ADMIN").orElseGet(() -> {
            Role role = new Role();
            role.setName("OWNER_ADMIN");
            role.setDescription("OWNER_ADMIN");
            return roleRepository.save(role);
        });
        User owner = new User();
        owner.setEmail("sa-revoke-owner@nforce.test");
        owner.setPasswordHash(passwordEncoder.encode(PASSWORD));
        owner.setFullName("Owner");
        owner.getRoles().add(ownerRole);
        userRepository.save(owner);
        String ownerToken = login("sa-revoke-owner@nforce.test");

        mockMvc.perform(patch("/api/super-admin/super-admins/" + target.getId() + "/status")
                .header("Authorization", "Bearer " + ownerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"active\":false}"))
            .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/super-admin/super-admins").header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isForbidden());

        assertThat(superAdminRepository.findById(target.getId()).orElseThrow().isActive()).isTrue();
    }

    @Test
    void unauthenticatedCallIs401() throws Exception {
        mockMvc.perform(patch("/api/super-admin/super-admins/" + target.getId() + "/status")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"active\":false}"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void listShowsStatusWithoutSecrets() throws Exception {
        mockMvc.perform(get("/api/super-admin/super-admins").header("Authorization", "Bearer " + actorToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[?(@.email == '" + TARGET + "')].active").value(true))
            .andExpect(jsonPath("$[0].passwordHash").doesNotExist());
    }

    @Test
    void missingActiveFlagIsRejected() throws Exception {
        mockMvc.perform(patch("/api/super-admin/super-admins/" + target.getId() + "/status")
                .header("Authorization", "Bearer " + actorToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isBadRequest());
        assertThat(superAdminRepository.findById(target.getId()).orElseThrow().isActive()).isTrue();
    }

    // ---- race guards, exercised on the service directly --------------------

    @Test
    void anActorWhoWasJustDeactivatedCannotActAnyMore() {
        // Someone else revoked the actor a moment before this request ran.
        actor.setActive(false);
        superAdminRepository.saveAndFlush(actor);

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> accountService.setActive(actor.getId(), target.getId(), false))
            .isInstanceOf(InvalidSuperAdminStatusChangeException.class)
            .hasMessage("Your Super Admin account is no longer active");
        assertThat(superAdminRepository.findById(target.getId()).orElseThrow().isActive()).isTrue();
    }

    @Test
    void deactivatingAnAlreadyInactiveAccountStillClearsLeftoverSessions() {
        target.setActive(false);
        superAdminRepository.saveAndFlush(target);
        sessionService.createSession("leftover-token-id", TARGET, PrincipalType.SUPER_ADMIN, 60);
        assertThat(sessionsOf(TARGET)).isEqualTo(1);

        accountService.setActive(actor.getId(), target.getId(), false);

        assertThat(sessionsOf(TARGET)).isZero();
    }

    // ---- helpers -----------------------------------------------------------

    private org.springframework.test.web.servlet.ResultActions patchStatus(Long id, boolean active) throws Exception {
        return mockMvc.perform(patch("/api/super-admin/super-admins/" + id + "/status")
            .header("Authorization", "Bearer " + actorToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"active\":" + active + "}"));
    }

    private long sessionsOf(String email) {
        return activeSessionRepository.findAll().stream()
            .filter(s -> s.getPrincipalType() == PrincipalType.SUPER_ADMIN)
            .filter(s -> s.getSubjectEmail().equalsIgnoreCase(email))
            .count();
    }

    private SuperAdmin superAdmin(String email) {
        SuperAdmin sa = new SuperAdmin();
        sa.setName("SA " + email);
        sa.setEmail(email);
        sa.setPasswordHash(passwordEncoder.encode(PASSWORD));
        return superAdminRepository.save(sa);
    }

    private String loginBody(String email) throws Exception {
        return objectMapper.writeValueAsString(new LoginPayload(email, PASSWORD));
    }

    private String login(String email) throws Exception {
        String json = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(loginBody(email)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
        return objectMapper.readTree(json).get("token").asText();
    }

    private record LoginPayload(String email, String password) {}
}
