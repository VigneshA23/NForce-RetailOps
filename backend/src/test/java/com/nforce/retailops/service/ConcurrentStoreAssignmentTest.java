package com.nforce.retailops.service;

import com.nforce.retailops.dto.AssignStoreRequest;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.StoreAdminConflictException;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Two Super Admin "assign an admin to this store" requests for the same vacant
 * store, racing: exactly one wins and the other gets the same 409 a sequential
 * duplicate would. Not @Transactional -- each assign must commit in its own
 * transaction for the row lock to matter -- so it cleans up after itself.
 */
@SpringBootTest
@ActiveProfiles("test")
class ConcurrentStoreAssignmentTest {

    @Autowired private OwnerManagementService ownerManagementService;
    @Autowired private RoleRepository roleRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private StoreRepository storeRepository;
    @Autowired private StoreOwnerRepository storeOwnerRepository;
    @Autowired private TransactionTemplate transactionTemplate;

    private final List<Long> userIds = new ArrayList<>();
    private Long storeId;

    @AfterEach
    void cleanUp() {
        transactionTemplate.executeWithoutResult(status -> {
            if (storeId != null) {
                storeOwnerRepository.findByStoreId(storeId).ifPresent(storeOwnerRepository::delete);
                storeRepository.deleteById(storeId);
            }
            userIds.forEach(userRepository::deleteById);
        });
    }

    @Test
    void twoSimultaneousAssignsToOneStoreLetExactlyOneWin() throws Exception {
        Long[] ids = transactionTemplate.execute(status -> {
            Role ownerRole = roleRepository.findByName("OWNER_ADMIN").orElseGet(() -> {
                Role role = new Role();
                role.setName("OWNER_ADMIN");
                return roleRepository.save(role);
            });
            User a = newOwner("race-a@nforce.test", ownerRole);
            User b = newOwner("race-b@nforce.test", ownerRole);
            Store store = new Store();
            store.setName("Race Store");
            store.setLocation("Main St");
            store.setStoreCode(89001L);
            store = storeRepository.save(store);
            StoreOwner link = new StoreOwner();
            link.setStore(store);
            link.setActive(false);
            storeOwnerRepository.save(link);
            return new Long[] {a.getId(), b.getId(), store.getId()};
        });
        userIds.add(ids[0]);
        userIds.add(ids[1]);
        storeId = ids[2];

        AssignStoreRequest request = new AssignStoreRequest(null, null, storeId);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            List<Future<Object>> results = new ArrayList<>();
            for (Long ownerId : List.of(ids[0], ids[1])) {
                results.add(pool.submit(() -> {
                    start.await();
                    try {
                        return ownerManagementService.assignStore(ownerId, request);
                    } catch (StoreAdminConflictException ex) {
                        return ex;
                    }
                }));
            }
            start.countDown();

            int wins = 0;
            int conflicts = 0;
            for (Future<Object> result : results) {
                Object outcome = result.get(30, TimeUnit.SECONDS);
                if (outcome instanceof StoreAdminConflictException ex) {
                    assertThat(ex.getMessage()).isEqualTo("An admin is already assigned to this store");
                    conflicts++;
                } else {
                    wins++;
                }
            }
            assertThat(wins).isEqualTo(1);
            assertThat(conflicts).isEqualTo(1);
        } finally {
            pool.shutdownNow();
        }

        StoreOwner link = storeOwnerRepository.findByStoreId(storeId).orElseThrow();
        assertThat(link.isActive()).isTrue();
    }

    private User newOwner(String email, Role role) {
        User user = new User();
        user.setFullName("Racer " + email);
        user.setEmail(email);
        user.setPasswordHash("x");
        user.getRoles().add(role);
        return userRepository.save(user);
    }
}
