package com.nforce.retailops.dto;

// One Unsplash search result as offered in the inventory image picker.
// Only id is sent back when the image is chosen -- the server re-fetches the
// photo from Unsplash itself rather than downloading a client-supplied URL.
public record UnsplashPhotoResponse(
    String id,
    String description,
    String thumbUrl,
    String smallUrl,
    String photographerName,
    String photographerUrl
) {
}
