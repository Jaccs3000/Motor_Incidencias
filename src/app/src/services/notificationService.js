import { getAll, put } from "../db/database";
import { getMyself, writeBackendLog } from "../api/backendApi";
import { monitorConfig } from "../config/monitorConfig";
import { evaluateConditions } from "../utils/filters";

const FIELD_ALIASES = {
  type: "issueType",
  issuetype: "issueType",
  assignee: "assignee",
  assigneeaccountid: "assigneeAccountId",
  reporter: "reporter",
  reporteraccountid: "reporterAccountId",
  creator: "creator",
  creatoraccountid: "creatorAccountId",
  issuetype: "issueType",
  status: "status",
  summary: "summary",
  priority: "priority",
  project: "projectKey",
  projectkey: "projectKey",
  issuekey: "issueKey",
  issue: "issueKey",
};

export function buildAlertContext(currentIssue, previousIssue, projectGroup) {
  const issue = currentIssue || previousIssue || {};
  return {
    issueKey: issue.issueKey || "",
    issueType: issue.issueType || "",
    status: currentIssue?.status ?? previousIssue?.status ?? "",
    previousStatus: previousIssue?.status || "",
    assignee: currentIssue?.attributes?.assignee || previousIssue?.attributes?.assignee || "",
    previousAssignee: previousIssue?.attributes?.assignee || "",
    assigneeAccountId: currentIssue?.attributes?.assigneeAccountId || previousIssue?.attributes?.assigneeAccountId || "",
    previousAssigneeAccountId: previousIssue?.attributes?.assigneeAccountId || "",
    reporter: currentIssue?.attributes?.reporter || previousIssue?.attributes?.reporter || "",
    reporterAccountId: currentIssue?.attributes?.reporterAccountId || previousIssue?.attributes?.reporterAccountId || "",
    creator: currentIssue?.attributes?.creator || previousIssue?.attributes?.creator || "",
    creatorAccountId: currentIssue?.attributes?.creatorAccountId || previousIssue?.attributes?.creatorAccountId || "",
    summary: issue.summary || "",
    isNew: !previousIssue,
    isDeleted: currentIssue == null && previousIssue != null,
    projectGroupId: projectGroup?.projectGroupId || "",
    ...(projectGroup?.computedFields || {}),
    ...((currentIssue || previousIssue)?.attributes || {}),
  };
}

export function buildFingerprint(alertRule, context, actionType) {
  return [
    alertRule.id,
    actionType,
    context.issueKey,
    context.projectGroupId,
    context.issueType,
    context.status,
    context.previousStatus,
    context.assignee,
    context.previousAssignee,
    alertRule.messageTemplate,
  ].join("|");
}

function normalizeFieldName(fieldName) {
  const normalized = String(fieldName || "").trim().toLowerCase();
  return FIELD_ALIASES[normalized] || normalized;
}

let currentUserCache = null;

async function getCurrentUser() {
  if (currentUserCache) return currentUserCache;
  try {
    currentUserCache = await getMyself();
    return currentUserCache;
  } catch {
    return null;
  }
}

function resolveExpectedValue(expected, currentUser) {
  const text = String(expected ?? "").trim();
  if (text.toLowerCase() === "currentuser()") {
    if (!currentUser) return "";
    return (
      currentUser.displayName ||
      currentUser.name ||
      currentUser.emailAddress ||
      currentUser.accountId ||
      ""
    );
  }
  return text;
}

function parseJqlToConditions(jql) {
  if (!jql || !jql.trim()) return [];
  const parts = jql.split(/\s+\b(AND|OR)\b\s+/i);
  const conditions = [];
  for (let index = 0; index < parts.length; index += 2) {
    const clause = parts[index].trim();
    if (!clause) continue;
    const joiner = index === 0 ? undefined : String(parts[index - 1]).toUpperCase();
    const match = clause.match(/^(\w+)\s*(=|!=|~|!~|>=|<=|>|<)\s*(?:"([^"]*)"|([^\s]+))$/i);
    if (!match) continue;
    const field = normalizeFieldName(match[1]);
    let operator = match[2];
    const value = match[3] ?? match[4] ?? "";
    // Normalize JQL operators to internal names understood by evaluateCondition
    if (operator === "~") operator = "contains";
    if (operator === "!~") operator = "not_contains";
    conditions.push({ field, operator, value, joiner: joiner === "OR" ? "OR" : "AND" });
  }
  return conditions;
}

function getAlertConditions(alertRule) {
  if (alertRule.jql?.trim()) {
    return parseJqlToConditions(alertRule.jql);
  }
  return alertRule.conditions || [];
}

function doesIssueMatchRule(issue, alertRule, currentUser) {
  if (!issue) return false;
  const context = buildAlertContext(issue, null, null);
  const conditions = getAlertConditions(alertRule).map((condition) => ({
    ...condition,
    value: resolveExpectedValue(condition.value, currentUser),
  }));
  if (!conditions.length) return false;
  const matches = evaluateConditions(context, conditions);
  try {
    writeBackendLog("notifications", "INFO", `Rule evaluation alert=${alertRule.id} issue=${issue.issueKey} matches=${matches} conditions=${JSON.stringify(conditions)} context=${JSON.stringify({ status: context.status, previousStatus: context.previousStatus, assignee: context.assignee, issueType: context.issueType })}`);
  } catch {
    // ignore
  }
  return matches;
}

