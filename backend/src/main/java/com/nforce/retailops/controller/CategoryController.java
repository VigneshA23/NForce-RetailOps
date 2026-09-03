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
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/categories")
@PreAuthorize("hasRole('OWNER_ADMIN')")
public class CategoryController {

    private final CategoryService categoryService;

    public CategoryController(CategoryService categoryService) {
        this.categoryService = categoryService;
    }

    @GetMapping
    public ResponseEntity<List<CategoryResponse>> list(@AuthenticationPrincipal AppUserDetails principal) {
        return ResponseEntity.ok(categoryService.listCategories(principal.getUser().getId()));
    }

    @PostMapping
    public ResponseEntity<CategoryResponse> create(
        @AuthenticationPrincipal AppUserDetails principal,
        @Valid @RequestBody CategoryRequest request
    ) {
        CategoryResponse created = categoryService.createCategory(principal.getUser().getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<CategoryResponse> update(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long id,
        @Valid @RequestBody CategoryRequest request
    ) {
        return ResponseEntity.ok(categoryService.updateCategory(principal.getUser().getId(), id, request));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<CategoryResponse> updateStatus(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long id,
        @Valid @RequestBody CategoryStatusRequest request
    ) {
        return ResponseEntity.ok(categoryService.setActive(principal.getUser().getId(), id, request.active()));
    }

    @PatchMapping("/reorder")
    public ResponseEntity<List<CategoryResponse>> reorder(
        @AuthenticationPrincipal AppUserDetails principal,
        @Valid @RequestBody CategoryReorderRequest request
    ) {
        return ResponseEntity.ok(categoryService.reorderCategories(principal.getUser().getId(), request.orderedIds()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long id
    ) {
        categoryService.deleteCategory(principal.getUser().getId(), id);
        return ResponseEntity.noContent().build();
    }
}
