package com.gpc.monitorincidencias.service;

import com.gpc.monitorincidencias.config.JiraProperties;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;

import java.nio.charset.StandardCharsets;
import java.util.Collection;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class JiraClientService {

    private static final String JIRA_FIELDS = String.join(",",
            "summary",
            "description",
            "project",
            "issuetype",
            "status",
            "assignee",
            "reporter",
            "creator",
            "priority",
            "labels",
            "created",
            "updated",
            "resolution",
            "resolutiondate",
            "timeoriginalestimate",
            "timespent",
            "timeestimate",
            "issuelinks",
            "subtasks",
            "parent");

    private final JiraProperties properties;
    private final RestClient restClient;
    private final AppLogService logService;

    public JiraClientService(JiraProperties properties, AppLogService logService) {
        this.properties = properties;
        this.logService = logService;
        this.restClient = RestClient.builder().build();
    }

    public Map<String, Object> searchByJql(String jql) {
        requireConfigured();
        String url = UriComponentsBuilder
                .fromUriString(properties.normalizedBaseUrl())
                .path("/rest/api/3/search/jql")
                .queryParam("jql", jql)
                .queryParam("fields", JIRA_FIELDS)
                .build()
                .toUriString();
        return get(url);
    }

    public Map<String, Object> searchIssueKeys(List<String> issueKeys) {
        if (issueKeys == null || issueKeys.isEmpty()) {
            return Map.of("issues", List.of());
        }
        String quotedKeys = issueKeys.stream()
                .map(String::trim)
                .filter(key -> !key.isEmpty())
                .distinct()
                .map(key -> "\"" + key.replace("\"", "") + "\"")
                .reduce((left, right) -> left + "," + right)
                .orElse("");
        return searchByJql("issuekey IN (" + quotedKeys + ")");
    }

    public Map<String, Object> getIssue(String issueKey) {
        requireConfigured();
        String url = UriComponentsBuilder
                .fromUriString(properties.normalizedBaseUrl())
                .path("/rest/api/3/issue/{issueKey}")
                .queryParam("fields", JIRA_FIELDS)
                .build(issueKey)
                .toString();
        return get(url);
    }

    public Map<String, Object> myself() {
        requireConfigured();
        String url = properties.normalizedBaseUrl() + "/rest/api/3/myself";
        return get(url);
    }

    public Map<String, Object> configurationStatus() {
        return Map.of(
                "configured", properties.isConfigured(),
                "baseUrl", properties.normalizedBaseUrl(),
                "emailConfigured", properties.getEmail() != null && !properties.getEmail().isBlank(),
                "apiTokenConfigured", properties.getApiToken() != null && !properties.getApiToken().isBlank()
        );
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> get(String url) {
        try {
            logService.info("jira", "Calling Jira URL: " + url);
            Map<String, Object> result = restClient.get()
                    .uri(url)
                    .header(HttpHeaders.AUTHORIZATION, "Basic " + basicToken())
                    .header(HttpHeaders.ACCEPT, "application/json")
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (request, response) -> {
                        throw new JiraRequestException(response.getStatusCode().value(), response.getStatusText());
                    })
                    .body(Map.class);
            logService.info("jira", "Jira response received from: " + url + "; " + summarizeResult(result));
            return result;
        } catch (RestClientResponseException ex) {
            logService.error("jira", "Jira HTTP " + ex.getStatusCode().value() + " calling " + url);
            throw new JiraRequestException(ex.getStatusCode().value(), ex.getResponseBodyAsString());
        } catch (JiraRequestException ex) {
            logService.error("jira", "Jira HTTP " + ex.status() + " calling " + url + ": " + ex.getMessage());
            throw ex;
        } catch (Exception ex) {
            logService.error("jira", "Unexpected Jira error calling " + url + ": " + ex.getMessage());
            throw ex;
        }
    }

    private String basicToken() {
        String raw = properties.getEmail() + ":" + properties.getApiToken();
        return Base64.getEncoder().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    @SuppressWarnings("unchecked")
    private String summarizeResult(Map<String, Object> result) {
        Object issuesValue = result.get("issues");
        if (issuesValue instanceof Collection<?> issues) {
            String keys = issues.stream()
                    .filter(Map.class::isInstance)
                    .map(issue -> ((Map<String, Object>) issue).get("key"))
                    .filter(key -> key != null)
                    .map(Object::toString)
                    .collect(Collectors.joining(","));
            return "issueCount=" + issues.size() + "; keys=" + keys;
        }
        Object key = result.get("key");
        if (key != null) {
            return "issueCount=1; keys=" + key;
        }
        return "keys=" + result.keySet();
    }

    private void requireConfigured() {
        if (!properties.isConfigured()) {
            throw new IllegalStateException("Jira no esta configurado. Revisa config/application-local.yml.");
        }
    }

    public static class JiraRequestException extends RuntimeException {
        private final int status;

        public JiraRequestException(int status, String message) {
            super(message);
            this.status = status;
        }

        public int status() {
            return status;
        }
    }
}
