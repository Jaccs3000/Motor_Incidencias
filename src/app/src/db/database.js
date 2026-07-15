import { openDB } from "idb";
import { writeBackendLog } from "../api/backendApi";
import { createSyncLogger } from "../utils/syncLogger";
import { copyValuesBetweenStores, writeValuesToTransaction } from "./transactionWriter";

const DB_NAME = "monitor-incidencias";
const DB_VERSION = 2;
const dbLogger = createSyncLogger({
  writeLog: () => {},
  emitBackendLog: writeBackendLog,
});

export const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains("appSettings")) db.createObjectStore("appSettings");
    if (!db.objectStoreNames.contains("jiraFilters")) db.createObjectStore("jiraFilters", { keyPath: "id" });
    if (!db.objectStoreNames.contains("alertRules")) db.createObjectStore("alertRules", { keyPath: "id" });
    if (!db.objectStoreNames.contains("issues")) db.createObjectStore("issues", { keyPath: "issueKey" });
    if (!db.objectStoreNames.contains("issuesMirror")) db.createObjectStore("issuesMirror", { keyPath: "issueKey" });
    if (!db.objectStoreNames.contains("projectGroups")) db.createObjectStore("projectGroups", { keyPath: "projectGroupId" });
    if (!db.objectStoreNames.contains("projectGroupsMirror")) db.createObjectStore("projectGroupsMirror", { keyPath: "projectGroupId" });
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
  try {
    dbLogger.info("db.setSetting", `Guardando ajuste ${key}`, { key, value });
    await db.put("appSettings", value, key);
    dbLogger.info("db.setSetting", `Ajuste guardado ${key}`, { key });
  } catch (error) {
    dbLogger.error("db.setSetting", error, { key });
    throw error;
  }
}

export async function getAll(storeName) {
  const db = await dbPromise;
  return db.getAll(storeName);
}

export async function put(storeName, value) {
  const db = await dbPromise;
  try {
    dbLogger.info("db.put", `Guardando registro en ${storeName}`, { storeName, value });
    await db.put(storeName, value);
    dbLogger.info("db.put", `Registro guardado en ${storeName}`, { storeName });
  } catch (error) {
    dbLogger.error("db.put", error, { storeName, value });
    throw error;
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
  try {
    dbLogger.info("db.putMany", `Iniciando escritura masiva en ${storeName}`, { storeName, count: values.length });
    const tx = db.transaction(storeName, "readwrite");
    await writeValuesToTransaction(tx, values);
    await tx.done;
    dbLogger.info("db.putMany", `Escritura masiva completada en ${storeName}`, { storeName, count: values.length });
  } catch (error) {
    dbLogger.error("db.putMany", error, { storeName, count: values.length });
    throw error;
  }
}

export async function clearStore(storeName) {
  const db = await dbPromise;
  try {
    dbLogger.info("db.clearStore", `Limpiando store ${storeName}`, { storeName });
    await db.clear(storeName);
    dbLogger.info("db.clearStore", `Store limpiado ${storeName}`, { storeName });
  } catch (error) {
    dbLogger.error("db.clearStore", error, { storeName });
    throw error;
  }
}

export async function copyStore(sourceStoreName, destinationStoreName) {
  const db = await dbPromise;
  try {
    dbLogger.info("db.copyStore", `Copiando ${sourceStoreName} -> ${destinationStoreName}`, { sourceStoreName, destinationStoreName });
    const copiedValues = await copyValuesBetweenStores(db, sourceStoreName, destinationStoreName);
    dbLogger.info("db.copyStore", `Copia finalizada ${sourceStoreName} -> ${destinationStoreName}`, { sourceStoreName, destinationStoreName, copied: copiedValues.length });
  } catch (error) {
    dbLogger.error("db.copyStore", error, { sourceStoreName, destinationStoreName });
    throw error;
  }
}

export async function getAllKeys(storeName) {
  const db = await dbPromise;
  return db.getAllKeys(storeName);
}
