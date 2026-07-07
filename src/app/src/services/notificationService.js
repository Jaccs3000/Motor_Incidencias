import { getAll, put } from "../db/database";
import { evaluateConditions } from "../utils/filters";
import { monitorConfig } from "../config/monitorConfig";

export function buildAlertContext(currentIssue, previousIssue, projectGroup) {
  return {
    issueKey: currentIssue.issueKey,
    issueType: currentIssue.issueType,
    status: currentIssue.status,
    previousStatus: previousIssue?.status || "",
    assignee: currentIssue.attributes.assignee || "",
    previousAssignee: previousIssue?.attributes?.assignee || "",
    summary: currentIssue.summary || "",
    isNew: !previousIssue,
    projectGroupId: projectGroup?.projectGroupId || "",
    ...(projectGroup?.computedFields || {}),
    ...currentIssue.attributes,
  };
}

export function buildFingerprint(alertRule, context) {
  return [
    alertRule.id,
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

export async function createNotificationsForIssue({ alertRules, currentIssue, previousIssue, projectGroup }) {
  const existing = await getAll("notifications");
  const unreadFingerprints = new Set(existing.filter((item) => item.status === "unread").map((item) => item.fingerprint));
  const created = [];

  for (const alertRule of alertRules) {
    const context = buildAlertContext(currentIssue, previousIssue, projectGroup);
    if (!evaluateConditions(context, alertRule.conditions)) continue;

    const fingerprint = buildFingerprint(alertRule, context);
    if (unreadFingerprints.has(fingerprint)) continue;

    const now = new Date();
    const notification = {
      id: crypto.randomUUID(),
      fingerprint,
      alertRuleId: alertRule.id,
      title: alertRule.name || "Alerta",
      message: renderMessage(alertRule.messageTemplate, context),
      issueKey: currentIssue.issueKey,
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
      issueKey: currentIssue.issueKey,
      projectGroupId: projectGroup?.projectGroupId || "",
      notifiedAt: now.toISOString(),
    });
    unreadFingerprints.add(fingerprint);
    created.push(notification);
  }

  return created;
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
}

export async function showNativeNotification(notification) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
  if (Notification.permission !== "granted") return;
  const native = new Notification(notification.title, {
    body: notification.message,
    tag: notification.fingerprint,
  });
  native.onclick = () => window.focus();
  await markNotificationShown(notification);
}

function renderMessage(template, context) {
  const fallback = `${context.issueKey} cumple la alerta configurada`;
  if (!template) return fallback;
  return template.replaceAll(/\{\{([^}]+)}}/g, (_, key) => String(context[key.trim()] ?? ""));
}
