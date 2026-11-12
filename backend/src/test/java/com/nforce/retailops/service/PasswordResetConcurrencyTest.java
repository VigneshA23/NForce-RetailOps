package com.nforce.retailops.service;

import com.nforce.retailops.entity.PasswordResetToken;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.InvalidPasswordResetTokenException;
import com.nforce.retailops.repository.PasswordResetTokenRepository;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.UserRepository;
import com.nforce.retailops.security.ResetTokenHashing;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;

/**
 * Not @Transactional on purpose: each thread must run in its own real
 * transaction for the races to be genuine.
 */
@SpringBootTest
@ActiveProfiles("test")
class PasswordResetConcurrencyTest {

    private static final int THREADS = 8;

    @Autowired private PasswordResetService passwordResetService;
    @Autowired private PasswordResetTokenRepository tokenRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private PlatformTransactionManager txManager;

    // Only a hash is stored (RTS-495), so raw tokens come from the reset links.
    @MockBean private MailService mailService;

    private User createUser(String email) {
        Role role = roleRepository.findByName("EMPLOYEE").orElseGet(() -> {
            Role r = new Role();
            r.setName("EMPLOYEE");
            return roleRepository.save(r);
        });
        User u = new User();
        u.setFullName("Concurrency Test User");
        u.setEmail(email);
        u.setPasswordHash(passwordEncoder.encode("original-password"));
        u.getRoles().add(role);
        return userRepository.save(u);
    }

    private void cleanup(String email, User user) {
        new TransactionTemplate(txManager).executeWithoutResult(status -> {
            tokenRepository.deleteByEmailIgnoreCase(email);
            userRepository.deleteById(user.getId());
        });
    }

    private <T> List<Future<T>> fireTogether(List<Callable<T>> tasks) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(tasks.size());
        CountDownLatch ready = new CountDownLatch(tasks.size());
        CountDownLatch go = new CountDownLatch(1);
        List<Future<T>> futures = new ArrayList<>();
        for (Callable<T> task : tasks) {
            futures.add(pool.submit(() -> {
                ready.countDown();
                go.await();
                return task.call();
            }));
        }
        ready.await(10, TimeUnit.SECONDS);
        go.countDown();
        pool.shutdown();
        pool.awaitTermination(60, TimeUnit.SECONDS);
        return futures;
    }

    @Test
    void concurrentConfirmWithSameTokenHasExactlyOneWinner() throws Exception {
        String email = "reset-concurrent-confirm-" + UUID.randomUUID() + "@nforce.test";
        User user = createUser(email);
        UUID token = UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.now();
        tokenRepository.save(new PasswordResetToken(email, ResetTokenHashing.hash(token), now, now.plusHours(1)));
        try {
            List<Callable<Boolean>> tasks = new ArrayList<>();
            for (int i = 0; i < THREADS; i++) {
                String pw = "new-password-" + i;
                tasks.add(() -> {
                    try {
                        passwordResetService.confirmReset(token.toString(), pw);
                        return true;
                    } catch (InvalidPasswordResetTokenException e) {
                        return false;
                    }
                });
            }
            int winners = 0;
            for (Future<Boolean> f : fireTogether(tasks)) {
                if (f.get()) winners++;
            }
            assertThat(winners).isEqualTo(1);
            assertThat(tokenRepository.findByTokenHash(ResetTokenHashing.hash(token)).orElseThrow().isUsed()).isTrue();
        } finally {
            cleanup(email, user);
        }
    }

    @Test
    void newResetRequestInvalidatesEarlierTokenAndNewOneStillWorks() {
        String email = "reset-supersede-" + UUID.randomUUID() + "@nforce.test";
        User user = createUser(email);
        try {
            passwordResetService.requestReset(email);
            String first = latestEmailedToken(email);
            passwordResetService.requestReset(email);

            assertThat(tokenRepository.findByTokenHash(ResetTokenHashing.hash(UUID.fromString(first)))
                .orElseThrow().isUsed()).isTrue();
            assertThatThrownBy(() -> passwordResetService.confirmReset(first, "brand-new-pass-1"))
                .isInstanceOf(InvalidPasswordResetTokenException.class);

            String second = latestEmailedToken(email);
            assertThat(second).isNotEqualTo(first);
            passwordResetService.confirmReset(second, "brand-new-pass-2");
        } finally {
            cleanup(email, user);
        }
    }

    // The raw token from the most recent reset link "emailed" to this address.
    private String latestEmailedToken(String email) {
        ArgumentCaptor<String> link = ArgumentCaptor.forClass(String.class);
        verify(mailService, atLeastOnce()).sendPasswordResetEmail(eq(email), any(), link.capture());
        String value = link.getValue();
        return value.substring(value.indexOf("?token=") + "?token=".length());
    }

    @Test
    void concurrentForgotPasswordRequestsIssueAtMostThreeTokensPerHour() throws Exception {
        String email = "reset-concurrent-request-" + UUID.randomUUID() + "@nforce.test";
        User user = createUser(email);
        try {
            List<Callable<Void>> tasks = new ArrayList<>();
            for (int i = 0; i < THREADS; i++) {
                tasks.add(() -> {
                    passwordResetService.requestReset(email);
                    return null;
                });
            }
            for (Future<Void> f : fireTogether(tasks)) f.get();

            long issued = tokenRepository.countByEmailSince(email, OffsetDateTime.now().minusHours(1));
            assertThat(issued).isEqualTo(3);
        } finally {
            cleanup(email, user);
        }
    }
}
