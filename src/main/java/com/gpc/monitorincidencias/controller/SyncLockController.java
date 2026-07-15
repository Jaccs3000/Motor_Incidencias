package com.gpc.monitorincidencias.controller;

import com.gpc.monitorincidencias.service.SyncLockService;
import com.gpc.monitorincidencias.service.AppLogService;
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
    private final AppLogService logService;

    public SyncLockController(SyncLockService syncLockService, AppLogService logService) {
        this.syncLockService = syncLockService;
        this.logService = logService;
    }

    @GetMapping
    public Map<String, Object> current() {
        Map<String, Object> response = new HashMap<>();
        var lock = syncLockService.current();
        response.put("locked", lock.isPresent());
        lock.ifPresent(lockState -> response.put("lock", lockState));
        logService.info("sync", "Current lock checked; locked=" + lock.isPresent());
        return response;
    }

    @PostMapping("/acquire")
    public ResponseEntity<Map<String, Object>> acquire(@RequestBody Map<String, Object> request) {
        try {
            String owner = request.get("owner") == null ? "frontend" : String.valueOf(request.get("owner"));
            boolean force = Boolean.TRUE.equals(request.get("force"));
            var lock = syncLockService.acquire(owner, force);
            logService.info("sync", "Lock acquired via API by " + owner + " id=" + lock.id());
            return ResponseEntity.ok(Map.of("lock", lock));
        } catch (IllegalStateException ex) {
            logService.warn("sync", "Failed to acquire lock: " + ex.getMessage());
            return ResponseEntity.status(409).body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/release")
    public Map<String, Object> release(@RequestBody Map<String, Object> request) {
        String lockId = request.get("lockId") == null ? "" : String.valueOf(request.get("lockId"));
        logService.info("sync", "Release requested id=" + lockId);
        syncLockService.release(lockId);
        return Map.of("ok", true);
    }

    @PostMapping("/refresh")
    public Map<String, Object> refresh(@RequestBody Map<String, Object> request) {
        String lockId = request.get("lockId") == null ? "" : String.valueOf(request.get("lockId"));
        logService.info("sync", "Refresh requested id=" + lockId);
        syncLockService.refresh(lockId);
        return Map.of("ok", true);
    }
}
