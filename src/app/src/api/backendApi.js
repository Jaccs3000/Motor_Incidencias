import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api",
  timeout: 60000,
});

export async function getHealth() {
  const { data } = await api.get("/health");
  return data;
}

export async function searchJira(jql, options = {}) {
  const { data } = await api.post("/jira/search", { jql }, { signal: options.signal });
  return data;
}

export async function fetchIssuesByKeys(issueKeys, options = {}) {
  const { data } = await api.post("/jira/issues", { issueKeys }, { signal: options.signal });
  return data;
}

export async function acquireSyncLock(owner = "frontend", options = {}) {
  try {
    const { data } = await api.post("/sync-lock/acquire", { owner, force: Boolean(options.force) }, { signal: options.signal });
    return data.lock;
  } catch (error) {
    if (error.response?.status === 409) {
      throw Object.assign(new Error(error.response.data?.error || "Ya existe una sincronizacion en curso."), { code: "LOCK_CONFLICT" });
    }
    throw error;
  }
}

export async function getSyncLockStatus() {
  const { data } = await api.get("/sync-lock");
  return data;
}

export async function releaseSyncLock(lockId, options = {}) {
  await api.post("/sync-lock/release", { lockId }, { signal: options.signal });
}

export async function refreshSyncLock(lockId, options = {}) {
  await api.post("/sync-lock/refresh", { lockId }, { signal: options.signal });
}

export async function writeBackendLog(area, level, message) {
  try {
    await api.post("/logs", { area, level, message });
  } catch {
    // Frontend logging should never interrupt the user flow.
  }
}
