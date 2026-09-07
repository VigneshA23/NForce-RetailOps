package com.nforce.retailops.controller;

import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.LoginAttemptRepository;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.UserRepository;
import com.nforce.retailops.service.LoginRateLimitService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class LoginRateLimitTest {

    // NOT @Transactional — LoginRateLimitService commits its own transactions
    // independently (it is called from a non-transactional controller method).
    // Using @Transactional on the test would create an outer transaction that
    // wraps those commits, causing @BeforeEach cleanup to not see them.

    @Autowired private MockMvc mockMvc;
    @Autowired private LoginAttemptRepository loginAttemptRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private static final String TEST_EMAIL   = "ratelimit-test@nforce.test";
    private static final String OTHER_EMAIL  = "other-user@nforce.test";
    private static final String GOOD_PASS    = "correct-horse-battery-staple";
    private static final String BAD_PASS     = "wrong-password";

    @BeforeEach
    void setUp() {
        loginAttemptRepository.deleteAll();

        ensureUser(TEST_EMAIL, GOOD_PASS);
        ensureUser(OTHER_EMAIL, GOOD_PASS);
    }

    private void ensureUser(String email, String password) {
        if (userRepository.findByEmailWithRoles(email).isEmpty()) {
            Role role = roleRepository.findByName("EMPLOYEE").orElseGet(() -> {
                Role r = new Role();
                r.setName("EMPLOYEE");
                return roleRepository.save(r);
            });
            User user = new User();
            user.setFullName("Rate Limit Test User");
            user.setEmail(email);
            user.setPasswordHash(passwordEncoder.encode(password));
            user.getRoles().add(role);
            userRepository.save(user);
        }
    }

    // ── Core: exhaust limit, then get 429 ────────────────────────────────────

    @Test
    void exceedingFailedAttemptLimitReturns429() throws Exception {
        String body = loginBody(TEST_EMAIL, BAD_PASS);

        for (int i = 0; i < LoginRateLimitService.MAX_ATTEMPTS; i++) {
            mockMvc.perform(post("/api/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body))
                .andExpect(status().isUnauthorized());
        }

        // Next attempt must be blocked before the password is even checked.
        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isTooManyRequests())
            .andExpect(jsonPath("$.message").value(
                "Too many login attempts. Please try again in "
                + LoginRateLimitService.WINDOW_MINUTES + " minutes."
            ));
    }

    // ── Successful login resets the counter ───────────────────────────────────

    @Test
    void successfulLoginClearsFailedAttemptCounter() throws Exception {
        String badBody  = loginBody(TEST_EMAIL, BAD_PASS);
        String goodBody = loginBody(TEST_EMAIL, GOOD_PASS);

        // Accumulate MAX_ATTEMPTS - 1 failures (one under the limit).
        for (int i = 0; i < LoginRateLimitService.MAX_ATTEMPTS - 1; i++) {
            mockMvc.perform(post("/api/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(badBody))
                .andExpect(status().isUnauthorized());
        }

        // One successful login clears the counter.
        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(goodBody))
            .andExpect(status().isOk());

        // Counter reset: can now make MAX_ATTEMPTS new bad attempts without hitting 429.
        for (int i = 0; i < LoginRateLimitService.MAX_ATTEMPTS - 1; i++) {
            mockMvc.perform(post("/api/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(badBody))
                .andExpect(status().isUnauthorized());
        }
    }

    // ── Attempts against different emails don't interfere ────────────────────

    @Test
    void attemptsAgainstOneEmailDoNotAffectAnother() throws Exception {
        String testBody  = loginBody(TEST_EMAIL, BAD_PASS);
        String otherBody = loginBody(OTHER_EMAIL, BAD_PASS);

        // Exhaust the limit for TEST_EMAIL.
        for (int i = 0; i < LoginRateLimitService.MAX_ATTEMPTS; i++) {
            mockMvc.perform(post("/api/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(testBody))
                .andExpect(status().isUnauthorized());
        }
        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(testBody))
            .andExpect(status().isTooManyRequests());

        // OTHER_EMAIL is unaffected — bad credentials still return 401, not 429.
        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(otherBody))
            .andExpect(status().isUnauthorized());

        // OTHER_EMAIL correct credentials still work.
        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(loginBody(OTHER_EMAIL, GOOD_PASS)))
            .andExpect(status().isOk());
    }

    private static String loginBody(String email, String password) {
        return "{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}";
    }
}
