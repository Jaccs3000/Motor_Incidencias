import { openDB } from "idb";
import { writeBackendLog } from "../api/backendApi";

const DB_NAME = "monitor-incidencias";
const DB_VERSION = 1;

export const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains("appSettings")) db.createObjectStore("appSettings");
    if (!db.objectStoreNames.contains("jiraFilters")) db.createObjectStore("jiraFilters", { keyPath: "id" });
    if (!db.objectStoreNames.contains("alertRules")) db.createObjectStore("alertRules", { keyPath: "id" });
    if (!db.objectStoreNames.contains("issues")) db.createObjectStore("issues", { keyPath: "issueKey" });
    if (!db.objectStoreNames.contains("projectGroups")) db.createObjectStore("projectGroups", { keyPath: "projectGroupId" });
    if (!db.objectStoreNames.contains("gridPreferences")) db.createObjectStore("gridPreferences");
    if (!db.objectStoreNames.contains("notificationControl")) db.createObjectStore("notificationControl", { keyPath: "fingerprint" });
    if (!db.objectStoreNames.contains("notifications")) db.createObjectStore("notifications", { keyPath: "id" });
  },
});

export async function getSetting(key, fallback = null) {
  const db = await dbPromise;
  const value = await db.get("appSettings", key);
  return value ?? fallback;
}

export async function setSetting(key, value) {
  const db = await dbPromise;
  await db.put("appSettings", value, key);
  try {
    await writeBackendLog("db", "INFO", `setSetting ${key}`);
  } catch {
    // ignore logging errors
  }
}

export async function getAll(storeName) {
  const db = await dbPromise;
  return db.getAll(storeName);
}

export async function put(storeName, value) {
  const db = await dbPromise;
  await db.put(storeName, value);
  try {
    await writeBackendLog("db", "INFO", `put ${storeName} key=${JSON.stringify(value)}`);
  } catch {
    // ignore
  }
}

export async function del(storeName, key) {
  const db = await dbPromise;
  await db.delete(storeName, key);
  try {
    await writeBackendLog("db", "INFO", `del ${storeName} key=${key}`);
  } catch {
    // ignore
  }
}

export async function get(storeName, key) {
  const db = await dbPromise;
  return db.get(storeName, key);
}

export async function putMany(storeName, values) {
  const db = await dbPromise;
  const tx = db.transaction(storeName, "readwrite");
  await Promise.all(values.map((value) => tx.store.put(value)));
  await tx.done;
  try {
    await writeBackendLog("db", "INFO", `putMany ${storeName} count=${values.length}`);
  } catch {
    // ignore
  }
}

export async function clearStore(storeName) {
  const db = await dbPromise;
  await db.clear(storeName);
}
