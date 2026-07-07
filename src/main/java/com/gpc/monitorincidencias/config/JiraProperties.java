package com.gpc.monitorincidencias.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "jira")
public class JiraProperties {

    private String baseUrl;
    private String email;
    private String apiToken;

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getApiToken() {
        return apiToken;
    }

    public void setApiToken(String apiToken) {
        this.apiToken = apiToken;
    }

    public boolean isConfigured() {
        return hasText(baseUrl) && hasText(email) && hasText(apiToken);
    }

    public String normalizedBaseUrl() {
        if (baseUrl == null) {
            return "";
        }
        return baseUrl.replaceAll("/+$", "");
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