function isUpdateEligible(currentIssue, previousIssue, alertRule, currentUser) {
  if (!currentIssue || !previousIssue) return false;
  const currentText = JSON.stringify(currentIssue);
  const previousText = JSON.stringify(previousIssue);
  if (currentText === previousText) return false;
  const currentMatches = doesIssueMatchRule(currentIssue, alertRule, currentUser);
  if (!currentMatches) return false;
  const previousMatches = doesIssueMatchRule(previousIssue, alertRule, currentUser);
  return !previousMatches;
}

function isInsertEligible(currentIssue, previousIssue, alertRule, currentUser) {
  if (!currentIssue || previousIssue) return false;
  return doesIssueMatchRule(currentIssue, alertRule, currentUser);
}

function isDeleteEligible(currentIssue, previousIssue, alertRule, currentUser) {
  if (!previousIssue || currentIssue) return false;
  return doesIssueMatchRule(previousIssue, alertRule, currentUser);
}

export async function createNotificationsForIssue({ alertRules, currentIssue, previousIssue, projectGroup, actionType, currentUser }) {
  const existing = await getAll("notifications");
  const unreadFingerprints = new Set(existing.filter((item) => item.status === "unread").map((item) => item.fingerprint));
  const created = [];

  for (const alertRule of alertRules) {
    if (!alertRule.actionType || alertRule.actionType.toLowerCase() !== actionType.toLowerCase()) continue;
    let eligible = false;
    if (actionType === "insert") eligible = isInsertEligible(currentIssue, previousIssue, alertRule, currentUser);
    if (actionType === "update") eligible = isUpdateEligible(currentIssue, previousIssue, alertRule, currentUser);
    if (actionType === "delete") eligible = isDeleteEligible(currentIssue, previousIssue, alertRule, currentUser);
    try {
      writeBackendLog("notifications", "INFO", `Alert evaluation alert=${alertRule.id} action=${actionType} issue=${currentIssue?.issueKey ?? previousIssue?.issueKey ?? ""} eligible=${eligible}`);
    } catch {
      // ignore
    }
    if (!eligible) continue;

    const context = buildAlertContext(currentIssue, previousIssue, projectGroup);
    const fingerprint = buildFingerprint(alertRule, context, actionType);
    if (unreadFingerprints.has(fingerprint)) continue;

    const issueKey = currentIssue?.issueKey ?? previousIssue?.issueKey ?? "";
    const now = new Date();
    const notification = {
      id: crypto.randomUUID(),
      fingerprint,
      alertRuleId: alertRule.id,
      title: alertRule.name || "Alerta",
      message: renderMessage(alertRule.messageTemplate, context),
      issueKey,
      projectGroupId: projectGroup?.projectGroupId || "",
      status: "unread",
      createdAt: now.toISOString(),
      firstShownAt: null,
      lastShownAt: null,
      nextReminderAt: now.toISOString(),
      readAt: null,
    };
    await put("notifications", notification);
    await put("notificationControl", {
      fingerprint,
      alertRuleId: alertRule.id,
      issueKey,
      projectGroupId: projectGroup?.projectGroupId || "",
      notifiedAt: now.toISOString(),
    });
    unreadFingerprints.add(fingerprint);
    created.push(notification);
    try {
      await writeBackendLog("notifications", "INFO", `Created notification ${notification.id} issue=${notification.issueKey}`);
    } catch {
      // ignore
    }
  }

  return created;
}

