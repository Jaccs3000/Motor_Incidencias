function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isType(issue, expectedType) {
  return normalizeText(issue.issueType) === normalizeText(expectedType);
}

function isClosed(issue) {
  return normalizeText(issue?.status) === "cerrado";
}

function hasOpenIssue(issues) {
  return issues.some((issue) => !isClosed(issue));
}

function hasStatus(issues, expectedStatus) {
  return issues.some((issue) => normalizeText(issue.status) === normalizeText(expectedStatus));
}

function hasLinkedInfrastructure(issue, infrastructures) {
  const infrastructureKeys = new Set(infrastructures.map((item) => item.issueKey));
  return (issue?.linkedIssueKeys || []).some((key) => infrastructureKeys.has(key));
}

function buildGeneralStatus({ testDeploys, criteriaTestings, preProdDeploys, preProdTestings, prodDeploys, infrastructures }) {
  const prodWithInfrastructure = prodDeploys.some((issue) => hasLinkedInfrastructure(issue, infrastructures));

  if (prodWithInfrastructure) return "Montado en Produccion";
  if (prodDeploys.some((issue) => !isClosed(issue) && !hasLinkedInfrastructure(issue, infrastructures))) return "Solicitado montaje Produccion";
  if (criteriaTestings.length && preProdTestings.length && criteriaTestings.every(isClosed) && preProdTestings.every(isClosed) && !prodDeploys.length) return "Pruebas finalizadas";
  if (criteriaTestings.some(isClosed) && hasStatus(preProdTestings, "En Progreso")) return "Probando Pre-Prod";
  if (hasOpenIssue(preProdDeploys)) return "Solicitado montaje Pre-Prod";
  if (hasStatus(criteriaTestings, "En Progreso")) return "Probando Test";
  if (hasOpenIssue(testDeploys)) return "Solicitado montaje Test";
  return "";
}

function issuesByType(issues, matcher) {
  return issues.filter((issue) => matcher(normalizeText(issue.issueType))).sort((a, b) => String(a.issueKey).localeCompare(String(b.issueKey)));
}

function hours(seconds) {
  return seconds ? Math.round((seconds / 3600) * 10) / 10 : 0;
}

function time(issue, key) {
  return Number(issue?.attributes?.[key] || 0);
}

function times(issues, key) {
  return issues.map((issue) => hours(time(issue, key)));
}

function timeProgress(issue) {
  const planned = hours(time(issue, "timeOriginalEstimate"));
  const spent = hours(time(issue, "timeSpent"));
  const jiraRemaining = hours(time(issue, "timeRemainingEstimate"));
  const remaining = planned ? planned - spent : jiraRemaining;
  if (!planned && !spent && !remaining) return null;
  const percentageBase = planned || spent + remaining;
  const percent = percentageBase ? Math.round((spent / percentageBase) * 100) : 0;
  return {
    planned,
    spent,
    remaining,
    percent,
    spentPercent: Math.min(100, Math.max(0, percent)),
  };
}

function owner(issue) {
  return issue?.attributes.assignee || "";
}

function developer(issue) {
  return issue?.attributes.developer || issue?.attributes.creator || "";
}

function status(issue) {
  return issue?.status || "";
}

function keys(issues) {
  return issues.map((issue) => issue.issueKey);
}

function owners(issues, fallback = "") {
  return issues.map((issue) => owner(issue) || fallback);
}

function developers(issues, fallback = "") {
  return issues.map((issue) => developer(issue) || fallback);
}

function statuses(issues) {
  return issues.map((issue) => status(issue));
}

function issueSummaries(issues, ownerFallback = "") {
  return issues.map((issue) => ({
    issueKey: issue.issueKey,
    status: status(issue),
    owner: owner(issue) || ownerFallback,
  }));
}

function issueSummariesWithTime(issues, ownerFallback = "") {
  return issues.map((issue) => ({
    issueKey: issue.issueKey,
    status: status(issue),
    owner: owner(issue) || ownerFallback,
    timeProgress: timeProgress(issue),
  }));
}

function subtaskDetails(subtasks) {
  return subtasks.map((issue) => ({
    issueKey: issue.issueKey,
    status: status(issue),
    owner: owner(issue),
    description: issue.summary || issue.attributes?.description || "",
  }));
}

