import { acquireSyncLock, fetchIssuesByKeys, getSyncLockStatus, releaseSyncLock, searchJira, writeBackendLog } from "../api/backendApi";
import { monitorConfig } from "../config/monitorConfig";
import { clearStore, copyStore, getAll, putMany, setSetting, getSetting, put } from "../db/database";
import { buildJqlFromFilter } from "../utils/filters";
import { getAllNeighborKeys, isRelevantIssue, normalizeIssue } from "../utils/jiraExtractors";
import { buildProjectGroup } from "../utils/projectBuilder";
import { createNotificationsForIssue, generateAlertsAfterSync, getNotificationsDueToShow, showNativeNotification } from "./notificationService";
import { retryWithBackoff } from "../utils/retry";
import { createSyncLogger } from "../utils/syncLogger";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createSyncLoggerWithBackend() {
  return createSyncLogger({
    writeLog: (entry) => console.log(`[sync:${entry.step}] ${entry.level} ${entry.message}`, entry.details),
    emitBackendLog: writeBackendLog,
  });
}

export async function runSynchronization({ jiraBaseUrl, filters: syncFilters = null, onProgress, signal }) {
  let lock = null;
  const syncStartedAt = new Date().toISOString();
  const warnings = [];
  const logger = createSyncLoggerWithBackend();

  try {
    throwIfAborted(signal);
    logger.info("sync.start", "Inicio de sincronización", { syncStartedAt });
    lock = await acquireSyncLockWithRecovery("monitor-incidencias-frontend", signal);
    logger.info("sync.lock", "Lock adquirido", { lockId: lock?.id });
    throwIfAborted(signal);
    onProgress?.("Ejecutando filtros Jira...");
    await setSetting("lastSyncAttemptAt", syncStartedAt);
    await setSetting("lastSyncStatus", "syncing");

    logger.info("sync.prepare", "Preparando stores espejo", {});
    await clearStore("issuesMirror");
    await clearStore("projectGroupsMirror");
    await copyStore("issues", "issuesMirror");
    await copyStore("projectGroups", "projectGroupsMirror");

    const filters = syncFilters || (await getAll("jiraFilters"));
    logger.info("sync.filters", `Se encontraron ${filters.length} filtros`, { count: filters.length });
    if (!filters.length) {
      throw new Error("No hay filtros Jira configurados.");
    }

    const seedRawIssues = [];
    for (const filter of filters) {
      throwIfAborted(signal);
      logger.info("sync.filter", `Consultando filtro ${filter.id || filter.name || "sin-nombre"}`, { filter });
      const jql = buildJqlFromFilter(filter);
      const result = await searchJira(jql, { signal });
      logger.info("sync.filter", `Respuesta Jira recibida para filtro ${filter.id || filter.name || "sin-nombre"}`, { issueCount: result?.issues?.length || 0 });
      seedRawIssues.push(...(result.issues || []));
      await sleep(monitorConfig.jiraRequest.delayBetweenRequestsMs);
    }

    const issueMap = new Map();
    const projectGroups = [];
    const issuesToPersist = new Map();
    let alertRules = await getAll("alertRules");
    try {
      await writeBackendLog("notifications", "INFO", `Loaded alertRules count=${alertRules.length}`);
    } catch {
      // ignore
    }

    // Test injection: if a test flag is set in appSettings, create a test alertRule
    try {
      const testInject = await getSetting("test.injectAlert");
      if (testInject && testInject.issueKey) {
        const testAlert = {
          id: testInject.id || `test-${crypto.randomUUID()}`,
          name: testInject.name || `TEST ${testInject.issueKey}`,
          jql: `issue = ${testInject.issueKey}`,
          actionType: testInject.actionType || "update",
          messageTemplate: testInject.messageTemplate || "{{issueKey}} cumple alerta de prueba",
          conditions: [],
        };
        try {
          await put("alertRules", testAlert);
          await writeBackendLog("notifications", "INFO", `Injected test alert ${testAlert.id} for ${testInject.issueKey}`);
        } catch (e) {
          // ignore
        }
        alertRules = await getAll("alertRules");
        try {
          await writeBackendLog("notifications", "INFO", `Reloaded alertRules count=${alertRules.length}`);
        } catch {}
      }
    } catch (e) {
      // ignore
    }

    for (let index = 0; index < seedRawIssues.length; index += 1) {
      throwIfAborted(signal);
      const seed = seedRawIssues[index];
      if (!seed?.key) {
        warnings.push(`Jira devolvio una incidencia sin key en la posicion ${index + 1}. Revisa los campos retornados por la busqueda.`);
        continue;
      }
      onProgress?.(`Recorriendo proyecto ${index + 1} de ${seedRawIssues.length}...`);
      logger.info("sync.project", `Recorriendo proyecto ${seed.key}`, { index: index + 1, total: seedRawIssues.length, seedKey: seed.key });
      const traversal = await traverseProject(seed, jiraBaseUrl, issueMap, warnings, signal, logger);
      const projectGroup = buildProjectGroup(seed.key, traversal.projectIssueKeys, issueMap);
      if (!projectGroup.issueKeys.length) {
        warnings.push(`No se encontraron incidencias persistibles para ${seed.key}.`);
        continue;
      }
      projectGroups.push(projectGroup);

      for (const issueKey of traversal.persistedIssueKeys) {
        const currentIssue = issueMap.get(issueKey);
        currentIssue.projectGroupId = projectGroup.projectGroupId;
        issuesToPersist.set(currentIssue.issueKey, currentIssue);
      }
    }

    const mergedProjectGroups = mergeProjectGroups(projectGroups);
    logger.info("sync.persist", `Persistiendo ${mergedProjectGroups.length} grupos y ${issuesToPersist.size} incidencias`, { projectGroupCount: mergedProjectGroups.length, issueCount: issuesToPersist.size });
    await clearStore("projectGroups");
    await clearStore("issues");
    await putMany("projectGroups", mergedProjectGroups);
    await putMany("issues", [...issuesToPersist.values()]);

    const createdNotifications = await generateAlertsAfterSync({ alertRules });
    try {
      await writeBackendLog("notifications", "INFO", `generateAlertsAfterSync created=${createdNotifications.length}`);
    } catch {
      // ignore
    }

    await setSetting("lastSyncStatus", warnings.length ? "warning" : "success");
    await setSetting("lastSyncMessage", warnings.length ? warnings.join(" | ") : "Sincronizado correctamente");
    logger.info("sync.finish", `Sincronizacion finalizada. Proyectos: ${projectGroups.length}. Advertencias: ${warnings.length}`, { projectCount: projectGroups.length, warningCount: warnings.length });
    await writeBackendLog("sync", warnings.length ? "WARN" : "INFO", `Sincronizacion finalizada. Proyectos: ${projectGroups.length}. Advertencias: ${warnings.length}`);

    const dueNotifications = await getNotificationsDueToShow();
    try {
      await writeBackendLog("notifications", "INFO", `Native notification attempt count=${dueNotifications.length}`);
    } catch {
      // ignore
    }
    for (const notification of dueNotifications) {
      try {
        await showNativeNotification(notification);
      } catch (error) {
        try {
          await writeBackendLog("notifications", "WARN", `showNativeNotification failed id=${notification.id} error=${String(error?.message || error)}`);
        } catch {
          // ignore
        }
      }
      await sleep(700);
    }

    return {
      status: warnings.length ? "warning" : "success",
      message: warnings.length ? "Sincronización con advertencias" : "Sincronizado correctamente",
      projectCount: projectGroups.length,
      warningCount: warnings.length,
    };
  } catch (error) {
    const interrupted = isAbortError(error) || signal?.aborted;
    logger.error("sync.error", error, { interrupted });
    await setSetting("lastSyncStatus", interrupted ? "interrupted" : "error");
    await setSetting("lastSyncMessage", interrupted ? "Sincronización interrumpida" : error.message);
    await writeBackendLog("sync", interrupted ? "WARN" : "ERROR", interrupted ? "Sincronizacion interrumpida por el usuario." : error.message);
    if (!interrupted) {
      throw error;
    }
    throw Object.assign(new Error("Sincronización interrumpida"), { name: "AbortError", code: "ABORTED" });
  } finally {
    logger.info("sync.cleanup", "Limpiando stores espejo y liberando lock", { lockId: lock?.id });
    await clearStore("issuesMirror");
    await clearStore("projectGroupsMirror");
    if (lock?.id) {
      await releaseSyncLock(lock.id, { signal });
    }
    await logger.flush(`sync-${syncStartedAt}`);
  }
}

