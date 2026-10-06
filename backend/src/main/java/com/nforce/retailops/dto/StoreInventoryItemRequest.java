package com.nforce.retailops.dto;

import com.nforce.retailops.entity.InventoryItemCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

// storeId is only read on the Super Admin create endpoint (StoreInventoryItemService
// validates it's present there) -- the Owner/Admin endpoints derive the store from
// the caller and ignore this field entirely.
public record StoreInventoryItemRequest(
    Long storeId,

    @NotBlank(message = "Name is required")
    @Size(max = 200, message = "Name must be at most 200 characters")
    String name,

    @NotNull(message = "Category is required")
    InventoryItemCategory category,

    @NotBlank(message = "Unit is required")
    @Size(max = 50, message = "Unit must be at most 50 characters")
    String unitOfMeasurement,

    @NotNull(message = "Minimum weekday quantity is required")
    @PositiveOrZero(message = "Minimum weekday quantity cannot be negative")
    Integer minWeekday,

    @PositiveOrZero(message = "Minimum weekend quantity cannot be negative")
    Integer minWeekend,

    @NotNull(message = "Preferred supplier is required")
    Long preferredSupplierId,

    @Size(max = 500, message = "Note must be at most 500 characters")
    String note,

    boolean autoPoEnabled,

    // Unsplash id of a newly chosen display image, which the server then
    // downloads and stores. Null leaves the current image as it is.
    @Size(max = 64, message = "Image id is invalid")
    @Pattern(regexp = "[A-Za-z0-9_-]*", message = "Image id is invalid")
    String imagePhotoId,

    // True removes the current image (ignored when imagePhotoId is set).
    Boolean removeImage
) {
}
