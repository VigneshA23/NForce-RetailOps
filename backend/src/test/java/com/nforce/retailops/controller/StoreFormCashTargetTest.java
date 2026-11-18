package com.nforce.retailops.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.repository.StoreCashTargetRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.SuperAdminRepository;
import com.nforce.retailops.service.StoreCashTargetService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.reset;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The Super Admin store create/edit forms carry the store's cash target. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class StoreFormCashTargetTest {

    private static final String PASSWORD = "correct-horse-battery-staple";

    @Autowired private MockMvc mockMvc;
    @Autowired private SuperAdminRepository superAdminRepository;
    @Autowired private StoreRepository storeRepository;
    @Autowired private StoreCashTargetRepository storeCashTargetRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @SpyBean private StoreCashTargetService storeCashTargetService;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private String token;

    @BeforeEach
    void setUp() throws Exception {
        reset(storeCashTargetService);
        // Reused if present: the rollback test below runs outside a test
        // transaction, so its Super Admin row is committed.
        boolean exists = superAdminRepository.findAll().stream()
            .anyMatch(existing -> "cash-target-sa@nforce.test".equals(existing.getEmail()));
        if (!exists) {
            SuperAdmin sa = new SuperAdmin();
            sa.setName("Cash Target SA");
            sa.setEmail("cash-target-sa@nforce.test");
            sa.setPasswordHash(passwordEncoder.encode(PASSWORD));
            superAdminRepository.save(sa);
        }
        token = login("cash-target-sa@nforce.test");
    }

    @Test
    void creatingAStoreSavesItsCashTarget() throws Exception {
        long storeId = create("Target Store", "1 High St", "175.25");

        assertThat(storeCashTargetRepository.findAmountByStoreId(storeId)).isEqualByComparingTo("175.25");
        mockMvc.perform(get("/api/super-admin/stores/" + storeId + "/cash-target").header("Authorization", bearer()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.targetAmount").value(175.25));
        mockMvc.perform(get("/api/stores/all").header("Authorization", bearer()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[?(@.storeId==" + storeId + ")].cashTarget").value(175.25));
    }

    @Test
    void zeroIsAValidCashTarget() throws Exception {
        long storeId = create("Zero Target Store", "2 High St", "0");
        assertThat(storeCashTargetRepository.findAmountByStoreId(storeId)).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void aMissingNegativeTooPreciseOrNonNumericCashTargetIsRejectedAndNothingIsSaved() throws Exception {
        long before = storeRepository.count();
        String[] bodies = {
            "{\"name\":\"Bad Target\",\"location\":\"X\"}",
            "{\"name\":\"Bad Target\",\"location\":\"X\",\"cashTarget\":null}",
            "{\"name\":\"Bad Target\",\"location\":\"X\",\"cashTarget\":-1}",
            "{\"name\":\"Bad Target\",\"location\":\"X\",\"cashTarget\":10.555}",
            "{\"name\":\"Bad Target\",\"location\":\"X\",\"cashTarget\":\"abc\"}",
        };
        for (String body : bodies) {
            mockMvc.perform(post("/api/stores").header("Authorization", bearer())
                    .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
        }
        assertThat(storeRepository.count()).isEqualTo(before);
    }

    // Outside a test transaction, so the request's own transaction really
    // commits or rolls back and the result is visible here.
    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void ifTheCashTargetCannotBeSavedTheStoreIsNotCreatedEither() throws Exception {
        long before = storeRepository.count();
        doThrow(new IllegalStateException("target store failed"))
            .when(storeCashTargetService).updateForSuperAdmin(anyLong(), anyLong(), any());

        mockMvc.perform(post("/api/stores").header("Authorization", bearer())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Rolled Back\",\"location\":\"Y\",\"cashTarget\":100}"))
            .andExpect(status().is5xxServerError());

        assertThat(storeRepository.count()).isEqualTo(before);
        assertThat(storeRepository.findAll()).noneMatch(store -> "Rolled Back".equals(store.getName()));
    }

    @Test
    void editingAStoreShowsAndChangesItsCashTarget() throws Exception {
        long storeId = create("Edit Target Store", "3 High St", "150");

        mockMvc.perform(put("/api/stores/" + storeId).header("Authorization", bearer())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Edit Target Store\",\"location\":\"3 High St\",\"cashTarget\":320.40}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.cashTarget").value(320.40));
        assertThat(storeCashTargetRepository.findAmountByStoreId(storeId)).isEqualByComparingTo("320.40");

        // Rename-only (no cashTarget) leaves the target alone; a negative one is refused.
        mockMvc.perform(put("/api/stores/" + storeId).header("Authorization", bearer())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Renamed Target Store\",\"location\":\"3 High St\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.cashTarget").value(320.40));
        mockMvc.perform(put("/api/stores/" + storeId).header("Authorization", bearer())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Renamed Target Store\",\"location\":\"3 High St\",\"cashTarget\":-5}"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void aStoreWithACashTargetCanStillBeDeleted() throws Exception {
        long storeId = create("Deletable Store", "4 High St", "99.99");

        mockMvc.perform(delete("/api/stores/" + storeId).header("Authorization", bearer()))
            .andExpect(status().isNoContent());

        assertThat(storeRepository.findById(storeId)).isEmpty();
        assertThat(storeCashTargetRepository.findByStoreId(storeId)).isEmpty();
    }

    private long create(String name, String location, String cashTarget) throws Exception {
        String json = mockMvc.perform(post("/api/stores").header("Authorization", bearer())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"" + name + "\",\"location\":\"" + location + "\",\"cashTarget\":" + cashTarget + "}"))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(json).get("storeId").asLong();
    }

    private String login(String email) throws Exception {
        String json = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(json).get("token").asText();
    }

    private String bearer() {
        return "Bearer " + token;
    }
}
