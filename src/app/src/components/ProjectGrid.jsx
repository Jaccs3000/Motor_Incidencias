import { Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from "@mui/material";
import { gridColumnDefinitions } from "../config/monitorConfig";

export function ProjectGrid({ projectGroups, visibleColumns, onIssueClick }) {
  const columns = gridColumnDefinitions.filter((column) => visibleColumns.includes(column.key));

  if (!projectGroups.length) {
    return (
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography color="text.secondary">No hay proyectos sincronizados para mostrar.</Typography>
      </Paper>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableCell key={column.key} sx={{ fontWeight: 700, minWidth: column.key === "description" ? 195 : 130 }}>{column.label}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {projectGroups.map((group) => (
            <TableRow key={group.projectGroupId} hover>
              {columns.map((column) => {
                const value = group.computedFields?.[column.key] ?? "";
                return (
                  <TableCell key={column.key} sx={{ maxWidth: column.key === "description" ? 260 : 180, verticalAlign: "top" }}>
                    <CellValue value={value} column={column} onIssueClick={onIssueClick} />
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function CellValue({ value, column, onIssueClick }) {
  const values = Array.isArray(value) ? value : [value];
  const filteredValues = values.filter((item) => item !== "" && item != null);

  if (!filteredValues.length) return "";

  return filteredValues.map((item, index) => (
    <div key={`${item}-${index}`}>
      {column.type === "issueKey" ? (
        <Button size="small" variant="text" onClick={() => onIssueClick(item)}>
          {item}
        </Button>
      ) : column.key === "description" ? (
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
            }}
          >
            {item}
          </Typography>
        </Tooltip>
      ) : (
        formatValue(item, column)
      )}
    </div>
  ));
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
