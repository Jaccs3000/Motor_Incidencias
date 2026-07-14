import { Box, Button, IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from "@mui/material";
import { ChevronUp } from "lucide-react";
import { useState } from "react";
import { gridColumnDefinitions } from "../config/monitorConfig";

export function ProjectGrid({ projectGroups, visibleColumns, onIssueClick }) {
  const columns = gridColumnDefinitions.filter((column) => visibleColumns.includes(column.key));
  const [expandedRows, setExpandedRows] = useState(() => new Set());

  const toggleRow = (projectGroupId, expanded) => {
    setExpandedRows((current) => {
      const next = new Set(current);
      if (expanded) next.add(projectGroupId);
      else next.delete(projectGroupId);
      return next;
    });
  };

  if (!projectGroups.length) {
    return (
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography color="text.secondary">No hay proyectos sincronizados para mostrar.</Typography>
      </Paper>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ flex: 1, minHeight: 260, overflow: "auto" }}>
      <Table size="small" stickyHeader sx={{ minWidth: "100%", width: "max-content" }}>
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableCell key={column.key} sx={{ fontWeight: 700, minWidth: column.key === "description" ? 195 : 130, whiteSpace: "nowrap" }}>{column.label}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {projectGroups.map((group) => {
            const isExpanded = expandedRows.has(group.projectGroupId);
            return (
              <TableRow key={group.projectGroupId} hover>
                {columns.map((column) => {
                  const value = group.computedFields?.[column.key] ?? "";
                  return (
                    <TableCell key={column.key} sx={{ verticalAlign: "top", whiteSpace: "nowrap" }}>
                      <CellValue
                        value={value}
                        column={column}
                        expanded={isExpanded}
                        onExpand={() => toggleRow(group.projectGroupId, true)}
                        onCollapse={() => toggleRow(group.projectGroupId, false)}
                        onIssueClick={onIssueClick}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function CellValue({ value, column, expanded, onExpand, onCollapse, onIssueClick }) {
  const values = Array.isArray(value) ? value : [value];
  const filteredValues = values.filter((item) => item !== "" && item != null);

  if (!filteredValues.length) return "";

  const visibleValues = expanded ? filteredValues : filteredValues.slice(0, 1);
  const hiddenCount = filteredValues.length - 1;

  return (
    <Box sx={{ minHeight: 30, whiteSpace: "nowrap" }}>
      {visibleValues.map((item, index) => (
        <Box key={`${item}-${index}`} sx={{ display: "flex", alignItems: "center", gap: 0.5, minHeight: 30, whiteSpace: "nowrap" }}>
          <Box component="span" sx={{ whiteSpace: "nowrap" }}>
            <SingleValue item={item} column={column} onIssueClick={onIssueClick} />
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

function SingleValue({ item, column, onIssueClick }) {
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
            maxWidth: column.key === "description" ? 260 : 180,
          }}
        >
          {item}
        </Typography>
      </Tooltip>
    );
  }
  return formatValue(item, column);
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
