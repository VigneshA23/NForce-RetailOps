package com.nforce.retailops.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.nforce.retailops.dto.UnsplashPhotoResponse;
import com.nforce.retailops.exception.ImageProviderException;
import com.nforce.retailops.exception.ImageSearchNotConfiguredException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;

// Thin client over the Unsplash API for inventory item display images:
// keyword search for the picker, and fetching one chosen photo's bytes so
// StoreInventoryItemService can store a copy. Only the public Access Key is
// needed (sent as "Client-ID"); the Secret Key is for OAuth user flows,
// which this app doesn't use.
@Service
public class UnsplashService {

    private static final Logger log = LoggerFactory.getLogger(UnsplashService.class);

    public static final int MAX_PER_PAGE = 30;
    private static final int MAX_IMAGE_BYTES = 5 * 1024 * 1024;

    // A photo fetched from Unsplash, ready to persist.
    public record DownloadedPhoto(
        String photoId,
        String contentType,
        byte[] data,
        String photographerName,
        String photographerUrl
    ) {
    }

    private final String accessKey;
    private final RestClient api;
    private final RestClient images;

    public UnsplashService(@Value("${unsplash.access-key:}") String accessKey) {
        this.accessKey = accessKey;
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(3_000);
        requestFactory.setReadTimeout(8_000);
        this.api = RestClient.builder()
            .baseUrl("https://api.unsplash.com")
            .defaultHeader("Authorization", "Client-ID " + accessKey)
            .defaultHeader("Accept-Version", "v1")
            .requestFactory(requestFactory)
            .build();
        this.images = RestClient.builder().requestFactory(requestFactory).build();
    }

    public List<UnsplashPhotoResponse> search(String query, int perPage) {
        requireConfigured();
        int size = Math.max(1, Math.min(perPage, MAX_PER_PAGE));
        JsonNode body;
        try {
            body = api.get()
                .uri(uri -> uri.path("/search/photos")
                    .queryParam("query", query)
                    .queryParam("per_page", size)
                    .queryParam("content_filter", "high")
                    .build())
                .retrieve()
                .body(JsonNode.class);
        } catch (RestClientException ex) {
            throw upstreamFailure("search", ex);
        }

        List<UnsplashPhotoResponse> results = new ArrayList<>();
        if (body == null) {
            return results;
        }
        for (JsonNode photo : body.path("results")) {
            String description = text(photo, "alt_description");
            if (description == null) {
                description = text(photo, "description");
            }
            results.add(new UnsplashPhotoResponse(
                text(photo, "id"),
                description,
                text(photo.path("urls"), "thumb"),
                text(photo.path("urls"), "small"),
                text(photo.path("user"), "name"),
                text(photo.path("user").path("links"), "html")
            ));
        }
        return results;
    }

    // Looks the photo up by id (so the image URL always comes from Unsplash,
    // never from the client), registers the download as Unsplash's API
    // guidelines require, then fetches the "small" (400px wide) rendition.
    public DownloadedPhoto download(String photoId) {
        requireConfigured();
        JsonNode photo;
        try {
            photo = api.get().uri("/photos/{id}", photoId).retrieve().body(JsonNode.class);
        } catch (HttpClientErrorException.NotFound ex) {
            throw new ImageProviderException("That image is no longer available on Unsplash. Please pick another.");
        } catch (RestClientException ex) {
            throw upstreamFailure("photo lookup", ex);
        }
        if (photo == null) {
            throw new ImageProviderException("That image is no longer available on Unsplash. Please pick another.");
        }

        String imageUrl = text(photo.path("urls"), "small");
        URI imageUri = imageUrl != null ? URI.create(imageUrl) : null;
        if (imageUri == null || !"https".equals(imageUri.getScheme())
            || imageUri.getHost() == null || !imageUri.getHost().endsWith(".unsplash.com")) {
            throw new ImageProviderException("Unsplash returned an unexpected image address. Please pick another image.");
        }

        trackDownload(text(photo.path("links"), "download_location"));

        ResponseEntity<byte[]> response;
        try {
            response = images.get().uri(imageUri).retrieve().toEntity(byte[].class);
        } catch (RestClientException ex) {
            throw upstreamFailure("image download", ex);
        }
        byte[] data = response.getBody();
        if (data == null || data.length == 0) {
            throw new ImageProviderException("Could not download the image from Unsplash. Please try again.");
        }
        if (data.length > MAX_IMAGE_BYTES) {
            throw new ImageProviderException("That image is too large to save. Please pick another.");
        }
        MediaType mediaType = response.getHeaders().getContentType();
        String contentType = mediaType != null && "image".equals(mediaType.getType())
            ? mediaType.getType() + "/" + mediaType.getSubtype()
            : MediaType.IMAGE_JPEG_VALUE;

        return new DownloadedPhoto(
            photoId,
            contentType,
            data,
            text(photo.path("user"), "name"),
            text(photo.path("user").path("links"), "html")
        );
    }

    // Best-effort: a failed tracking ping shouldn't stop the item saving.
    private void trackDownload(String downloadLocation) {
        if (downloadLocation == null || !downloadLocation.startsWith("https://api.unsplash.com/")) {
            return;
        }
        try {
            api.get().uri(URI.create(downloadLocation)).retrieve().toBodilessEntity();
        } catch (RestClientException ex) {
            log.warn("Unsplash download tracking failed: {}", ex.getMessage());
        }
    }

    private void requireConfigured() {
        if (accessKey == null || accessKey.isBlank()) {
            throw new ImageSearchNotConfiguredException("Image search is not configured. Set UNSPLASH_ACCESS_KEY on the server.");
        }
    }

    private ImageProviderException upstreamFailure(String operation, RestClientException ex) {
        log.warn("Unsplash {} failed: {}", operation, ex.getMessage());
        if (ex instanceof HttpClientErrorException.Forbidden || ex instanceof HttpClientErrorException.TooManyRequests) {
            return new ImageProviderException("The Unsplash hourly request limit has been reached. Please try again later.");
        }
        if (ex instanceof HttpClientErrorException.Unauthorized) {
            return new ImageProviderException("Unsplash rejected the server's access key.");
        }
        return new ImageProviderException("Could not reach Unsplash. Please try again.");
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isTextual() && !value.asText().isBlank() ? value.asText() : null;
    }
}
