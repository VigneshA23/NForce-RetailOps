package com.nforce.retailops.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.repository.DailyCashEntryCorrectionRepository;
import com.nforce.retailops.repository.DailyCashEntryRepository;
import com.nforce.retailops.repository.NotificationRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.SuperAdminRepository;
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

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** A Super Admin corrects a past day's cash entry directly, with a reason. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class DailyCashCorrectionTest {

    private static final String PASSWORD = "correct-horse-battery-staple";

    @Autowired private MockMvc mockMvc;
    @Autowired private SuperAdminRepository superAdminRepository;
    @Autowired private StoreRepository storeRepository;
    @Autowired private StoreOwnerRepository storeOwnerRepository;
    @Autowired private DailyCashEntryRepository entryRepository;
    @Autowired private DailyCashEntryCorrectionRepository correctionRepository;
    @Autowired private NotificationRepository notificationRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private String token;
    private Long storeId;
    private final LocalDate day = LocalDate.now().minusDays(3);

    @BeforeEach
    void setUp() throws Exception {
        SuperAdmin sa = new SuperAdmin();
        sa.setName("Sam Super");
        sa.setEmail("cash-correct-sa@nforce.test");
        sa.setPasswordHash(passwordEncoder.encode(PASSWORD));
        superAdminRepository.save(sa);

        Store store = new Store();
        store.setName("Correction Store");
        store.setLocation("Main St");
        store.setStoreCode(97001L);
        store = storeRepository.save(store);
        StoreOwner link = new StoreOwner();
        link.setStore(store);
        link.setActive(false);
        storeOwnerRepository.save(link);
        storeId = store.getId();

        token = login("cash-correct-sa@nforce.test");
    }

    @Test
    void aCorrectionNeedsAReasonIsAuditedAndRecalculatesExpectedCash() throws Exception {
        save(body("500", null)).andExpect(status().isOk())
            .andExpect(jsonPath("$.correctedByName").doesNotExist());
        long notificationsBefore = notificationRepository.count();
        String expectedBefore = expected();

        // No reason: refused, nothing changes.
        save(body("650", "  ")).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("A reason is required to correct this entry"));
        assertThat(correctionRepository.count()).isZero();

        save(body("650", "Sales were keyed in twice"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalCashSales").value(650))
            .andExpect(jsonPath("$.correctedByName").value("Sam Super"))
            .andExpect(jsonPath("$.correctedAt").exists())
            .andExpect(jsonPath("$.history.length()").value(1))
            .andExpect(jsonPath("$.history[0].reason").value("Sales were keyed in twice"))
            .andExpect(jsonPath("$.history[0].previousTotalCashSales").value(500))
            .andExpect(jsonPath("$.history[0].newTotalCashSales").value(650))
            .andExpect(jsonPath("$.history[0].correctedByName").value("Sam Super"));

        // Still one row for the day (never deleted or duplicated), no notification,
        // and expected cash reflects the corrected sales.
        assertThat(entryRepository.findByStoreIdAndBusinessDate(storeId, day)).isPresent();
        assertThat(notificationRepository.count()).isEqualTo(notificationsBefore);
        assertThat(expected()).isNotEqualTo(expectedBefore);
    }

    private org.springframework.test.web.servlet.ResultActions save(String body) throws Exception {
        return mockMvc.perform(put("/api/super-admin/stores/" + storeId + "/cash")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
    }

    private String expected() throws Exception {
        String json = mockMvc.perform(get("/api/super-admin/stores/" + storeId + "/cash/expected")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(json).path("expectedCashOnHand").asText();
    }

    private String body(String sales, String reason) {
        return "{\"businessDate\":\"" + day + "\",\"totalCashSales\":" + sales
            + ",\"openingDrawerCash\":100,\"cashRemoved\":10,\"cashRemaining\":90,\"cashExpenses\":5,"
            + "\"bankDeposits\":20,\"otherAdjustments\":0"
            + (reason == null ? "" : ",\"correctionReason\":\"" + reason + "\"") + "}";
    }

    private String login(String email) throws Exception {
        String json = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(json).get("token").asText();
    }
}
