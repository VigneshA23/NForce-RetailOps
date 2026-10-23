package com.nforce.retailops.entity;

import jakarta.persistence.*;

import java.time.OffsetDateTime;

// A unit of measurement added by Super Admin on top of the built-in ones.
@Entity
@Table(name = "inventory_units")
public class InventoryUnit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 30)
    private String name;

    // True for countable units (quantities must be whole numbers).
    @Column(name = "whole_number", nullable = false)
    private boolean wholeNumber;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    public InventoryUnit() {
    }

    @PrePersist
    protected void onCreate() {
        createdAt = OffsetDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public boolean isWholeNumber() {
        return wholeNumber;
    }

    public void setWholeNumber(boolean wholeNumber) {
        this.wholeNumber = wholeNumber;
    }
}
