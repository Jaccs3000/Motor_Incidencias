import { monitorConfig } from "../config/monitorConfig";

export function getByPath(source, path) {
  if (!source || !path) return null;
  return path.split(".").reduce((value, part) => {
    if (value == null) return null;
    return value[part];
  }, source);
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function extractIssueKeys(issue) {
  const links = issue?.fields?.issuelinks || [];
  const linkedIssueKeys = links
    .flatMap((link) => [link.inwardIssue?.key, link.outwardIssue?.key])
    .filter(Boolean);
  const subtaskIssueKeys = (issue?.fields?.subtasks || []).map((subtask) => subtask.key).filter(Boolean);
  return {
    linkedIssueKeys: [...new Set(linkedIssueKeys)],
    subtaskIssueKeys: [...new Set(subtaskIssueKeys)],
  };
}

export function normalizeIssue(rawIssue, jiraBaseUrl) {
  const attributes = {};
  monitorConfig.attributes.forEach((attribute) => {
    attributes[attribute.key] = getByPath(rawIssue, attribute.path);
  });
  const { linkedIssueKeys, subtaskIssueKeys } = extractIssueKeys(rawIssue);
  const issueKey = rawIssue.key;
  const issueType = attributes.issueType || rawIssue.fields?.issuetype?.name || null;
  const status = attributes.status || rawIssue.fields?.status?.name || null;

  return {
    issueKey,
    jiraId: rawIssue.id,
    projectKey: attributes.projectKey,
    issueType,
    status,
    summary: attributes.summary,
    attributes: {
      ...attributes,
      linkedIssueKeys,
      subtaskIssueKeys,
      browseUrl: jiraBaseUrl ? `${jiraBaseUrl.replace(/\/$/, "")}/browse/${issueKey}` : "",
    },
    linkedIssueKeys,
    subtaskIssueKeys,
    jiraUrl: jiraBaseUrl ? `${jiraBaseUrl.replace(/\/$/, "")}/browse/${issueKey}` : "",
    lastFetchedAt: new Date().toISOString(),
  };
}

export function isRelevantIssue(rawIssue) {
  const issueType = rawIssue?.fields?.issuetype?.name;
  const projectKey = rawIssue?.fields?.project?.key;
  const normalizedIssueType = normalizeText(issueType);
  const configuredIssueTypes = monitorConfig.issueTypesToPersist.map(normalizeText);
  return configuredIssueTypes.includes(normalizedIssueType) || isKnownMojibakeType(normalizedIssueType) || monitorConfig.linkedProjectsToPersist.includes(projectKey);
}

function isKnownMojibakeType(normalizedIssueType) {
  return (
    (normalizedIssueType.includes("pruebas") && normalizedIssueType.includes("autom")) ||
    (normalizedIssueType.includes("implementaci") && normalizedIssueType.includes("q"))
  );
}

export function getAllNeighborKeys(rawIssue) {
  const { linkedIssueKeys, subtaskIssueKeys } = extractIssueKeys(rawIssue);
  return [...new Set([...linkedIssueKeys, ...subtaskIssueKeys])];
}
