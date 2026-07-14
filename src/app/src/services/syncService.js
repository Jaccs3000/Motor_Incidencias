import { acquireSyncLock, fetchIssuesByKeys, releaseSyncLock, searchJira, writeBackendLog } from "../api/backendApi";
import { monitorConfig } from "../config/monitorConfig";
import { clearStore, get, getAll, putMany, setSetting } from "../db/database";
import { buildJqlFromFilter } from "../utils/filters";
import { getAllNeighborKeys, isRelevantIssue, normalizeIssue } from "../utils/jiraExtractors";
import { buildProjectGroup } from "../utils/projectBuilder";
import { createNotificationsForIssue, getNotificationsDueToShow, showNativeNotification } from "./notificationService";

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Sincronizacion interrumpida", "AbortError"));
      return;
    }
    const timeout = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        reject(new DOMException("Sincronizacion interrumpida", "AbortError"));
      },
      { once: true },
    );
  });

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw new DOMException("Sincronizacion interrumpida", "AbortError");
  }
}

export async function runSynchronization({ jiraBaseUrl, onProgress, signal }) {
  let lock = null;
  const syncStartedAt = new Date().toISOString();
  const warnings = [];

  try {
    lock = await acquireSyncLock("monitor-incidencias-frontend");
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
      await sleep(monitorConfig.jiraRequest.delayBetweenRequestsMs, signal);
    }

    const issueMap = new Map();
    const projectGroups = [];
    const issuesToPersist = new Map();
    const notificationJobs = [];
    const groupedIssueKeys = new Set();
    const alertRules = await getAll("alertRules");

    for (let index = 0; index < seedRawIssues.length; index += 1) {
      throwIfAborted(signal);
      const seed = seedRawIssues[index];
      if (!seed?.key) {
        warnings.push(`Jira devolvio una incidencia sin key en la posicion ${index + 1}. Revisa los campos retornados por la busqueda.`);
        continue;
      }
      if (groupedIssueKeys.has(seed.key)) {
        continue;
      }
      onProgress?.(`Recorriendo proyecto ${index + 1} de ${seedRawIssues.length}...`);
      const traversal = await traverseProject(seed, jiraBaseUrl, issueMap, warnings, signal);
      const projectGroup = buildProjectGroup(seed.key, traversal.persistedIssueKeys, issueMap);
      if (!projectGroup.issueKeys.length) {
        warnings.push(`No se encontraron incidencias persistibles para ${seed.key}.`);
        continue;
      }
      projectGroups.push(projectGroup);
      for (const issueKey of traversal.projectIssueKeys) {
        groupedIssueKeys.add(issueKey);
      }

      for (const issueKey of traversal.persistedIssueKeys) {
        const currentIssue = issueMap.get(issueKey);
        const previousIssue = await get("issues", issueKey);
        currentIssue.projectGroupId = projectGroup.projectGroupId;
        notificationJobs.push({ alertRules, currentIssue, previousIssue, projectGroup });
        issuesToPersist.set(currentIssue.issueKey, currentIssue);
      }
    }

    const mergedProjectGroups = mergeProjectGroups(projectGroups);
    for (const projectGroup of mergedProjectGroups) {
      for (const issueKey of projectGroup.issueKeys) {
        const issue = issuesToPersist.get(issueKey);
        if (issue) issue.projectGroupId = projectGroup.projectGroupId;
      }
    }
    throwIfAborted(signal);
    await clearStore("projectGroups");
    await clearStore("issues");
    await putMany("projectGroups", mergedProjectGroups);
    await putMany("issues", [...issuesToPersist.values()]);
    for (const job of notificationJobs) {
      await createNotificationsForIssue(job);
    }
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
    if (error.name === "AbortError" || signal?.aborted) {
      await setSetting("lastSyncStatus", "interrupted");
      await setSetting("lastSyncMessage", "Sincronizacion Interrumpida");
      await writeBackendLog("sync", "WARN", "Sincronizacion interrumpida por el usuario");
      return {
        status: "interrupted",
        message: "Sincronizacion Interrumpida",
        projectCount: 0,
        warningCount: warnings.length,
      };
    }
    await setSetting("lastSyncStatus", "error");
    await setSetting("lastSyncMessage", error.message);
    await writeBackendLog("sync", "ERROR", error.message);
    throw error;
  } finally {
    if (lock?.id) {
      await releaseSyncLock(lock.id);
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
        await sleep(monitorConfig.jiraRequest.delayBetweenRequestsMs, signal);
      } catch (error) {
        if (error.name === "AbortError" || signal?.aborted) throw error;
        warnings.push(`No se pudieron consultar incidencias: ${missingKeys.join(", ")}`);
        continue;
      }
    }

    for (const rawIssue of rawIssues) {
      if (!rawIssue?.key || visited.has(rawIssue.key)) continue;
      visited.add(rawIssue.key);
      rawByKey.set(rawIssue.key, rawIssue);

      if (!isRelevantIssue(rawIssue)) {
        continue;
      }

      projectIssueKeys.add(rawIssue.key);
      const normalized = normalizeIssue(rawIssue, jiraBaseUrl);
      issueMap.set(normalized.issueKey, normalized);
      persistedIssueKeys.add(normalized.issueKey);

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
