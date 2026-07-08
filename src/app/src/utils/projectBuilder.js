function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function findIssueByType(issues, matcher) {
  return issues.find((issue) => matcher(normalizeText(issue.issueType)));
}

function issuesByType(issues, matcher) {
  return issues.filter((issue) => matcher(normalizeText(issue.issueType)));
}

function hours(seconds) {
  return seconds ? Math.round((seconds / 3600) * 10) / 10 : 0;
}

function time(issue, key) {
  return Number(issue?.attributes?.[key] || 0);
}

function owner(issue) {
  return issue?.attributes.assignee || "";
}

function issueKey(issue) {
  return issue?.issueKey || "";
}

function status(issue) {
  return issue?.status || "";
}

function openSubtasksFor(parentIssue, issues) {
  if (!parentIssue) return [];
  const childKeys = new Set(parentIssue.subtaskIssueKeys || []);
  return issues.filter((issue) => childKeys.has(issue.issueKey) && normalizeText(issue.status) !== "cerrado");
}

export function buildProjectGroup(rootIssueKey, issueKeys, issueMap) {
  const issues = issueKeys.map((key) => issueMap.get(key)).filter(Boolean);
  const testing = findIssueByType(issues, (type) => type === "testing");
  const criteriaDoc = findIssueByType(issues, (type) => type.includes("documentar criterios"));
  const automation = findIssueByType(issues, (type) => type.includes("pruebas automaticas"));
  const tracking = findIssueByType(issues, (type) => type.includes("implementacion q&a"));
  const testDeploy = findIssueByType(issues, (type) => type.includes("paso a test"));
  const admon = findIssueByType(issues, (type) => type.includes("admon pre-produccion"));
  const preProdDeploy = findIssueByType(issues, (type) => type.includes("paso a pre-produccion"));
  const firewall = findIssueByType(issues, (type) => type.includes("reglas de firewall"));
  const preProdTesting = findIssueByType(issues, (type) => type === "testing pre-produccion");
  const preProdCriteriaTesting = findIssueByType(issues, (type) => type.includes("testing criterios pre-produccion"));
  const preProdCriteriaDoc = findIssueByType(issues, (type) => type === "criterios pre-produccion");
  const criteria = issuesByType(issues, (type) => type.includes("criterios de aceptacion") || type.includes("test criterios"));
  const corrections = issuesByType(issues, (type) => type.includes("correccion")).length;
  const closedCriteria = criteria.filter((issue) => normalizeText(issue.status) === "cerrado").length;
  const openPreProdSubtasks = openSubtasksFor(preProdDeploy, issues);

  const computedFields = {
    description: testing?.summary || issues[0]?.summary || rootIssueKey,
    generalStatus: testing?.status || issues[0]?.status || "",
    testingIssue: issueKey(testing),
    testOwner: owner(testing),
    developer: testing?.attributes.developer || testing?.attributes.creator || "",
    plannedTimeHours: hours(time(testing, "timeOriginalEstimate")),
    spentTimeHours: hours(time(testing, "timeSpent")),
    remainingTimeHours: hours(time(testing, "timeRemainingEstimate")),
    criteriaDocIssue: issueKey(criteriaDoc),
    criteriaDocStatus: status(criteriaDoc),
    criteriaOwner: owner(criteriaDoc) || criteriaDoc?.attributes.criteriaResponsible || "",
    criteriaPlannedTimeHours: hours(time(criteriaDoc, "timeOriginalEstimate")),
    criteriaSpentTimeHours: hours(time(criteriaDoc, "timeSpent")),
    criteriaRemainingTimeHours: hours(time(criteriaDoc, "timeRemainingEstimate")),
    corrections,
    automationIssue: issueKey(automation),
    automationOwner: owner(automation) || "Sin asignar",
    automationStatus: status(automation),
    trackingIssue: issueKey(tracking),
    trackingOwner: owner(tracking),
    trackingStatus: status(tracking),
    testDeployIssue: issueKey(testDeploy),
    testDeployOwner: owner(testDeploy),
    testDeployStatus: status(testDeploy),
    admonIssue: issueKey(admon),
    admonOwner: owner(admon),
    admonStatus: status(admon),
    preProdDeployIssue: issueKey(preProdDeploy),
    preProdDeployOwner: owner(preProdDeploy),
    preProdDeployStatus: status(preProdDeploy),
    preProdDeployTotalSubtasks: preProdDeploy?.subtaskIssueKeys?.length || 0,
    preProdDeployOpenSubtasks: openPreProdSubtasks.length,
    preProdDeployOpenSubtaskKeys: openPreProdSubtasks.map((issue) => issue.issueKey).join(", "),
    firewallIssue: issueKey(firewall),
    firewallOwner: owner(firewall),
    firewallStatus: status(firewall),
    preProdTestingIssue: issueKey(preProdTesting),
    preProdTestingOwner: owner(preProdTesting) || "Sin asignar",
    preProdTestingStatus: status(preProdTesting),
    preProdCriteriaTestingIssue: issueKey(preProdCriteriaTesting),
    preProdCriteriaTestingOwner: owner(preProdCriteriaTesting) || "Sin asignar",
    preProdCriteriaTestingStatus: status(preProdCriteriaTesting),
    preProdCriteriaDocIssue: issueKey(preProdCriteriaDoc),
    preProdCriteriaDocOwner: owner(preProdCriteriaDoc),
    preProdCriteriaDocStatus: status(preProdCriteriaDoc),
    closedCriteriaPercent: criteria.length ? Math.round((closedCriteria / criteria.length) * 100) : 0,
  };

  return {
    projectGroupId: [...issueKeys].sort().join("|"),
    rootIssueKey,
    issueKeys: [...issueKeys],
    description: computedFields.description,
    computedFields,
    updatedAt: new Date().toISOString(),
  };
}
