import { Alert, AppBar, Box, Button, Container, Snackbar, Stack, Tab, Tabs, Toolbar, Typography } from "@mui/material";
import { RefreshCw, Settings } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import "./index.css";
import { getHealth } from "./api/backendApi";
import { IssueDetail } from "./components/IssueDetail";
import { NotificationBell } from "./components/NotificationBell";
import { ProjectGrid } from "./components/ProjectGrid";
import { SettingsPanel } from "./components/SettingsPanel";
import { SyncStatus } from "./components/SyncStatus";
import { monitorConfig } from "./config/monitorConfig";
import { clearStore, get, getAll, getSetting, putMany, setSetting } from "./db/database";
import { getUnreadNotifications } from "./services/notificationService";
import { runSynchronization } from "./services/syncService";

const defaultSettings = {
  jiraBaseUrl: "https://puertodecartagena.atlassian.net",
  syncIntervalMinutes: 5,
};

export default function App() {
  const [tab, setTab] = useState("main");
  const [appSettings, setAppSettings] = useState(defaultSettings);
  const [filters, setFilters] = useState([]);
  const [alertRules, setAlertRules] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState(monitorConfig.defaultGridColumns);
  const [projectGroups, setProjectGroups] = useState([]);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [syncStatus, setSyncStatus] = useState("idle");
  const [syncMessage, setSyncMessage] = useState("");
  const [lastAttemptAt, setLastAttemptAt] = useState(null);
  const [syncProgress, setSyncProgress] = useState("");
  const [backendStatus, setBackendStatus] = useState(null);
  const [snackbar, setSnackbar] = useState(null);
  const syncingRef = useRef(false);

  const hasFilters = filters.length > 0;
  const syncDisabled = syncingRef.current || !hasFilters;

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (!hasFilters) return undefined;
    const minutes = Math.max(1, Number(appSettings.syncIntervalMinutes || 5));
    const interval = window.setInterval(() => {
      void handleSync();
    }, minutes * 60000);
    return () => window.clearInterval(interval);
  }, [hasFilters, appSettings.syncIntervalMinutes]);

  const sortedProjectGroups = useMemo(
    () => [...projectGroups].sort((a, b) => String(a.description).localeCompare(String(b.description))),
    [projectGroups],
  );

  async function initialize() {
    const storedSettings = await getSetting("settings", defaultSettings);
    const storedColumns = await getSetting("visibleColumns", monitorConfig.defaultGridColumns);
    const storedLastAttempt = await getSetting("lastSyncAttemptAt", null);
    const storedLastStatus = await getSetting("lastSyncStatus", "idle");
    const storedLastMessage = await getSetting("lastSyncMessage", "");
    setAppSettings({ ...defaultSettings, ...storedSettings });
    setFilters(await getAll("jiraFilters"));
    setAlertRules(await getAll("alertRules"));
    setVisibleColumns(storedColumns);
    setProjectGroups(await getAll("projectGroups"));
    setNotifications(await getUnreadNotifications());
    setLastAttemptAt(storedLastAttempt);
    setSyncStatus(storedLastStatus);
    setSyncMessage(storedLastMessage);
    if (!(await getAll("jiraFilters")).length) setTab("settings");
    try {
      setBackendStatus(await getHealth());
    } catch (error) {
      setBackendStatus({ status: "DOWN", error: error.message });
    }
  }

  async function saveSettings() {
    await setSetting("settings", appSettings);
    await setSetting("visibleColumns", visibleColumns);
    await clearStore("jiraFilters");
    await putMany("jiraFilters", filters);
    await clearStore("alertRules");
    await putMany("alertRules", alertRules);
    setSnackbar({ severity: "success", message: "Configuración guardada." });
    if (filters.length) setTab("main");
  }

  async function refreshData() {
    setProjectGroups(await getAll("projectGroups"));
    setNotifications(await getUnreadNotifications());
    setLastAttemptAt(await getSetting("lastSyncAttemptAt", null));
    setSyncStatus(await getSetting("lastSyncStatus", "idle"));
    setSyncMessage(await getSetting("lastSyncMessage", ""));
  }

  async function handleSync() {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncStatus("syncing");
    setSyncMessage("Sincronizando...");
    setSyncProgress("Iniciando sincronización...");
    setLastAttemptAt(new Date().toISOString());
    try {
      const result = await runSynchronization({
        jiraBaseUrl: appSettings.jiraBaseUrl,
        onProgress: setSyncProgress,
      });
      setSyncStatus(result.status);
      setSyncMessage(result.message);
      setSnackbar({ severity: result.status === "warning" ? "warning" : "success", message: result.message });
    } catch (error) {
      setSyncStatus("error");
      setSyncMessage(error.message);
      setSnackbar({ severity: "error", message: error.message });
    } finally {
      syncingRef.current = false;
      setSyncProgress("");
      await refreshData();
    }
  }

  async function selectIssue(issueKey) {
    setSelectedIssue(await get("issues", issueKey));
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f5f7fa" }}>
      <AppBar position="sticky" color="inherit" elevation={1}>
        <Toolbar sx={{ gap: 2 }}>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 800 }}>
            Monitor de Incidencias Jira
          </Typography>
          <NotificationBell notifications={notifications} onChanged={refreshData} />
          <SyncStatus status={syncStatus} lastAttemptAt={lastAttemptAt} message={syncProgress || syncMessage} />
          <Button variant="contained" startIcon={<RefreshCw size={17} />} disabled={syncDisabled} onClick={handleSync}>
            Sincronizar
          </Button>
          <Button variant="outlined" startIcon={<Settings size={17} />} onClick={() => setTab("settings")}>
            Configuración
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Stack spacing={2}>
          {backendStatus?.status === "DOWN" ? (
            <Alert severity="error">Backend local no disponible: {backendStatus.error}</Alert>
          ) : null}
          {backendStatus?.jira?.configured === false ? (
            <Alert severity="warning">Jira no está configurado en el backend. Completa `config/application-local.yml` antes de probar contra Jira real.</Alert>
          ) : null}

          <Tabs value={tab} onChange={(_, value) => setTab(value)}>
            <Tab value="main" label="Principal" />
            <Tab value="settings" label="Configuración" />
          </Tabs>

          {tab === "settings" ? (
            <SettingsPanel
              appSettings={appSettings}
              setAppSettings={setAppSettings}
              filters={filters}
              setFilters={setFilters}
              alertRules={alertRules}
              setAlertRules={setAlertRules}
              visibleColumns={visibleColumns}
              setVisibleColumns={setVisibleColumns}
              onSave={saveSettings}
            />
          ) : (
            <Stack spacing={2}>
              <ProjectGrid projectGroups={sortedProjectGroups} visibleColumns={visibleColumns} onIssueClick={selectIssue} />
              <IssueDetail issue={selectedIssue} />
            </Stack>
          )}
        </Stack>
      </Container>

      <Snackbar open={Boolean(snackbar)} autoHideDuration={5000} onClose={() => setSnackbar(null)}>
        {snackbar ? <Alert severity={snackbar.severity}>{snackbar.message}</Alert> : null}
      </Snackbar>
    </Box>
  );
}
