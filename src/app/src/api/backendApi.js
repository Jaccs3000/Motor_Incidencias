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
  const { data } = await api.post("/sync-lock/acquire", { owner });
  return data.lock;
}

export async function releaseSyncLock(lockId) {
  await api.post("/sync-lock/release", { lockId });
}

export async function writeBackendLog(area, level, message) {
  try {
    await api.post("/logs", { area, level, message });
  } catch {
    // Frontend logging should never interrupt the user flow.
  }
}
