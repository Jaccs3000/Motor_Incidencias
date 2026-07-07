package com.gpc.monitorincidencias.controller;

import com.gpc.monitorincidencias.service.JiraClientService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/health")
public class HealthController {

    private final JiraClientService jiraClientService;

    public HealthController(JiraClientService jiraClientService) {
        this.jiraClientService = jiraClientService;
    }

    @GetMapping
    public Map<String, Object> health() {
        return Map.of(
                "status", "UP",
                "jira", jiraClientService.configurationStatus()
        );
    }
}
