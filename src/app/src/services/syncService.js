import { acquireSyncLock, fetchIssuesByKeys, getSyncLockStatus, releaseSyncLock, searchJira, writeBackendLog } from "../api/backendApi";
import { monitorConfig } from "../config/monitorConfig";
import { clearStore, get, getAll, putMany, setSetting } from "../db/database";
import { buildJqlFromFilter } from "../utils/filters";
import { getAllNeighborKeys, isRelevantIssue, normalizeIssue } from "../utils/jiraExtractors";
import { buildProjectGroup } from "../utils/projectBuilder";
import { createNotificationsForIssue, getNotificationsDueToShow, showNativeNotification } from "./notificationService";
import { retryWithBackoff } from "../utils/retry";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runSynchronization({ jiraBaseUrl, onProgress, signal }) {
  let lock = null;
  const syncStartedAt = new Date().toISOString();
  const warnings = [];

  try {
    throwIfAborted(signal);
    lock = await acquireSyncLockWithRecovery("monitor-incidencias-frontend", signal);
    throwIfAborted(signal);
    onProgress?.("Ejecutando filtros Jira...");
    await setSetting("lastSyncAttemptAt", syncStartedAt);
    await setSetting("lastSyncStatus", "syncing");

    const filters = await getAll("jiraFilters");
    if (!filters.length) {
      throw new Error("No hay filtros Jira configurados.");
    }

    const seedRawIssues = [];
    for (const filter of filters) {
      throwIfAborted(signal);
      const jql = buildJqlFromFilter(filter);
      const result = await searchJira(jql, { signal });
      seedRawIssues.push(...(result.issues || []));
      await sleep(monitorConfig.jiraRequest.delayBetweenRequestsMs);
    }

    const issueMap = new Map();
    const projectGroups = [];
    const issuesToPersist = new Map();
    const alertRules = await getAll("alertRules");

    for (let index = 0; index < seedRawIssues.length; index += 1) {
      throwIfAborted(signal);
      const seed = seedRawIssues[index];
      if (!seed?.key) {
        warnings.push(`Jira devolvio una incidencia sin key en la posicion ${index + 1}. Revisa los campos retornados por la busqueda.`);
        continue;
      }
      onProgress?.(`Recorriendo proyecto ${index + 1} de ${seedRawIssues.length}...`);
      const traversal = await traverseProject(seed, jiraBaseUrl, issueMap, warnings, signal);
      const projectGroup = buildProjectGroup(seed.key, traversal.projectIssueKeys, issueMap);
      if (!projectGroup.issueKeys.length) {
        warnings.push(`No se encontraron incidencias persistibles para ${seed.key}.`);
        continue;
      }
      projectGroups.push(projectGroup);

      for (const issueKey of traversal.persistedIssueKeys) {
        const currentIssue = issueMap.get(issueKey);
        const previousIssue = await get("issues", issueKey);
        currentIssue.projectGroupId = projectGroup.projectGroupId;
        await createNotificationsForIssue({ alertRules, currentIssue, previousIssue, projectGroup });
        issuesToPersist.set(currentIssue.issueKey, currentIssue);
      }
    }

    const mergedProjectGroups = mergeProjectGroups(projectGroups);
    await clearStore("projectGroups");
    await clearStore("issues");
    await putMany("projectGroups", mergedProjectGroups);
    await putMany("issues", [...issuesToPersist.values()]);
    await setSetting("lastSyncStatus", warnings.length ? "warning" : "success");
    await setSetting("lastSyncMessage", warnings.length ? warnings.join(" | ") : "Sincronizado correctamente");
    await writeBackendLog("sync", warnings.length ? "WARN" : "INFO", `Sincronizacion finalizada. Proyectos: ${projectGroups.length}. Advertencias: ${warnings.length}`);

    const dueNotifications = await getNotificationsDueToShow();
    for (const notification of dueNotifications) {
      await showNativeNotification(notification);
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
    await setSetting("lastSyncStatus", interrupted ? "interrupted" : "error");
    await setSetting("lastSyncMessage", interrupted ? "Sincronización interrumpida" : error.message);
    await writeBackendLog("sync", interrupted ? "WARN" : "ERROR", interrupted ? "Sincronizacion interrumpida por el usuario." : error.message);
    if (!interrupted) {
      throw error;
    }
    throw Object.assign(new Error("Sincronización interrumpida"), { name: "AbortError", code: "ABORTED" });
  } finally {
    if (lock?.id) {
      await releaseSyncLock(lock.id, { signal });
    }
  }
}

async function traverseProject(seedRawIssue, jiraBaseUrl, issueMap, warnings, signal) {
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

    if (missingKeys.length) {
      try {
        const response = await fetchIssuesByKeys(missingKeys, { signal });
        rawIssues.push(...(response.issues || []));
        await sleep(monitorConfig.jiraRequest.delayBetweenRequestsMs);
      } catch (error) {
        warnings.push(`No se pudieron consultar incidencias: ${missingKeys.join(", ")}`);
        continue;
      }
    }

    for (const rawIssue of rawIssues) {
      throwIfAborted(signal);
      if (!rawIssue?.key || visited.has(rawIssue.key)) continue;
      visited.add(rawIssue.key);
      projectIssueKeys.add(rawIssue.key);
      rawByKey.set(rawIssue.key, rawIssue);

      if (isRelevantIssue(rawIssue)) {
        const normalized = normalizeIssue(rawIssue, jiraBaseUrl);
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