async function traverseProject(seedRawIssue, jiraBaseUrl, issueMap, warnings, signal, logger) {
  const visited = new Set();
  const pending = [seedRawIssue.key];
  const rawByKey = new Map([[seedRawIssue.key, seedRawIssue]]);
  const projectIssueKeys = new Set();
  const persistedIssueKeys = new Set();

  while (pending.length) {
    throwIfAborted(signal);
    const batchKeys = pending.splice(0, monitorConfig.jiraRequest.maxIssuesPerBatch).filter((key) => !visited.has(key));
    if (!batchKeys.length) continue;

    let rawIssues = batchKeys.map((key) => rawByKey.get(key)).filter(Boolean);
    const missingKeys = batchKeys.filter((key) => !rawByKey.has(key));
    logger.info("sync.traverse", `Consultando ${batchKeys.length} incidencias del lote`, { batchKeys, missingKeys });

    if (missingKeys.length) {
      try {
        logger.info("sync.traverse", `Consultando incidencias faltantes ${missingKeys.join(", ")}`, { missingKeys });
        const response = await fetchIssuesByKeys(missingKeys, { signal });
        logger.info("sync.traverse", `Respuesta de incidencias faltantes recibida`, { missingKeys, issueCount: response?.issues?.length || 0 });
        rawIssues.push(...(response.issues || []));
        await sleep(monitorConfig.jiraRequest.delayBetweenRequestsMs);
      } catch (error) {
        logger.error("sync.traverse", error, { missingKeys });
        warnings.push(`No se pudieron consultar incidencias: ${missingKeys.join(", ")}`);
        continue;
      }
    }

    for (const rawIssue of rawIssues) {
      throwIfAborted(signal);
      if (!rawIssue?.key || visited.has(rawIssue.key)) continue;
      logger.info("sync.traverse", `Procesando incidencia ${rawIssue.key}`, { issueKey: rawIssue.key });
      visited.add(rawIssue.key);
      projectIssueKeys.add(rawIssue.key);
      rawByKey.set(rawIssue.key, rawIssue);

      if (isRelevantIssue(rawIssue)) {
        const normalized = normalizeIssue(rawIssue, jiraBaseUrl);
        logger.info("sync.traverse", `Incidencia persistible ${normalized.issueKey}`, { issueKey: normalized.issueKey });
        issueMap.set(normalized.issueKey, normalized);
        persistedIssueKeys.add(normalized.issueKey);
      }

      for (const neighborKey of getAllNeighborKeys(rawIssue)) {
        if (!visited.has(neighborKey) && !pending.includes(neighborKey)) {
          pending.push(neighborKey);
        }
      }
    }
  }

  return {
    projectIssueKeys: [...projectIssueKeys],
    persistedIssueKeys: [...persistedIssueKeys],
  };
}

async function acquireSyncLockWithRecovery(owner, signal) {
  try {
    return await acquireSyncLock(owner, { signal });
  } catch (error) {
    if (error?.code !== "LOCK_CONFLICT") {
      throw error;
    }
    return acquireSyncLock(owner, { force: true, signal });
  }
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw Object.assign(new Error("Sincronización interrumpida"), { name: "AbortError", code: "ABORTED" });
  }
}

function isAbortError(error) {
  return error?.name === "AbortError" || error?.code === "ABORTED" || error?.code === "ERR_CANCELED";
}

function mergeProjectGroups(groups) {
  const merged = new Map();
  for (const group of groups) {
    const existingEntry = [...merged.values()].find((item) => item.issueKeys.some((key) => group.issueKeys.includes(key)));
    if (!existingEntry) {
      merged.set(group.projectGroupId, group);
      continue;
    }
    const issueKeys = [...new Set([...existingEntry.issueKeys, ...group.issueKeys])];
    merged.delete(existingEntry.projectGroupId);
    merged.set(issueKeys.sort().join("|"), {
      ...existingEntry,
      projectGroupId: issueKeys.sort().join("|"),
      issueKeys,
      updatedAt: new Date().toISOString(),
    });
  }
  return [...merged.values()];
}
