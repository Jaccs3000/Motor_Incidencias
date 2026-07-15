import { Box, Button, IconButton, Paper, TableContainer, Tooltip, Typography } from "@mui/material";
import { ChevronUp, Hourglass } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { gridColumnDefinitions } from "../config/monitorConfig";
import { getCellField } from "../utils/gridLayout";

export function ProjectGrid({ projectGroups, visibleColumns, gridLayout, onIssueClick, onSubtasksClick, scrollRequest }) {
  const definitions = new Map(gridColumnDefinitions.map((column) => [column.key, column]));
  const columns = visibleColumns.map((key) => definitions.get(key)).filter(Boolean);
  const [expandedRows, setExpandedRows] = useState(() => new Set());
  const containerRef = useRef(null);
  const rowRefs = useRef(new Map());

  const toggleRow = (projectGroupId, expanded) => {
    setExpandedRows((current) => {
      const next = new Set(current);
      if (expanded) next.add(projectGroupId);
      else next.delete(projectGroupId);
      return next;
    });
  };

  useEffect(() => {
    if (!scrollRequest?.projectGroupId) return;
    const container = containerRef.current;
    const row = rowRefs.current.get(scrollRequest.projectGroupId);
    if (!container || !row) return;
    const rowTop = row.offsetTop;
    const target =
      scrollRequest.position === "bottom"
        ? rowTop - container.clientHeight + row.offsetHeight
        : rowTop;
    container.scrollTo({ top: Math.max(0, target), left: container.scrollLeft, behavior: "smooth" });
  }, [scrollRequest]);


  if (!projectGroups.length) {
    return (
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography color="text.secondary">No hay proyectos sincronizados para mostrar.</Typography>
      </Paper>
    );
  }

  return (
    <TableContainer ref={containerRef} component={Paper} variant="outlined" sx={{ flex: 1, minHeight: 260, overflow: "auto" }}>
      <Box sx={{ p: 1.5 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(520px, 1fr))", gap: 2 }}>
          {projectGroups.map((group) => {
            const isExpanded = expandedRows.has(group.projectGroupId);
            return (
              <Box
                key={group.projectGroupId}
                ref={(element) => {
                  if (element) rowRefs.current.set(group.projectGroupId, element);
                  else rowRefs.current.delete(group.projectGroupId);
                }}
                sx={{ mb: 0, border: "1px solid #e5e7eb", borderRadius: 2, overflow: "hidden", bgcolor: "#fff" }}
              >
                <Box sx={{ p: 1 }}>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: `repeat(${Math.max(1, gridLayout?.cols || 1)}, minmax(0, 1fr))`,
                      gap: 1,
                    }}
                  >
                    {Array.from({ length: (gridLayout?.rows || 1) * (gridLayout?.cols || 1) }).map((_, index) => {
                      const row = Math.floor(index / (gridLayout?.cols || 1));
                      const col = index % (gridLayout?.cols || 1);
                      const fieldKey = getCellField(gridLayout, row, col);
                      const column = fieldKey ? definitions.get(fieldKey) : null;
                      const value = column ? group.computedFields?.[column.key] ?? "" : "";
                      return (
                        <Box key={`${group.projectGroupId}-${row}-${col}`} sx={{ minHeight: 86, border: "1px solid #f1f5f9", borderRadius: 1, bgcolor: fieldKey ? "#f8fafc" : "#f3f4f6", p: 1 }}>
                          {column ? (
                            <>
                              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {column.label}
                              </Typography>
                              <CellValue
                                value={value}
                                column={column}
                                expanded={isExpanded}
                                onExpand={() => toggleRow(group.projectGroupId, true)}
                                onCollapse={() => toggleRow(group.projectGroupId, false)}
                                onIssueClick={(issueKey) => onIssueClick(issueKey, group.projectGroupId)}
                                onSubtasksClick={(item) => onSubtasksClick(item, group.projectGroupId)}
                              />
                            </>
                          ) : (
                            <Box sx={{ height: "100%", border: "1px dashed #d1d5db", borderRadius: 1, bgcolor: "#f3f4f6" }} />
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </TableContainer>
  );
}

function CellValue({ value, column, expanded, onExpand, onCollapse, onIssueClick, onSubtasksClick }) {
  const values = Array.isArray(value) ? value : [value];
  const filteredValues = values.filter((item) => item !== "" && item != null);

  if (!filteredValues.length) return "";

  const visibleValues = expanded ? filteredValues : filteredValues.slice(0, 1);
  const hiddenCount = filteredValues.length - 1;

  return (
    <Box sx={{ minHeight: 30 }}>
      {visibleValues.map((item, index) => (
        <Box key={`${item?.issueKey || item}-${index}`} sx={{ display: "flex", alignItems: "center", gap: 0.5, minHeight: 30, flexWrap: "wrap" }}>
          <Box component="span" sx={{ whiteSpace: "nowrap" }}>
            <SingleValue item={item} column={column} onIssueClick={onIssueClick} onSubtasksClick={onSubtasksClick} />
          </Box>
          {!expanded && index === 0 && hiddenCount > 0 ? (
            <Button size="small" variant="text" onClick={onExpand} sx={{ minWidth: 0, px: 0.5, whiteSpace: "nowrap" }}>
              +{hiddenCount}
            </Button>
          ) : null}
          {expanded && index === 0 && hiddenCount > 0 ? (
            <IconButton size="small" onClick={onCollapse} aria-label="Ocultar filas">
              <ChevronUp size={15} />
            </IconButton>
          ) : null}
        </Box>
      ))}
    </Box>
  );
}

function SingleValue({ item, column, onIssueClick, onSubtasksClick }) {
  if (column.type === "issueSummary") {
    return <IssueSummaryValue item={item} onIssueClick={onIssueClick} onSubtasksClick={onSubtasksClick} />;
  }
  if (column.type === "issueKey") {
    return (
      <Button size="small" variant="text" onClick={() => onIssueClick(item)} sx={{ minWidth: 0, px: 0.5, whiteSpace: "nowrap" }}>
        {item}
      </Button>
    );
  }
  if (["description", "generalStatus"].includes(column.key)) {
    return (
      <Tooltip title={String(item)} arrow>
        <Typography
          component="span"
          variant="body2"
          sx={{
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "normal",
            maxWidth: '100%',
          }}
        >
          {item}
        </Typography>
      </Tooltip>
    );
  }
  return formatValue(item, column);
}

function IssueSummaryValue({ item, onIssueClick, onSubtasksClick }) {
  const issueKey = item?.issueKey || "";
  return (
    <Box sx={{ lineHeight: 1.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, overflow: 'hidden' }}>
        <Button size="small" variant="text" disabled={!issueKey} onClick={() => onIssueClick(issueKey)} sx={{ minWidth: 0, px: 0, fontWeight: 700, whiteSpace: "nowrap" }}>
          {issueKey}
        </Button>
        <Typography component="span" variant="body2" sx={{ flex: '1 1 auto', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item?.status ? ` - ${item.status}` : ""}
        </Typography>
        {item?.subtaskProgress ? (
          <Button size="small" variant="text" onClick={() => onSubtasksClick?.(item)} sx={{ minWidth: 0, px: 0, fontWeight: 700, whiteSpace: "nowrap" }}>
            {item.subtaskProgress}
          </Button>
        ) : null}
      </Box>
      <Box sx={{ mt: 0.5 }}>{abbreviatePersonName(item?.owner || "Sin asignar")}</Box>
      <TimeProgressBar progress={item?.timeProgress} />
    </Box>
  );
}

function TimeProgressBar({ progress }) {
  if (!progress) return null;
  const tone = progress.percent > 100
    ? "from-rose-500 to-red-700"
    : progress.percent >= 80
      ? "from-violet-500 to-purple-700"
      : progress.percent >= 55
        ? "from-indigo-500 to-violet-600"
        : progress.percent >= 30
          ? "from-sky-500 to-blue-600"
          : "from-cyan-300 to-sky-400";
  const percentTextClass = "text-slate-900";
  const title = (
    <div className="space-y-0.5">
      <div>Tiempo planeado: {formatHours(progress.planned)}</div>
      <div>Tiempo registrado: {formatHours(progress.spent)}</div>
      <div>Tiempo restante: {formatHours(progress.remaining)}</div>
      <div>Avance: {progress.percent}%</div>
    </div>
  );

  return (
    <Tooltip title={title} arrow>
      <div className="mt-1 flex w-[156px] items-center gap-1.5">
        <div className="flex min-w-[29px] items-center gap-0.5 leading-none">
          <Hourglass size={12} className="text-amber-500" />
          <span className="text-[10px] font-bold text-slate-800">{formatHours(progress.remaining)}</span>
        </div>
        <div className="relative h-5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100 shadow-inner ring-1 ring-slate-200">
          <div className={`h-full rounded-full bg-gradient-to-r ${tone} shadow-sm`} style={{ width: `${progress.spentPercent}%` }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`rounded-full bg-white/85 px-1.5 py-[1px] text-[10px] font-black leading-none ${percentTextClass} shadow-sm ring-1 ring-slate-900/10 backdrop-blur-sm`}>
              {progress.percent}%
            </span>
          </div>
        </div>
        <div className="flex min-w-[25px] justify-end leading-none">
          <span className="text-[10px] font-bold text-slate-800">{formatHours(progress.planned)}</span>
        </div>
      </div>
    </Tooltip>
  );
}

function formatHours(value) {
  const numericValue = Number(value || 0);
  if (!numericValue) return "0 h";
  const rounded = Math.round(numericValue * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} h`;
}

function formatValue(value, column) {
  if (column.type === "percent" && value !== "") return `${value}%`;
  if (column.key.toLowerCase().includes("timehours") && value !== "") return `${value} h`;
  if (isPersonColumn(column.key)) return abbreviatePersonName(value);
  return String(value ?? "");
}

function isPersonColumn(key) {
  const normalizedKey = key.toLowerCase();
  return normalizedKey.includes("owner") || normalizedKey.includes("developer");
}

function abbreviatePersonName(value) {
  const name = String(value || "").trim();
  if (!name || name === "Sin asignar") return name;
  const words = name.split(/\s+/);
  const grouped = [];

  for (let index = 0; index < words.length; index += 1) {
    const current = words[index];
    const currentLower = current.toLowerCase();
    const nextLower = words[index + 1]?.toLowerCase();
    if (currentLower === "del" && words[index + 1]) {
      grouped.push(`${current} ${words[index + 1]}`);
      index += 1;
    } else if (currentLower === "de" && ["la", "las", "los"].includes(nextLower) && words[index + 2]) {
      grouped.push(`${current} ${words[index + 1]} ${words[index + 2]}`);
      index += 2;
    } else {
      grouped.push(current);
    }
  }

  if (grouped.length >= 4) return `${grouped[0]} ${grouped[2]}`;
  if (grouped.length === 3) return `${grouped[0]} ${grouped[1]}`;
  return grouped.slice(0, 2).join(" ");
}
