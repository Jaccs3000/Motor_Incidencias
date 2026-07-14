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

export async function acquireSyncLock(owner = "frontend") {
  try {
    const { data } = await api.post("/sync-lock/acquire", { owner });
    return data.lock;
  } catch (error) {
    if (error.response?.status === 409) {
      throw new Error(error.response.data?.error || "Ya existe una sincronizacion en curso.");
    }
    throw error;
  }
}

export async function releaseSyncLock(lockId) {
  await api.post("/sync-lock/release", { lockId });
}

export async function refreshSyncLock(lockId) {
  await api.post("/sync-lock/refresh", { lockId });
}

export async function writeBackendLog(area, level, message) {
  try {
    await api.post("/logs", { area, level, message });
  } catch {
    // Frontend logging should never interrupt the user flow.
  }
}