function issueSummariesWithSubtasks(issues, allIssues, ownerFallback = "") {
  return issues.map((issue) => {
    const subtasks = subtasksFor([issue], allIssues);
    const closed = classifySubtasks(subtasks).closed.length;
    return {
      issueKey: issue.issueKey,
      status: status(issue),
      owner: owner(issue) || ownerFallback,
      subtaskProgress: subtasks.length ? `${closed}/${subtasks.length}` : "",
      subtasks: subtaskDetails(subtasks),
    };
  });
}

function subtasksFor(parentIssues, issues) {
  const childKeys = new Set(parentIssues.flatMap((issue) => issue.subtaskIssueKeys || []));
  return issues.filter((issue) => childKeys.has(issue.issueKey)).sort((a, b) => String(a.issueKey).localeCompare(String(b.issueKey)));
}

function classifySubtasks(subtasks) {
  const open = [];
  const closed = [];
  const undefinedStatus = [];

  for (const issue of subtasks) {
    const normalizedStatus = normalizeText(issue.status);
    if (normalizedStatus === "creado") {
      open.push(issue);
    } else if (["cerrado", "aceptado", "no aceptado"].includes(normalizedStatus)) {
      closed.push(issue);
    } else {
      undefinedStatus.push(issue);
    }
  }

  return { open, closed, undefinedStatus };
}

