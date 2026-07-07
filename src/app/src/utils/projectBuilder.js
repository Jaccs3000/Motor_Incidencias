function findIssueByType(issues, matcher) {
  return issues.find((issue) => matcher(issue.issueType || ""));
}

function hours(seconds) {
  return seconds ? Math.round((seconds / 3600) * 10) / 10 : 0;
}

export function buildProjectGroup(rootIssueKey, issueKeys, issueMap) {
  const issues = issueKeys.map((key) => issueMap.get(key)).filter(Boolean);
  const testing = findIssueByType(issues, (type) => type === "Testing");
  const criteriaDoc = findIssueByType(issues, (type) => type.includes("Documentar Criterios"));
  const automation = findIssueByType(issues, (type) => type.includes("Automáticas"));
  const testDeploy = findIssueByType(issues, (type) => type.includes("Paso a TEST"));
  const criteria = issues.filter((issue) => (issue.issueType || "").includes("Criterios de aceptación"));
  const corrections = issues.filter((issue) => (issue.issueType || "").toLowerCase().includes("correcci")).length;
  const closedCriteria = criteria.filter((issue) => (issue.status || "").toLowerCase() === "cerrado").length;
  const planned = issues.reduce((sum, issue) => sum + Number(issue.attributes.timeOriginalEstimate || 0), 0);
  const spent = issues.reduce((sum, issue) => sum + Number(issue.attributes.timeSpent || 0), 0);
  const remaining = issues.reduce((sum, issue) => sum + Number(issue.attributes.timeRemainingEstimate || 0), 0);

  const computedFields = {
    description: testing?.summary || issues[0]?.summary || rootIssueKey,
    generalStatus: testing?.status || issues[0]?.status || "",
    testingIssue: testing?.issueKey || "",
    testOwner: testing?.attributes.assignee || "",
    developer: testing?.attributes.developer || "",
    criteriaDocIssue: criteriaDoc?.issueKey || "",
    criteriaOwner: criteriaDoc?.attributes.assignee || criteriaDoc?.attributes.criteriaResponsible || "",
    corrections,
    automationIssue: automation?.issueKey || "",
    testDeployIssue: testDeploy?.issueKey || "",
    closedCriteriaPercent: criteria.length ? Math.round((closedCriteria / criteria.length) * 100) : 0,
    plannedTimeHours: hours(planned),
    spentTimeHours: hours(spent),
    remainingTimeHours: hours(remaining),
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
