package com.nforce.retailops.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.util.List;

// storeId / storeIds are only read on the Super Admin create endpoint
// (StoreInventoryItemService validates that at least one store is given there);
// storeIds wins when present and creates one linked copy per store. The
// Owner/Admin endpoints derive the store from the caller and ignore both.
public record StoreInventoryItemRequest(
    Long storeId,

    List<Long> storeIds,

    @NotBlank(message = "Name is required")
    @Size(max = 200, message = "Name must be at most 200 characters")
    String name,

    @NotBlank(message = "Category is required")
    @Size(max = 40, message = "Category must be at most 40 characters")
    String category,

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

    // An image the user uploaded themselves, as a base64 data URL
    // (data:image/jpeg;base64,...). Takes precedence over imagePhotoId.
    @Size(max = 3_000_000, message = "Image is too large")
    String imageUploadData,

    // True removes the current image (ignored when imagePhotoId is set).
    Boolean removeImage
) {
}
