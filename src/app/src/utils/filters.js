export function buildJqlFromFilter(filter) {
  if (filter.generatedJql?.trim()) return filter.generatedJql.trim();
  const conditions = filter.conditions || [];
  return conditions
    .filter((condition) => condition.field && condition.operator && condition.value !== "")
    .map((condition, index) => {
      const joiner = index === 0 ? "" : ` ${condition.joiner || "AND"} `;
      return `${joiner}${condition.field}${toJiraOperator(condition.operator)}${formatJiraValue(condition.value)}`;
    })
    .join("");
}

function toJiraOperator(operator) {
  if (operator === "contains") return " ~ ";
  if (operator === "not_contains") return " !~ ";
  return ` ${operator} `;
}

function formatJiraValue(value) {
  if (Array.isArray(value)) {
    return `(${value.map((item) => `"${item}"`).join(",")})`;
  }
  if (typeof value === "number") return String(value);
  return `"${String(value).replaceAll('"', '\\"')}"`;
}

function normalizeConditionValue(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

export function evaluateCondition(context, condition) {
  const field = String(condition.field || "").trim();
  const value = context[field] ?? context[field.toLowerCase()] ?? context[field.toUpperCase()];
  const expected = condition.value;
  const normalizedValue = normalizeConditionValue(value);
  const normalizedAltValue = normalizeConditionValue(context[`${field}AccountId`] ?? context[`${field}Id`] ?? "");
  const normalizedExpected = normalizeConditionValue(expected);

  if (condition.operator === "=") {
    return normalizedValue === normalizedExpected || normalizedAltValue === normalizedExpected;
  }
  if (condition.operator === "!=") {
    return normalizedValue !== normalizedExpected && normalizedAltValue !== normalizedExpected;
  }
  if (condition.operator === "contains") {
    return normalizedValue.includes(normalizedExpected) || normalizedAltValue.includes(normalizedExpected);
  }
  if (condition.operator === "not_contains") {
    return !normalizedValue.includes(normalizedExpected) && !normalizedAltValue.includes(normalizedExpected);
  }
  if (condition.operator === ">") return Number(value) > Number(expected);
  if (condition.operator === ">=") return Number(value) >= Number(expected);
  if (condition.operator === "<") return Number(value) < Number(expected);
  if (condition.operator === "<=") return Number(value) <= Number(expected);
  return false;
}

export function evaluateConditions(context, conditions = []) {
  if (!conditions.length) return false;
  return conditions.reduce((result, condition, index) => {
    const current = evaluateCondition(context, condition);
    if (index === 0) return current;
    return condition.joiner === "OR" ? result || current : result && current;
  }, false);
}
