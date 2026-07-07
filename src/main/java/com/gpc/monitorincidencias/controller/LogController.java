package com.gpc.monitorincidencias.controller;

import com.gpc.monitorincidencias.service.AppLogService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/logs")
public class LogController {

    private final AppLogService logService;

    public LogController(AppLogService logService) {
        this.logService = logService;
    }

    @PostMapping
    public Map<String, Object> write(@Valid @RequestBody LogRequest request) {
        String level = request.level() == null ? "INFO" : request.level().toUpperCase();
        if ("ERROR".equals(level)) {
            logService.error(request.area(), request.message());
        } else if ("WARN".equals(level)) {
            logService.warn(request.area(), request.message());
        } else {
            logService.info(request.area(), request.message());
        }
        return Map.of("ok", true);
    }

    public record LogRequest(String area, String level, @NotBlank String message) {
    }
}
