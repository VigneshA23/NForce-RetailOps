package com.nforce.retailops.controller;

import com.nforce.retailops.dto.UnsplashPhotoResponse;
import com.nforce.retailops.entity.InventoryItemImage;
import com.nforce.retailops.exception.InventoryItemImageNotFoundException;
import com.nforce.retailops.repository.InventoryItemImageRepository;
import com.nforce.retailops.service.InventoryImageAccessService;
import com.nforce.retailops.service.UnsplashService;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.TimeUnit;

// Inventory item display images: Unsplash search for the add/edit form's
// picker (Super Admin + Owner/Admin), and serving a stored image's bytes
// (employees see them on the stock check). Unsplash stock photos are open to
// any signed-in user, but an owner-uploaded photo is store data: it is only
// served to that store's Owner/Admin and employees and to Super Admin
// (InventoryImageAccessService; anyone else gets a 404).
@RestController
@RequestMapping("/api/inventory-images")
public class InventoryImageController {

    private final UnsplashService unsplashService;
    private final InventoryItemImageRepository inventoryItemImageRepository;
    private final InventoryImageAccessService inventoryImageAccessService;

    public InventoryImageController(
            UnsplashService unsplashService,
            InventoryItemImageRepository inventoryItemImageRepository,
            InventoryImageAccessService inventoryImageAccessService) {
        this.unsplashService = unsplashService;
        this.inventoryItemImageRepository = inventoryItemImageRepository;
        this.inventoryImageAccessService = inventoryImageAccessService;
    }

    @GetMapping("/search")
    @PreAuthorize("hasAnyRole('OWNER_ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<List<UnsplashPhotoResponse>> search(
            @RequestParam String query,
            @RequestParam(defaultValue = "10") int perPage) {
        String trimmed = query.trim();
        if (trimmed.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }
        return ResponseEntity.ok(unsplashService.search(trimmed, perPage));
    }

    // Image rows are immutable (a new pick gets a new id), so the browser
    // can cache each one indefinitely.
    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    @Transactional(readOnly = true)
    public ResponseEntity<byte[]> image(@AuthenticationPrincipal Object principal, @PathVariable Long id) {
        InventoryItemImage image = inventoryItemImageRepository.findById(id)
                .orElseThrow(() -> new InventoryItemImageNotFoundException("Image not found"));
        inventoryImageAccessService.requireReadable(principal, image);
        // content_type is NOT NULL in the schema (V78); requireNonNull documents that invariant.
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(Objects.requireNonNull(image.getContentType())))
                .cacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePrivate().immutable())
                .body(image.getData());
    }
}
