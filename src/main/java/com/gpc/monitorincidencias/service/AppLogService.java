package com.gpc.monitorincidencias.service;

import com.gpc.monitorincidencias.config.MonitorProperties;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Service
public class AppLogService {

    private final Path logDirectory;

    public AppLogService(MonitorProperties properties) {
        this.logDirectory = Path.of(properties.getLogs().getDirectory()).toAbsolutePath().normalize();
    }

    public void info(String area, String message) {
        write(area, "INFO", message);
    }

    public void warn(String area, String message) {
        write(area, "WARN", message);
    }

    public void error(String area, String message) {
        write(area, "ERROR", message);
    }

    private synchronized void write(String area, String level, String message) {
        try {
            Files.createDirectories(logDirectory);
            String safeArea = area == null || area.isBlank() ? "app" : area.replaceAll("[^A-Za-z0-9_-]", "_");
            Path file = logDirectory.resolve(safeArea + "-" + LocalDate.now() + ".log");
            String line = "%s [%s] %s%n".formatted(OffsetDateTime.now(), level, message);
            Files.writeString(
                    file,
                    line,
                    StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE,
                    StandardOpenOption.APPEND
            );
        } catch (IOException ignored) {
            // Logging must not break the application flow.
        }
    }
}
