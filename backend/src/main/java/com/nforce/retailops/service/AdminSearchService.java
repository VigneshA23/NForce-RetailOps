package com.nforce.retailops.service;

import com.nforce.retailops.dto.AdminSearchItem;
import com.nforce.retailops.dto.AdminSearchResponse;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.repository.CategoryRepository;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.TaskRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AdminSearchService {

    private static final int MAX_RESULTS = 5;

    private final StoreOwnerRepository storeOwnerRepository;
    private final TaskRepository taskRepository;
    private final CategoryRepository categoryRepository;
    private final StoreEmployeeRepository storeEmployeeRepository;

    public AdminSearchService(
        StoreOwnerRepository storeOwnerRepository,
        TaskRepository taskRepository,
        CategoryRepository categoryRepository,
        StoreEmployeeRepository storeEmployeeRepository
    ) {
        this.storeOwnerRepository = storeOwnerRepository;
        this.taskRepository = taskRepository;
        this.categoryRepository = categoryRepository;
        this.storeEmployeeRepository = storeEmployeeRepository;
    }

    @Transactional(readOnly = true)
    public AdminSearchResponse search(Long ownerId, String q) {
        if (q == null || q.isBlank()) {
            return new AdminSearchResponse(List.of(), List.of(), List.of());
        }

        StoreOwner activeLink = storeOwnerRepository.findByOwnerIdAndActiveTrue(ownerId).orElse(null);
        if (activeLink == null) {
            return new AdminSearchResponse(List.of(), List.of(), List.of());
        }
        long storeId = activeLink.getStore().getId();

        var top5 = PageRequest.of(0, MAX_RESULTS);
        String trimmed = q.trim();

        List<AdminSearchItem> tasks = taskRepository.searchByOwnerIdAndTitle(ownerId, trimmed, top5).stream()
            .map(t -> new AdminSearchItem(t.getId(), t.getName(), t.getCategory().getName()))
            .toList();

        List<AdminSearchItem> categories = categoryRepository.searchByOwnerIdAndName(ownerId, trimmed, top5).stream()
            .map(c -> new AdminSearchItem(c.getId(), c.getName(), "Category"))
            .toList();

        List<AdminSearchItem> employees = storeEmployeeRepository
            .searchByNameOrEmailAndStoreId(storeId, trimmed, top5).stream()
            .map(se -> new AdminSearchItem(se.getId(), se.getEmployee().getFullName(), se.getEmployee().getEmail()))
            .toList();

        return new AdminSearchResponse(tasks, categories, employees);
    }
}