export async function generateAlertsAfterSync({ alertRules }) {
  const currentUser = await getCurrentUser();
  const currentIssues = await getAll("issues");
  const previousIssues = await getAll("issuesMirror");
  const currentGroups = await getAll("projectGroups");
  const previousGroups = await getAll("projectGroupsMirror");

  try {
    await writeBackendLog(
      "notifications",
      "INFO",
      `Snapshot previousIssues count=${previousIssues.length} preview=${JSON.stringify(
        previousIssues.map((i) => ({ issueKey: i.issueKey, status: i.status, assignee: i.attributes?.assignee, issueType: i.issueType }))
      )}`
    );
  } catch {
    // ignore logging failure
  }
  try {
    await writeBackendLog(
      "notifications",
      "INFO",
      `Snapshot currentIssues count=${currentIssues.length} preview=${JSON.stringify(
        currentIssues.map((i) => ({ issueKey: i.issueKey, status: i.status, assignee: i.attributes?.assignee, issueType: i.issueType }))
      )}`
    );
  } catch {
    // ignore
  }

  const currentIssueMap = new Map(currentIssues.map((issue) => [issue.issueKey, issue]));
  const previousIssueMap = new Map(previousIssues.map((issue) => [issue.issueKey, issue]));
  const currentGroupByIssue = buildProjectGroupIndex(currentGroups);
  const previousGroupByIssue = buildProjectGroupIndex(previousGroups);
  const notifications = [];

  // Log alertRules JQL and parsed translation for easier debugging
  try {
    for (const ar of alertRules || []) {
      const parsed = getAlertConditions(ar) || [];
      await writeBackendLog("notifications", "INFO", `AlertRule ${ar.id} jql=${String(ar.jql || "")} parsed=${JSON.stringify(parsed)}`);
    }
  } catch {
    // ignore
  }

  for (const [issueKey, currentIssue] of currentIssueMap.entries()) {
    const previousIssue = previousIssueMap.get(issueKey) || null;
    const projectGroup = currentGroupByIssue.get(issueKey) || previousGroupByIssue.get(issueKey) || null;
    if (!previousIssue) {
      notifications.push(...(await createNotificationsForIssue({ alertRules, currentIssue, previousIssue, projectGroup, actionType: "insert", currentUser })));
      continue;
    }
    if (JSON.stringify(currentIssue) !== JSON.stringify(previousIssue)) {
      notifications.push(...(await createNotificationsForIssue({ alertRules, currentIssue, previousIssue, projectGroup, actionType: "update", currentUser })));
    }
  }

  for (const [issueKey, previousIssue] of previousIssueMap.entries()) {
    if (!currentIssueMap.has(issueKey)) {
      const projectGroup = previousGroupByIssue.get(issueKey) || null;
      notifications.push(...(await createNotificationsForIssue({ alertRules, currentIssue: null, previousIssue, projectGroup, actionType: "delete", currentUser })));
    }
  }

  return notifications;
}

function buildProjectGroupIndex(groups) {
  const index = new Map();
  for (const group of groups) {
    (group.issueKeys || []).forEach((issueKey) => index.set(issueKey, group));
  }
  return index;
}

export async function getUnreadNotifications() {
  const all = await getAll("notifications");
  return all.filter((item) => item.status === "unread").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function markNotificationRead(notification) {
  await put("notifications", {
    ...notification,
    status: "read",
    readAt: new Date().toISOString(),
  });
  try {
    await writeBackendLog("notifications", "INFO", `Marked read ${notification.id}`);
  } catch {
    // ignore
  }
}

export async function getNotificationsDueToShow() {
  const now = new Date();
  const unread = await getUnreadNotifications();
  return unread.filter((item) => !item.nextReminderAt || new Date(item.nextReminderAt) <= now);
}

export async function markNotificationShown(notification) {
  const now = new Date();
  const nextReminder = new Date(now.getTime() + monitorConfig.notifications.unreadReminderIntervalMinutes * 60000);
  await put("notifications", {
    ...notification,
    firstShownAt: notification.firstShownAt || now.toISOString(),
    lastShownAt: now.toISOString(),
    nextReminderAt: nextReminder.toISOString(),
  });
  try {
    await writeBackendLog("notifications", "INFO", `Shown notification ${notification.id}`);
  } catch {
    // ignore
  }
}

export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    try {
      await writeBackendLog("notifications", "WARN", "Native notifications unsupported in this browser");
    } catch {
      // ignore
    }
    return "unsupported";
  }

  if (Notification.permission !== "default") {
    try {
      await writeBackendLog("notifications", "INFO", `Notification permission state=${Notification.permission}`);
    } catch {
      // ignore
    }
    return Notification.permission;
  }

  const permission = await Notification.requestPermission();
  try {
    await writeBackendLog("notifications", "INFO", `Notification permission result=${permission}`);
  } catch {
    // ignore
  }
  return permission;
}

export async function showNativeNotification(notification) {
  const title = notification.title || "Alerta";
  const message = notification.message || "Tienes una nueva alerta";

  try {
    const response = await fetch("http://127.0.0.1:3000/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, message }),
    });
    const payload = await response.text();
    await markNotificationShown(notification);
    try {
      await writeBackendLog("notifications", "INFO", `Windows toast sent ${notification.id} status=${response.status} payload=${payload}`);
    } catch {
      // ignore
    }
    return;
  } catch (error) {
    try {
      await writeBackendLog("notifications", "WARN", `Windows toast failed id=${notification.id} error=${String(error?.message || error)}`);
    } catch {
      // ignore
    }
  }

  if ("Notification" in window) {
    const permission = Notification.permission === "default"
      ? await requestNotificationPermission()
      : Notification.permission;

    if (permission === "granted") {
      const native = new Notification(title, {
        body: message,
        tag: notification.fingerprint,
      });
      native.onclick = () => window.focus();
      await markNotificationShown(notification);
      try {
        await writeBackendLog("notifications", "INFO", `Browser notification shown ${notification.id}`);
      } catch {
        // ignore
      }
    } else {
      try {
        await writeBackendLog("notifications", "WARN", `Browser notification skipped ${notification.id} permission=${permission}`);
      } catch {
        // ignore
      }
    }
  }
}

function renderMessage(template, context) {
  const fallback = `${context.issueKey} cumple la alerta configurada`;
  if (!template) return fallback;
  return template.replaceAll(/\{\{([^}]+)}}/g, (_, key) => String(context[key.trim()] ?? ""));
}
