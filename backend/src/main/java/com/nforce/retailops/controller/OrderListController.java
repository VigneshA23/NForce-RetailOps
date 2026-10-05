package com.nforce.retailops.controller;

import com.nforce.retailops.dto.CreateOrderListEntryRequest;
import com.nforce.retailops.dto.OrderListEntryResponse;
import com.nforce.retailops.dto.UpdateOrderListEntryRequest;
import com.nforce.retailops.security.AppUserDetails;
import com.nforce.retailops.service.OrderListService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

// Owner/Admin's Order Dashboard, scoped to the caller's own (single) store.
// No dedicated "copy order list" endpoint -- that text formatting happens
// client-side against this same list data.
@RestController
@RequestMapping("/api/stores/order-list")
@PreAuthorize("hasRole('OWNER_ADMIN')")
public class OrderListController {

    private final OrderListService orderListService;

    public OrderListController(OrderListService orderListService) {
        this.orderListService = orderListService;
    }

    @GetMapping
    public ResponseEntity<List<OrderListEntryResponse>> list(@AuthenticationPrincipal AppUserDetails principal) {
        return ResponseEntity.ok(orderListService.listForOwner(principal.getUser().getId()));
    }

    // Literal path, so it cannot collide with the {id} mapping below.
    @GetMapping("/needs-ordering-count")
    public ResponseEntity<Map<String, Long>> needsOrderingCount(@AuthenticationPrincipal AppUserDetails principal) {
        return ResponseEntity.ok(orderListService.needsOrderingCount(principal.getUser().getId()));
    }

    @PostMapping
    public ResponseEntity<OrderListEntryResponse> create(
        @AuthenticationPrincipal AppUserDetails principal,
        @Valid @RequestBody CreateOrderListEntryRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(orderListService.createEntry(principal.getUser().getId(), request));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<OrderListEntryResponse> update(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long id,
        @Valid @RequestBody UpdateOrderListEntryRequest request
    ) {
        return ResponseEntity.ok(orderListService.updateEntry(principal.getUser().getId(), id, request));
    }
}
