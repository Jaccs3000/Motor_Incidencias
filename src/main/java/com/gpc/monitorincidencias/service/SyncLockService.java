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

    public SyncLockService(MonitorProperties properties) {
        this.timeout = Duration.ofMinutes(Math.max(1, properties.getSync().getLockTimeoutMinutes()));
    }

    public synchronized LockState acquire(String owner) {
        if (currentLock != null && isExpired(currentLock)) {
            currentLock = null;
        }
        if (currentLock != null) {
            throw new IllegalStateException("Ya existe una sincronizacion en curso.");
        }
        currentLock = new LockState(UUID.randomUUID().toString(), owner, OffsetDateTime.now());
        return currentLock;
    }

    public synchronized void release(String lockId) {
        if (currentLock != null && currentLock.id().equals(lockId)) {
            currentLock = null;
        }
    }

    public synchronized Optional<LockState> current() {
        if (currentLock != null && isExpired(currentLock)) {
            currentLock = null;
        }
        return Optional.ofNullable(currentLock);
    }

    private boolean isExpired(LockState lock) {
        return lock.acquiredAt().plus(timeout).isBefore(OffsetDateTime.now());
    }

    public record LockState(String id, String owner, OffsetDateTime acquiredAt) {
    }
}
