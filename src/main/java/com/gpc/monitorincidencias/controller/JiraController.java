package com.gpc.monitorincidencias.controller;

import com.gpc.monitorincidencias.service.JiraClientService;
import com.gpc.monitorincidencias.service.AppLogService;
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
    private final AppLogService logService;

    public JiraController(JiraClientService jiraClientService, AppLogService logService) {
        this.jiraClientService = jiraClientService;
        this.logService = logService;
    }

    @GetMapping("/config")
    public Map<String, Object> config() {
        logService.info("jira", "Config requested");
        return jiraClientService.configurationStatus();
    }

    @GetMapping("/myself")
    public Map<String, Object> myself() {
        logService.info("jira", "Myself requested");
        return jiraClientService.myself();
    }

    @PostMapping("/search")
    public Map<String, Object> search(@Valid @RequestBody JqlRequest request) {
        logService.info("jira", "Search requested jql=" + request.jql());
        return jiraClientService.searchByJql(request.jql());
    }

    @PostMapping("/issues")
    public Map<String, Object> issues(@Valid @RequestBody IssueKeysRequest request) {
        logService.info("jira", "Issues requested keys=" + String.join(",", request.issueKeys()));
        return jiraClientService.searchIssueKeys(request.issueKeys());
    }

    @GetMapping("/issue/{issueKey}")
    public Map<String, Object> issue(@PathVariable String issueKey) {
        logService.info("jira", "Issue requested " + issueKey);
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
