package com.nforce.retailops.entity;

import jakarta.persistence.*;

import java.time.OffsetDateTime;

// A display image copied from Unsplash for one store inventory item. Never
// updated in place: picking a different image writes a new row and deletes
// the old one, so an id always identifies the same bytes (the image endpoint
// serves them as immutable).
@Entity
@Table(name = "inventory_item_images")
public class InventoryItemImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "content_type", nullable = false, length = 100)
    private String contentType;

    // Explicit length so H2 (tests, create-drop) doesn't default to
    // varbinary(255); Postgres maps any varbinary length to bytea.
    @Column(nullable = false, length = 10_485_760)
    private byte[] data;

    @Column(name = "unsplash_photo_id", length = 64)
    private String unsplashPhotoId;

    @Column(name = "photographer_name", columnDefinition = "TEXT")
    private String photographerName;

    @Column(name = "photographer_url", columnDefinition = "TEXT")
    private String photographerUrl;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    public InventoryItemImage() {
    }

    @PrePersist
    protected void onCreate() {
        createdAt = OffsetDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public String getContentType() {
        return contentType;
    }

    public void setContentType(String contentType) {
        this.contentType = contentType;
    }

    public byte[] getData() {
        return data;
    }

    public void setData(byte[] data) {
        this.data = data;
    }

    public String getUnsplashPhotoId() {
        return unsplashPhotoId;
    }

    public void setUnsplashPhotoId(String unsplashPhotoId) {
        this.unsplashPhotoId = unsplashPhotoId;
    }

    public String getPhotographerName() {
        return photographerName;
    }

    public void setPhotographerName(String photographerName) {
        this.photographerName = photographerName;
    }

    public String getPhotographerUrl() {
        return photographerUrl;
    }

    public void setPhotographerUrl(String photographerUrl) {
        this.photographerUrl = photographerUrl;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
