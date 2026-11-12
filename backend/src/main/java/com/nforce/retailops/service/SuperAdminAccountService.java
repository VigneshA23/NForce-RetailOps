package com.nforce.retailops.service;

import com.nforce.retailops.dto.SuperAdminAccountResponse;
import com.nforce.retailops.entity.PrincipalType;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.exception.InvalidSuperAdminStatusChangeException;
import com.nforce.retailops.exception.SuperAdminNotFoundException;
import com.nforce.retailops.repository.SuperAdminRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Super Admin revocation (security audit VULN-10) -- the first lifecycle
 * surface for the Super Admin principal.
 *
 * <p>Authorization model:
 * <ul>
 *   <li>Only an <b>active Super Admin</b> may deactivate or reactivate a
 *       Super Admin (controller is {@code hasRole('SUPER_ADMIN')}, and the
 *       acting account is re-checked as active under lock here).</li>
 *   <li>A Super Admin may <b>not deactivate themselves</b>.</li>
 *   <li>The <b>last active Super Admin can never be deactivated</b>, so the
 *       platform can't be left with nobody able to administer it.</li>
 * </ul>
 *
 * <p>Deactivation sets {@code active=false} (so {@code isEnabled()} fails on
 * the next request and login is refused) and ends every one of that Super
 * Admin's sessions at once via {@link SessionService#invalidateAllForUser},
 * scoped to {@link PrincipalType#SUPER_ADMIN} (RTS-476).
 */
@Service
public class SuperAdminAccountService {

    private static final Logger log = LoggerFactory.getLogger(SuperAdminAccountService.class);

    private final SuperAdminRepository superAdminRepository;
    private final SessionService sessionService;

    public SuperAdminAccountService(SuperAdminRepository superAdminRepository, SessionService sessionService) {
        this.superAdminRepository = superAdminRepository;
        this.sessionService = sessionService;
    }

    @Transactional(readOnly = true)
    public List<SuperAdminAccountResponse> list() {
        return superAdminRepository.findAllByOrderByNameAscIdAsc().stream()
            .map(SuperAdminAccountResponse::from)
            .toList();
    }

    @Transactional
    public SuperAdminAccountResponse setActive(Long actingSuperAdminId, Long targetId, boolean active) {
        // Lock first, then decide: a concurrent deactivation of the acting
        // account (or of the other remaining active one) is seen here.
        List<SuperAdmin> activeSuperAdmins = superAdminRepository.findAllActiveForUpdate();
        boolean actorActive = activeSuperAdmins.stream().anyMatch(s -> s.getId().equals(actingSuperAdminId));
        if (!actorActive) {
            throw new InvalidSuperAdminStatusChangeException("Your Super Admin account is no longer active");
        }

        SuperAdmin target = superAdminRepository.findById(targetId)
            .orElseThrow(() -> new SuperAdminNotFoundException("Super Admin not found"));

        if (!active) {
            if (target.getId().equals(actingSuperAdminId)) {
                throw new InvalidSuperAdminStatusChangeException("You cannot deactivate your own Super Admin account");
            }
            boolean targetActive = activeSuperAdmins.stream().anyMatch(s -> s.getId().equals(targetId));
            if (targetActive && activeSuperAdmins.size() <= 1) {
                throw new InvalidSuperAdminStatusChangeException("At least one Super Admin must remain active");
            }
        }

        if (target.isActive() != active) {
            target.setActive(active);
            superAdminRepository.save(target);
            log.info("Super Admin {} {} by Super Admin {}",
                target.getId(), active ? "reactivated" : "deactivated", actingSuperAdminId);
        }
        if (!active) {
            // Always, even if already inactive: guarantees no session survives.
            sessionService.invalidateAllForUser(target.getEmail(), PrincipalType.SUPER_ADMIN);
        }
        return SuperAdminAccountResponse.from(target);
    }
}
