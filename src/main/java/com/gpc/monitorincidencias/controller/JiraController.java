package com.gpc.monitorincidencias.controller;

import com.gpc.monitorincidencias.service.JiraClientService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/jira")
public class JiraController {

    private final JiraClientService jiraClientService;

    public JiraController(JiraClientService jiraClientService) {
        this.jiraClientService = jiraClientService;
    }

    @GetMapping("/config")
    public Map<String, Object> config() {
        return jiraClientService.configurationStatus();
    }

    @GetMapping("/myself")
    public Map<String, Object> myself() {
        return jiraClientService.myself();
    }

    @PostMapping("/search")
    public Map<String, Object> search(@Valid @RequestBody JqlRequest request) {
        return jiraClientService.searchByJql(request.jql());
    }

    @PostMapping("/issues")
    public Map<String, Object> issues(@Valid @RequestBody IssueKeysRequest request) {
        return jiraClientService.searchIssueKeys(request.issueKeys());
    }

    @GetMapping("/issue/{issueKey}")
    public Map<String, Object> issue(@PathVariable String issueKey) {
        return jiraClientService.getIssue(issueKey);
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, Object>> configurationError(IllegalStateException ex) {
        return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(JiraClientService.JiraRequestException.class)
    public ResponseEntity<Map<String, Object>> jiraError(JiraClientService.JiraRequestException ex) {
        return ResponseEntity.status(ex.status()).body(Map.of(
                "error", "Error consultando Jira",
                "status", ex.status(),
                "details", ex.getMessage()
        ));
    }

    public record JqlRequest(@NotBlank String jql) {
    }

    public record IssueKeysRequest(@NotEmpty List<@NotBlank String> issueKeys) {
    }
}
