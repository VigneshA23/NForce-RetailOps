package com.nforce.retailops.controller;

import com.nforce.retailops.dto.InventoryUnitRequest;
import com.nforce.retailops.dto.InventoryUnitResponse;
import com.nforce.retailops.entity.InventoryUnit;
import com.nforce.retailops.exception.InventoryUnitExistsException;
import com.nforce.retailops.repository.InventoryUnitRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;

// Custom inventory units. Any signed-in user reads the list (every role needs
// to know which units take whole numbers only); only Super Admin adds to it.
@RestController
@RequestMapping("/api/inventory-units")
public class InventoryUnitController {

    // The built-in options in the frontend's inventoryUnits.ts.
    private static final Set<String> BUILT_IN = Set.of("g", "kg", "ml", "l", "nos", "nos.");

    private final InventoryUnitRepository inventoryUnitRepository;

    public InventoryUnitController(InventoryUnitRepository inventoryUnitRepository) {
        this.inventoryUnitRepository = inventoryUnitRepository;
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    @Transactional(readOnly = true)
    public List<InventoryUnitResponse> list() {
        return inventoryUnitRepository.findAllByOrderByNameAsc().stream()
                .map(u -> new InventoryUnitResponse(u.getId(), u.getName(), u.isWholeNumber()))
                .toList();
    }

    @PostMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Transactional
    public ResponseEntity<InventoryUnitResponse> create(@Valid @RequestBody InventoryUnitRequest request) {
        String name = request.name().trim();
        if (BUILT_IN.contains(name.toLowerCase()) || inventoryUnitRepository.existsByNameIgnoreCase(name)) {
            throw new InventoryUnitExistsException("A unit named \"" + name + "\" already exists");
        }
        InventoryUnit unit = new InventoryUnit();
        unit.setName(name);
        unit.setWholeNumber(request.wholeNumber());
        InventoryUnit saved = inventoryUnitRepository.save(unit);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new InventoryUnitResponse(saved.getId(), saved.getName(), saved.isWholeNumber()));
    }
}
