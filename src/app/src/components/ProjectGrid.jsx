import { Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
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
              <TableCell key={column.key} sx={{ fontWeight: 700, minWidth: 130 }}>{column.label}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {projectGroups.map((group) => (
            <TableRow key={group.projectGroupId} hover>
              {columns.map((column) => {
                const value = group.computedFields?.[column.key] ?? "";
                return (
                  <TableCell key={column.key}>
                    {column.type === "issueKey" && value ? (
                      <Button size="small" variant="text" onClick={() => onIssueClick(value)}>
                        {value}
                      </Button>
                    ) : formatValue(value, column.type)}
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

function formatValue(value, type) {
  if (type === "percent" && value !== "") return `${value}%`;
  return String(value ?? "");
}
