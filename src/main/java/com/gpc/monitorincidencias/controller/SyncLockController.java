package com.gpc.monitorincidencias.controller;

import com.gpc.monitorincidencias.service.SyncLockService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/sync-lock")
public class SyncLockController {

    private final SyncLockService syncLockService;

    public SyncLockController(SyncLockService syncLockService) {
        this.syncLockService = syncLockService;
    }

    @GetMapping
    public Map<String, Object> current() {
        Map<String, Object> response = new HashMap<>();
        var lock = syncLockService.current();
        response.put("locked", lock.isPresent());
        lock.ifPresent(lockState -> response.put("lock", lockState));
        return response;
    }

    @PostMapping("/acquire")
    public ResponseEntity<Map<String, Object>> acquire(@Valid @RequestBody LockRequest request) {
        try {
            return ResponseEntity.ok(Map.of("lock", syncLockService.acquire(request.owner())));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(409).body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/release")
    public Map<String, Object> release(@Valid @RequestBody ReleaseRequest request) {
        syncLockService.release(request.lockId());
        return Map.of("ok", true);
    }

    public record LockRequest(String owner) {
    }

    public record ReleaseRequest(String lockId) {
    }
}
