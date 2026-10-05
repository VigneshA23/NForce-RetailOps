package com.nforce.retailops.controller;

import com.nforce.retailops.dto.UnsplashPhotoResponse;
import com.nforce.retailops.entity.InventoryItemImage;
import com.nforce.retailops.exception.InventoryItemImageNotFoundException;
import com.nforce.retailops.repository.InventoryItemImageRepository;
import com.nforce.retailops.service.UnsplashService;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.concurrent.TimeUnit;

// Inventory item display images: Unsplash search for the add/edit form's
// picker (Super Admin + Owner/Admin), and serving a stored image's bytes to
// any signed-in user (employees see them on the stock check). Stored images
// are stock photos, so they aren't store-scoped.
@RestController
@RequestMapping("/api/inventory-images")
public class InventoryImageController {

    private final UnsplashService unsplashService;
    private final InventoryItemImageRepository inventoryItemImageRepository;

    public InventoryImageController(
        UnsplashService unsplashService,
        InventoryItemImageRepository inventoryItemImageRepository
    ) {
        this.unsplashService = unsplashService;
        this.inventoryItemImageRepository = inventoryItemImageRepository;
    }

    @GetMapping("/search")
    @PreAuthorize("hasAnyRole('OWNER_ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<List<UnsplashPhotoResponse>> search(
        @RequestParam String query,
        @RequestParam(defaultValue = "10") int perPage
    ) {
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
    public ResponseEntity<byte[]> image(@PathVariable Long id) {
        InventoryItemImage image = inventoryItemImageRepository.findById(id)
            .orElseThrow(() -> new InventoryItemImageNotFoundException("Image not found"));
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(image.getContentType()))
            .cacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePrivate().immutable())
            .body(image.getData());
    }
}
