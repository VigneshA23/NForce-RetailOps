package com.nforce.retailops.controller;

import com.nforce.retailops.dto.CategoryReorderRequest;
import com.nforce.retailops.dto.CategoryRequest;
import com.nforce.retailops.dto.CategoryResponse;
import com.nforce.retailops.dto.CategoryStatusRequest;
import com.nforce.retailops.security.AppUserDetails;
import com.nforce.retailops.service.CategoryService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/categories")
@PreAuthorize("hasAnyRole('OWNER_ADMIN', 'SUPER_ADMIN')")
public class CategoryController {

    private final CategoryService categoryService;

    public CategoryController(CategoryService categoryService) {
        this.categoryService = categoryService;
    }

    // Shared by both roles: Owner Admin gets their store-scoped read-only
    // view, Super Admin gets every category platform-wide.
    @GetMapping
    public ResponseEntity<List<CategoryResponse>> list(Authentication authentication) {
        if (authentication.getPrincipal() instanceof AppUserDetails appUserDetails) {
            return ResponseEntity.ok(categoryService.listCategories(appUserDetails.getUser().getId()));
        }
        return ResponseEntity.ok(categoryService.listCategoriesForSuperAdmin());
    }

    @PostMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<CategoryResponse> create(@Valid @RequestBody CategoryRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(categoryService.createCategoryAsSuperAdmin(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<CategoryResponse> update(
        @PathVariable Long id,
        @Valid @RequestBody CategoryRequest request
    ) {
        return ResponseEntity.ok(categoryService.updateCategoryAsSuperAdmin(id, request));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<CategoryResponse> updateStatus(
        @PathVariable Long id,
        @Valid @RequestBody CategoryStatusRequest request
    ) {
        return ResponseEntity.ok(categoryService.setActiveAsSuperAdmin(id, request.active()));
    }

    // Pre-existing, Owner-Admin-only, untouched by this feature -- see plan's
    // Global Constraints. No frontend caller today.
    @PatchMapping("/reorder")
    @PreAuthorize("hasRole('OWNER_ADMIN')")
    public ResponseEntity<List<CategoryResponse>> reorder(
        @AuthenticationPrincipal AppUserDetails principal,
        @Valid @RequestBody CategoryReorderRequest request
    ) {
        return ResponseEntity.ok(categoryService.reorderCategories(principal.getUser().getId(), request.orderedIds()));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        categoryService.deleteCategoryAsSuperAdmin(id);
        return ResponseEntity.noContent().build();
    }
}
