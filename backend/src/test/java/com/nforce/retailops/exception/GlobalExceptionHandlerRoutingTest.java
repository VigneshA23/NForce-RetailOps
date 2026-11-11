package com.nforce.retailops.exception;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

// Unmapped method / unknown path must not fall through to the catch-all 500
// (seen on staging after RTS-470 removed Owner/Admin supplier PUT and PATCH).
class GlobalExceptionHandlerRoutingTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void unsupportedMethodIs405() {
        ResponseEntity<Map<String, String>> response =
            handler.handleMethodNotSupported(new HttpRequestMethodNotSupportedException("PUT"));

        assertEquals(HttpStatus.METHOD_NOT_ALLOWED, response.getStatusCode());
        assertEquals("Method not allowed", response.getBody().get("message"));
    }

    @Test
    void unknownPathIs404() {
        ResponseEntity<Map<String, String>> response =
            handler.handleNoResourceFound(new NoResourceFoundException(HttpMethod.PATCH, "api/stores/suppliers/1/status"));

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        assertEquals("Not found", response.getBody().get("message"));
    }
}
