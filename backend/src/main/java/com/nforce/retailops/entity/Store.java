package com.nforce.retailops.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "stores")
public class Store {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String name;

    @Column(name = "store_code", nullable = false, unique = true)
    private Long storeCode;

    @Column(columnDefinition = "TEXT")
    private String location;

    @Column(nullable = false)
    private boolean active = true;

    public Store() {
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

    public Long getStoreCode() {
        return storeCode;
    }

    public void setStoreCode(Long storeCode) {
        this.storeCode = storeCode;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }
}