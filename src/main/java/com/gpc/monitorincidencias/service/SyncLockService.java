package com.gpc.monitorincidencias.service;

import com.gpc.monitorincidencias.config.MonitorProperties;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

@Service
public class SyncLockService {

    private final Duration timeout;
    private LockState currentLock;
    private final AppLogService logService;

    public SyncLockService(MonitorProperties properties, AppLogService logService) {
        this.timeout = Duration.ofMinutes(Math.max(1, properties.getSync().getLockTimeoutMinutes()));
        this.logService = logService;
    }

    public synchronized LockState acquire(String owner) {
        return acquire(owner, false);
    }

    public synchronized LockState acquire(String owner, boolean force) {
        cleanupExpiredLockIfNeeded();
        if (currentLock != null && !force) {
            logService.warn("sync", "Attempt to acquire lock but one is active by " + currentLock.owner());
            throw new IllegalStateException("Ya existe una sincronizacion en curso.");
        }
        if (currentLock != null) {
            logService.warn("sync", "Force acquiring lock; replacing existing lock owned by " + currentLock.owner());
        }
        currentLock = new LockState(UUID.randomUUID().toString(), owner, OffsetDateTime.now(), OffsetDateTime.now().plus(timeout));
        logService.info("sync", "Lock acquired by " + owner + " id=" + currentLock.id());
        return currentLock;
    }

    public synchronized void refresh(String lockId) {
        if (currentLock != null && currentLock.id().equals(lockId)) {
            currentLock = new LockState(currentLock.id(), currentLock.owner(), OffsetDateTime.now(), OffsetDateTime.now().plus(timeout));
            logService.info("sync", "Lock refreshed id=" + lockId);
        } else {
            logService.warn("sync", "Refresh called for unknown or expired lock id=" + lockId);
        }
    }

    public synchronized void release(String lockId) {
        if (currentLock != null && currentLock.id().equals(lockId)) {
            logService.info("sync", "Lock released id=" + lockId);
            currentLock = null;
        } else {
            logService.warn("sync", "Release called for unknown or expired lock id=" + lockId);
        }
    }

    public synchronized Optional<LockState> current() {
        cleanupExpiredLockIfNeeded();
        return Optional.ofNullable(currentLock);
    }

    private void cleanupExpiredLockIfNeeded() {
        if (currentLock != null && isExpired(currentLock)) {
            logService.info("sync", "Lock expired id=" + currentLock.id());
            currentLock = null;
        }
    }

    private boolean isExpired(LockState lock) {
        return lock.expiresAt().isBefore(OffsetDateTime.now());
    }

    public record LockState(String id, String owner, OffsetDateTime acquiredAt, OffsetDateTime expiresAt) {
    }
}
