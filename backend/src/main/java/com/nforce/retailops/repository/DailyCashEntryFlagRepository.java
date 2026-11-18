package com.nforce.retailops.repository;

import com.nforce.retailops.entity.DailyCashEntryFlag;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface DailyCashEntryFlagRepository extends JpaRepository<DailyCashEntryFlag, Long> {

    // The single open flag for the entry, or empty if none. Enforced by the
    // partial unique index uq_daily_cash_entry_flags_one_open (V116), so the
    // "first" qualifier is defensive.
    Optional<DailyCashEntryFlag> findFirstByEntryIdAndResolvedAtIsNull(Long entryId);

    List<DailyCashEntryFlag> findByEntryIdInOrderByFlaggedAtAscIdAsc(Collection<Long> entryIds);
}
