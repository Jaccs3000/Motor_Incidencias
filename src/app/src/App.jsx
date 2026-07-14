import { Alert, AppBar, Box, Button, Container, Snackbar, Stack, Tab, Tabs, Toolbar, Typography } from "@mui/material";
import { RefreshCw, Settings, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import "./index.css";
import { getHealth } from "./api/backendApi";
import { IssueDetail } from "./components/IssueDetail";
import { NotificationBell } from "./components/NotificationBell";
import { ProjectGrid } from "./components/ProjectGrid";
import { SettingsPanel } from "./components/SettingsPanel";
import { SyncStatus } from "./components/SyncStatus";
import { gridColumnDefinitions, monitorConfig } from "./config/monitorConfig";
import { clearStore, get, getAll, getSetting, putMany, setSetting } from "./db/database";
import { getUnreadNotifications } from "./services/notificationService";
import { runSynchronization } from "./services/syncService";

const defaultSettings = {
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
  const [selectedSubtasks, setSelectedSubtasks] = useState(null);
  const [gridScrollRequest, setGridScrollRequest] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [syncStatus, setSyncStatus] = useState("idle");
  const [syncMessage, setSyncMessage] = useState("");
  const [lastAttemptAt, setLastAttemptAt] = useState(null);
  const [syncProgress, setSyncProgress] = useState("");
  const [nextSyncAt, setNextSyncAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [backendStatus, setBackendStatus] = useState(null);
  const [snackbar, setSnackbar] = useState(null);
  const syncingRef = useRef(false);
  const syncAbortControllerRef = useRef(null);
  const appSettingsRef = useRef(defaultSettings);
  const lastClickedGroupIdRef = useRef(null);
  const autoSyncSchedule = monitorConfig.autoSyncSchedule;

  const hasFilters = filters.length > 0;
  const autoSyncAllowed = isAutoSyncAllowed(autoSyncSchedule, new Date(now));
  const autoSyncPaused = hasFilters && !autoSyncAllowed && syncStatus !== "syncing";
  const displayedSyncStatus = autoSyncPaused ? "paused" : syncStatus;
  const syncDisabled = syncingRef.current || !hasFilters;
  const filtersRef = useRef([]);
  const backendStatusRef = useRef(null);

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    appSettingsRef.current = appSettings;
  }, [appSettings]);

  useEffect(() => {
    backendStatusRef.current = backendStatus;
  }, [backendStatus]);

  useEffect(() => {
    setNextSyncAt(hasFilters ? Date.now() + syncIntervalMs() : null);
  }, [hasFilters, appSettings.syncIntervalMinutes]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!hasFilters || !nextSyncAt) return undefined;
    const timeout = window.setTimeout(() => {
      if (isAutoSyncAllowed(autoSyncSchedule, new Date())) {
        void handleSync();
      } else {
        setNextSyncAt(Date.now() + 60000);
      }
    }, Math.max(0, nextSyncAt - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [hasFilters, nextSyncAt, autoSyncSchedule]);

  const sortedProjectGroups = useMemo(
    () => [...projectGroups].sort((a, b) => String(a.description).localeCompare(String(b.description))),
    [projectGroups],
  );

  async function initialize() {
    const storedSettings = await getSetting("settings", defaultSettings);
    const mergedSettings = { ...defaultSettings, ...storedSettings };
    const storedColumns = normalizeVisibleColumns(await getSetting("visibleColumns", monitorConfig.defaultGridColumns));
    const storedLastAttempt = await getSetting("lastSyncAttemptAt", null);
    const storedLastStatus = await getSetting("lastSyncStatus", "idle");
    const storedLastMessage = await getSetting("lastSyncMessage", "");
    appSettingsRef.current = mergedSettings;
    setAppSettings(mergedSettings);
    const storedFilters = await getAll("jiraFilters");
    setFilters(storedFilters);
    setAlertRules(await getAll("alertRules"));
    setVisibleColumns(storedColumns);
    setProjectGroups(await getAll("projectGroups"));
    setNotifications(await getUnreadNotifications());
    setLastAttemptAt(storedLastAttempt);
    setSyncStatus(storedLastStatus);
    setSyncMessage(storedLastMessage);
    if (!(await getAll("jiraFilters")).length) setTab("settings");
    try {
      const health = await getHealth();
      setBackendStatus(health);
      if (storedFilters.length && isAutoSyncAllowed(autoSyncSchedule, new Date())) {
        window.setTimeout(() => {
          void handleSync({ backendStatusOverride: health, filtersOverride: storedFilters });
        }, 0);
      }
    } catch (error) {
      setBackendStatus({ status: "DOWN", error: error.message });
    }
  }

  async function saveSettings() {
    const settingsToSave = {
      syncIntervalMinutes: appSettings.syncIntervalMinutes,
    };
    appSettingsRef.current = settingsToSave;
    await setSetting("settings", settingsToSave);
    await setSetting("visibleColumns", visibleColumns);
    await clearStore("jiraFilters");
    await putMany("jiraFilters", filters);
    await clearStore("alertRules");
    await putMany("alertRules", alertRules);
    setSnackbar({ severity: "success", message: "Configuración guardada." });
    if (filters.length) setTab("main");
    if (filters.length && !syncingRef.current && isAutoSyncAllowed(autoSyncSchedule, new Date())) {
      await handleSync({ filtersOverride: filters });
    }
  }

  async function refreshData() {
    setProjectGroups(await getAll("projectGroups"));
    setNotifications(await getUnreadNotifications());
    setLastAttemptAt(await getSetting("lastSyncAttemptAt", null));
    setSyncStatus(await getSetting("lastSyncStatus", "idle"));
    setSyncMessage(await getSetting("lastSyncMessage", ""));
  }

  async function handleSync({ backendStatusOverride = null, filtersOverride = null } = {}) {
    if (syncingRef.current) return;
    const activeFilters = filtersOverride || filtersRef.current;
    const abortController = new AbortController();
    syncAbortControllerRef.current = abortController;
    syncingRef.current = true;
    setSyncStatus("syncing");
    setSyncMessage("Sincronizando...");
    setSyncProgress("Iniciando sincronización...");
    setLastAttemptAt(new Date().toISOString());
    try {
      const result = await runSynchronization({
        jiraBaseUrl: (backendStatusOverride || backendStatusRef.current)?.jira?.baseUrl || "",
        onProgress: setSyncProgress,
        signal: abortController.signal,
      });
      setSyncStatus(result.status);
      setSyncMessage(result.message);
      setSnackbar({ severity: result.status === "warning" || result.status === "interrupted" ? "warning" : "success", message: result.message });
    } catch (error) {
      setSyncStatus("error");
      setSyncMessage(error.message);
      setSnackbar({ severity: "error", message: error.message });
    } finally {
      syncingRef.current = false;
      syncAbortControllerRef.current = null;
      setSyncProgress("");
      setSelectedIssue(null);
      setSelectedSubtasks(null);
      setNextSyncAt(activeFilters.length ? Date.now() + syncIntervalMs() : null);
      await refreshData();
    }
  }

  function normalizeVisibleColumns(columns) {
    const replacements = {
      testingIssue: "testing",
      testOwner: "testing",
      developer: "testing",
      plannedTimeHours: "testing",
      spentTimeHours: "testing",
      remainingTimeHours: "testing",
      criteriaTestingIssue: "criteriaTesting",
      criteriaTestingOwner: "criteriaTesting",
      criteriaTestingStatus: "criteriaTesting",
      criteriaDocIssue: "criteriaDoc",
      criteriaDocStatus: "criteriaDoc",
      criteriaOwner: "criteriaDoc",
      criteriaPlannedTimeHours: "criteriaDoc",
      criteriaSpentTimeHours: "criteriaDoc",
      criteriaRemainingTimeHours: "criteriaDoc",
      automationIssue: "automation",
      automationOwner: "automation",
      automationStatus: "automation",
      trackingIssue: "tracking",
      trackingOwner: "tracking",
      trackingStatus: "tracking",
      testDeployIssue: "testDeploy",
      testDeployOwner: "testDeploy",
      testDeployStatus: "testDeploy",
      admonIssue: "admon",
      admonOwner: "admon",
      admonStatus: "admon",
      preProdDeployIssue: "preProdDeploy",
      preProdDeployOwner: "preProdDeploy",
      preProdDeployStatus: "preProdDeploy",
      preProdDeployTotalSubtasks: "preProdDeploy",
      preProdDeployOpenSubtasks: "preProdDeploy",
      preProdDeployOpenSubtaskKeys: "preProdDeploy",
      preProdDeployUndefinedSubtasks: "preProdDeploy",
      preProdDeployUndefinedSubtaskKeys: "preProdDeploy",
      prodDeployIssue: "prodDeploy",
      prodDeployOwner: "prodDeploy",
      prodDeployStatus: "prodDeploy",
      prodDeployTotalSubtasks: "prodDeploy",
      prodDeployOpenSubtasks: "prodDeploy",
      prodDeployOpenSubtaskKeys: "prodDeploy",
      prodDeployUndefinedSubtasks: "prodDeploy",
      prodDeployUndefinedSubtaskKeys: "prodDeploy",
      firewallIssue: "firewall",
      firewallOwner: "firewall",
      firewallStatus: "firewall",
      infrastructureIssue: "infrastructure",
      infrastructureOwner: "infrastructure",
      infrastructureStatus: "infrastructure",
      preProdTestingIssue: "preProdTesting",
      preProdTestingOwner: "preProdTesting",
      preProdTestingStatus: "preProdTesting",
      preProdCriteriaTestingIssue: "preProdCriteriaTesting",
      preProdCriteriaTestingOwner: "preProdCriteriaTesting",
      preProdCriteriaTestingStatus: "preProdCriteriaTesting",
      preProdCriteriaDocIssue: "preProdCriteriaDoc",
      preProdCriteriaDocOwner: "preProdCriteriaDoc",
      preProdCriteriaDocStatus: "preProdCriteriaDoc",
    };
    const valid = new Set(gridColumnDefinitions.map((column) => column.key));
    return [...new Set(columns.map((column) => replacements[column] || column).filter((column) => valid.has(column)))];
  }

  function stopSync() {
    if (!syncingRef.current) return;
    syncAbortControllerRef.current?.abort();
    setSyncStatus("interrupted");
    setSyncMessage("Sincronizacion Interrumpida");
    setSyncProgress("Deteniendo sincronizacion...");
    setNextSyncAt(filtersRef.current.length ? Date.now() + syncIntervalMs() : null);
  }

  function syncIntervalMs() {
    return Math.max(1, Number(appSettingsRef.current.syncIntervalMinutes || 5)) * 60000;
  }

  function formatCountdown(targetTime) {
    if (!targetTime || !hasFilters) return "";
    if (!autoSyncAllowed) return "Pausada";
    const remainingMs = Math.max(0, targetTime - now);
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts = [];
    if (hours) parts.push(`${hours}h`);
    if (hours || minutes) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    return parts.join(" ");
  }

  function isAutoSyncAllowed(schedule, date) {
    const weeklyWindows = schedule?.weeklyWindows || [];
    const specificDates = schedule?.specificDates || [];
    if (!weeklyWindows.length && !specificDates.length) return true;
    return specificDates.some((window) => matchesSpecificDate(window, date)) || weeklyWindows.some((window) => matchesWeeklyWindow(window, date));
  }

  function matchesSpecificDate(window, date) {
    return Number(window.month) === date.getMonth() + 1 && Number(window.day) === date.getDate() && isWithinTimeRange(window.start, window.end, date);
  }

  function matchesWeeklyWindow(window, date) {
    return (window.days || []).map(Number).includes(date.getDay()) && isWithinTimeRange(window.start, window.end, date);
  }

  function isWithinTimeRange(start, end, date) {
    const current = date.getHours() * 60 + date.getMinutes();
    return current >= toMinutes(start || "00:00") && current <= toMinutes(end || "23:59");
  }

  function toMinutes(value) {
    const [hours = "0", minutes = "0"] = String(value).split(":");
    return Number(hours) * 60 + Number(minutes);
  }

  async function selectIssue(issueKey, projectGroupId) {
    lastClickedGroupIdRef.current = projectGroupId || lastClickedGroupIdRef.current;
    if (selectedIssue?.issueKey === issueKey) {
      hideDetail();
      return;
    }
    setSelectedIssue(await get("issues", issueKey));
    setSelectedSubtasks(null);
    requestGridScroll(projectGroupId, "bottom");
  }

  function selectSubtasks(item, projectGroupId) {
    lastClickedGroupIdRef.current = projectGroupId || lastClickedGroupIdRef.current;
    setSelectedIssue(null);
    setSelectedSubtasks({
      issueKey: item.issueKey,
      status: item.status,
      progress: item.subtaskProgress,
      subtasks: item.subtasks || [],
    });
    requestGridScroll(projectGroupId, "bottom");
  }

  function hideDetail() {
    setSelectedIssue(null);
    setSelectedSubtasks(null);
    requestGridScroll(lastClickedGroupIdRef.current, "top");
  }

  function requestGridScroll(projectGroupId, position) {
    if (!projectGroupId) return;
    setGridScrollRequest({ projectGroupId, position, id: Date.now() });
  }

  function changeTab(value) {
    if (value === "settings") {
      setGridScrollRequest(null);
    }
    setTab(value);
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f5f7fa" }}>
      <AppBar position="sticky" color="inherit" elevation={1}>
        <Toolbar sx={{ gap: 2 }}>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 800 }}>
            Monitor de Incidencias Jira
          </Typography>
          <NotificationBell notifications={notifications} onChanged={refreshData} />
          <SyncStatus status={displayedSyncStatus} lastAttemptAt={lastAttemptAt} message={autoSyncPaused ? "Fuera del horario configurado" : syncProgress || syncMessage} />
          <Stack alignItems="center" spacing={0.25}>
            <Button
              variant="contained"
              color={syncingRef.current ? "warning" : "primary"}
              startIcon={syncingRef.current ? <Square size={17} /> : <RefreshCw size={17} />}
              disabled={!syncingRef.current && syncDisabled}
              onClick={syncingRef.current ? stopSync : handleSync}
            >
              {syncingRef.current ? "Detener Sincronización" : "Sincronizar"}
            </Button>
            <Typography variant="caption" color="text.secondary">
              {syncingRef.current ? "Sincronizando..." : hasFilters ? (autoSyncAllowed ? `Auto sync en ${formatCountdown(nextSyncAt)}` : "Auto sync pausada") : "Sin auto sync"}
            </Typography>
          </Stack>
          <Button variant="outlined" startIcon={<Settings size={17} />} onClick={() => changeTab("settings")}>
            Configuración
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth={false} disableGutters sx={{ px: "1cm", py: 3 }}>
        <Stack spacing={2}>
          {backendStatus?.status === "DOWN" ? (
            <Alert severity="error">Backend local no disponible: {backendStatus.error}</Alert>
          ) : null}
          {backendStatus?.jira?.configured === false ? (
            <Alert severity="warning">Jira no está configurado en el backend. Completa `config/application-local.yml` antes de probar contra Jira real.</Alert>
          ) : null}

          <Tabs value={tab} onChange={(_, value) => changeTab(value)}>
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
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, height: "calc(100vh - 190px)", minHeight: 520 }}>
              <ProjectGrid
                projectGroups={sortedProjectGroups}
                visibleColumns={visibleColumns}
                onIssueClick={selectIssue}
                onSubtasksClick={selectSubtasks}
                scrollRequest={gridScrollRequest}
              />
              <IssueDetail issue={selectedIssue} subtasks={selectedSubtasks} onClose={hideDetail} />
            </Box>
          )}
        </Stack>
      </Container>

      <Snackbar open={Boolean(snackbar)} autoHideDuration={5000} onClose={() => setSnackbar(null)}>
        {snackbar ? <Alert severity={snackbar.severity}>{snackbar.message}</Alert> : null}
      </Snackbar>
    </Box>
  );
}
