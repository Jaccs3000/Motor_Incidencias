package com.gpc.monitorincidencias.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "monitor")
public class MonitorProperties {

    private final Logs logs = new Logs();
    private final Sync sync = new Sync();

    public Logs getLogs() {
        return logs;
    }

    public Sync getSync() {
        return sync;
    }

    public static class Logs {
        private String directory = "logs";

        public String getDirectory() {
            return directory;
        }

        public void setDirectory(String directory) {
            this.directory = directory;
        }
    }

    public static class Sync {
        private int lockTimeoutMinutes = 30;

        public int getLockTimeoutMinutes() {
            return lockTimeoutMinutes;
        }

        public void setLockTimeoutMinutes(int lockTimeoutMinutes) {
            this.lockTimeoutMinutes = lockTimeoutMinutes;
        }
    }
}