export function buildProjectGroup(rootIssueKey, issueKeys, issueMap) {
  const issues = issueKeys.map((key) => issueMap.get(key)).filter(Boolean);
  const testings = issuesByType(issues, (type) => type === "testing");
  const testing = testings[0];
  const criteriaDocs = issuesByType(issues, (type) => type.includes("documentar criterios"));
  const automations = issuesByType(issues, (type) => type.includes("pruebas") && type.includes("autom"));
  const trackings = issuesByType(issues, (type) => type.includes("implementaci") && type.includes("q"));
  const testDeploys = issuesByType(issues, (type) => type.includes("paso a test"));
  const admons = issuesByType(issues, (type) => type.includes("admon pre-produccion"));
  const preProdDeploys = issuesByType(issues, (type) => type.includes("paso a pre-produccion"));
  const prodDeploys = issuesByType(issues, (type) => type.includes("paso a produccion") && !type.includes("pre-produccion"));
  const firewalls = issuesByType(issues, (type) => type.includes("reglas de firewall"));
  const infrastructures = issues.filter((issue) => issue.projectKey === "MDI").sort((a, b) => String(a.issueKey).localeCompare(String(b.issueKey)));
  const preProdTestings = issuesByType(issues, (type) => type === "testing pre-produccion");
  const preProdCriteriaTestings = issuesByType(issues, (type) => type.includes("testing criterios pre-produccion"));
  const preProdCriteriaDocs = issuesByType(issues, (type) => type === "criterios pre-produccion");
  const criteriaTestings = issues.filter((issue) => isType(issue, "Testing de Criterios")).sort((a, b) => String(a.issueKey).localeCompare(String(b.issueKey)));
  const criteria = issuesByType(issues, (type) => type.includes("criterios de aceptacion") || type.includes("test criterios"));
  const corrections = issuesByType(issues, (type) => type.includes("correccion")).length;
  const closedCriteria = criteria.filter((issue) => normalizeText(issue.status) === "cerrado").length;
  const preProdSubtasks = classifySubtasks(subtasksFor(preProdDeploys, issues));
  const prodSubtasks = classifySubtasks(subtasksFor(prodDeploys, issues));
  const generalStatus = buildGeneralStatus({ testDeploys, criteriaTestings, preProdDeploys, preProdTestings, prodDeploys, infrastructures });

  const computedFields = {
    description: testing?.summary || issues[0]?.summary || rootIssueKey,
    generalStatus: generalStatus || testing?.status || issues[0]?.status || "",
    testingIssue: keys(testings),
    testing: testings.map((issue) => ({
      issueKey: issue.issueKey,
      status: status(issue),
      owner: developer(issue) || owner(issue),
      timeProgress: timeProgress(issue),
    })),
    testOwner: owners(testings),
    developer: developers(testings),
    plannedTimeHours: times(testings, "timeOriginalEstimate"),
    spentTimeHours: times(testings, "timeSpent"),
    remainingTimeHours: times(testings, "timeRemainingEstimate"),
    criteriaTestingIssue: keys(criteriaTestings),
    criteriaTesting: issueSummaries(criteriaTestings, "Sin asignar"),
    criteriaTestingOwner: owners(criteriaTestings, "Sin asignar"),
    criteriaTestingStatus: statuses(criteriaTestings),
    criteriaDocIssue: keys(criteriaDocs),
    criteriaDoc: criteriaDocs.map((issue) => ({
      issueKey: issue.issueKey,
      status: status(issue),
      owner: owner(issue) || issue?.attributes.criteriaResponsible || "",
      timeProgress: timeProgress(issue),
    })),
    criteriaDocStatus: statuses(criteriaDocs),
    criteriaOwner: criteriaDocs.map((issue) => owner(issue) || issue?.attributes.criteriaResponsible || ""),
    criteriaPlannedTimeHours: times(criteriaDocs, "timeOriginalEstimate"),
    criteriaSpentTimeHours: times(criteriaDocs, "timeSpent"),
    criteriaRemainingTimeHours: times(criteriaDocs, "timeRemainingEstimate"),
    corrections,
    automationIssue: keys(automations),
    automation: issueSummaries(automations, "Sin asignar"),
    automationOwner: owners(automations, "Sin asignar"),
    automationStatus: statuses(automations),
    trackingIssue: keys(trackings),
    tracking: issueSummaries(trackings),
    trackingOwner: owners(trackings),
    trackingStatus: statuses(trackings),
    testDeployIssue: keys(testDeploys),
    testDeploy: issueSummaries(testDeploys),
    testDeployOwner: owners(testDeploys),
    testDeployStatus: statuses(testDeploys),
    admonIssue: keys(admons),
    admon: issueSummaries(admons),
    admonOwner: owners(admons),
    admonStatus: statuses(admons),
    preProdDeployIssue: keys(preProdDeploys),
    preProdDeploy: issueSummariesWithSubtasks(preProdDeploys, issues),
    preProdDeployOwner: owners(preProdDeploys),
    preProdDeployStatus: statuses(preProdDeploys),
    preProdDeployTotalSubtasks: preProdSubtasks.open.length + preProdSubtasks.closed.length + preProdSubtasks.undefinedStatus.length,
    preProdDeployOpenSubtasks: preProdSubtasks.open.length,
    preProdDeployOpenSubtaskKeys: keys(preProdSubtasks.open),
    preProdDeployUndefinedSubtasks: preProdSubtasks.undefinedStatus.length,
    preProdDeployUndefinedSubtaskKeys: keys(preProdSubtasks.undefinedStatus),
    prodDeployIssue: keys(prodDeploys),
    prodDeploy: issueSummariesWithSubtasks(prodDeploys, issues),
    prodDeployOwner: owners(prodDeploys),
    prodDeployStatus: statuses(prodDeploys),
    prodDeployTotalSubtasks: prodSubtasks.open.length + prodSubtasks.closed.length + prodSubtasks.undefinedStatus.length,
    prodDeployOpenSubtasks: prodSubtasks.open.length,
    prodDeployOpenSubtaskKeys: keys(prodSubtasks.open),
    prodDeployUndefinedSubtasks: prodSubtasks.undefinedStatus.length,
    prodDeployUndefinedSubtaskKeys: keys(prodSubtasks.undefinedStatus),
    firewallIssue: keys(firewalls),
    firewall: issueSummaries(firewalls),
    firewallOwner: owners(firewalls),
    firewallStatus: statuses(firewalls),
    infrastructureIssue: keys(infrastructures),
    infrastructure: issueSummaries(infrastructures),
    infrastructureOwner: owners(infrastructures),
    infrastructureStatus: statuses(infrastructures),
    preProdTestingIssue: keys(preProdTestings),
    preProdTesting: issueSummariesWithTime(preProdTestings, "Sin asignar"),
    preProdTestingOwner: owners(preProdTestings, "Sin asignar"),
    preProdTestingStatus: statuses(preProdTestings),
    preProdCriteriaTestingIssue: keys(preProdCriteriaTestings),
    preProdCriteriaTesting: issueSummaries(preProdCriteriaTestings, "Sin asignar"),
    preProdCriteriaTestingOwner: owners(preProdCriteriaTestings, "Sin asignar"),
    preProdCriteriaTestingStatus: statuses(preProdCriteriaTestings),
    preProdCriteriaDocIssue: keys(preProdCriteriaDocs),
    preProdCriteriaDoc: issueSummaries(preProdCriteriaDocs),
    preProdCriteriaDocOwner: owners(preProdCriteriaDocs),
    preProdCriteriaDocStatus: statuses(preProdCriteriaDocs),
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
