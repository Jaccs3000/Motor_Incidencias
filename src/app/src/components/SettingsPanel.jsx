import { Box, Button, Checkbox, Chip, Divider, FormControlLabel, Grid, IconButton, Paper, Stack, TextField, Typography } from "@mui/material";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { gridColumnDefinitions } from "../config/monitorConfig";
import { createDefaultGridLayout, getAvailableFieldsForLayout, normalizeGridLayout } from "../utils/gridLayout";

export function SettingsPanel({
  appSettings,
  setAppSettings,
  filters,
  setFilters,
  alertRules,
  setAlertRules,
  visibleColumns,
  setVisibleColumns,
  gridLayout,
  setGridLayout,
  onSave,
}) {
  const addFilter = () => setFilters([...filters, emptyFilter()]);
  const addAlert = () => setAlertRules([...alertRules, emptyAlert()]);
  const orderedGridColumns = orderGridColumns(visibleColumns);
  const [draftRows, setDraftRows] = useState(gridLayout?.rows || 1);
  const [draftCols, setDraftCols] = useState(gridLayout?.cols || 1);
  const [draftLayout, setDraftLayout] = useState(gridLayout);
  const availableFieldKeys = useMemo(() => gridColumnDefinitions.map((column) => column.key), []);
  const availableFields = useMemo(() => getAvailableFieldsForLayout(draftLayout, availableFieldKeys), [draftLayout, availableFieldKeys]);

  const applyDraftLayout = () => {
    const normalized = normalizeGridLayout(draftLayout, draftRows, draftCols, availableFieldKeys);
    setDraftLayout(normalized);
    setGridLayout(normalized);
  };

  const resetLayout = () => {
    const defaultLayout = createDefaultGridLayout();
    setDraftRows(defaultLayout.rows);
    setDraftCols(defaultLayout.cols);
    setDraftLayout(defaultLayout);
  };

  const assignFieldToCell = (fieldKey, row, col) => {
    const nextCells = (draftLayout?.cells || []).map((cell) => (cell.row === row && cell.col === col ? { ...cell, fieldKey } : cell));
    setDraftLayout({ ...draftLayout, cells: nextCells });
  };

  const removeFieldFromCell = (row, col) => {
    const nextCells = (draftLayout?.cells || []).map((cell) => (cell.row === row && cell.col === col ? { ...cell, fieldKey: null } : cell));
    setDraftLayout({ ...draftLayout, cells: nextCells });
  };

  const handleRowsChange = (value) => {
    const nextRows = Number(value);
    setDraftRows(nextRows);
    const normalized = normalizeGridLayout(draftLayout, nextRows, draftCols, availableFieldKeys);
    setDraftLayout(normalized);
  };

  const handleColsChange = (value) => {
    const nextCols = Number(value);
    setDraftCols(nextCols);
    const normalized = normalizeGridLayout(draftLayout, draftRows, nextCols, availableFieldKeys);
    setDraftLayout(normalized);
  };

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6">Configuración general</Typography>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth type="number" label="Intervalo sincronización (min)" value={appSettings.syncIntervalMinutes} onChange={(e) => setAppSettings({ ...appSettings, syncIntervalMinutes: Number(e.target.value) })} />
          </Grid>
        </Grid>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Filtros Jira</Typography>
          <Button startIcon={<Plus size={17} />} onClick={addFilter}>Agregar filtro</Button>
        </Stack>
        <Stack spacing={1.5} sx={{ mt: 1.5 }}>
          {filters.map((filter, index) => (
            <Paper key={filter.id} variant="outlined" sx={{ p: 1.5 }}>
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField fullWidth label="Nombre" value={filter.name} onChange={(e) => updateAt(filters, setFilters, index, { ...filter, name: e.target.value })} />
                </Grid>
                <Grid size={{ xs: 12, md: 8 }}>
                  <TextField fullWidth label="JQL generado o manual" value={filter.generatedJql} onChange={(e) => updateAt(filters, setFilters, index, { ...filter, generatedJql: e.target.value })} />
                </Grid>
                <Grid size={{ xs: 12, md: 1 }}>
                  <IconButton onClick={() => setFilters(filters.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={18} /></IconButton>
                </Grid>
              </Grid>
            </Paper>
          ))}
          {!filters.length ? <Typography color="text.secondary">Crea al menos un filtro para sincronizar.</Typography> : null}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Alertas</Typography>
          <Button startIcon={<Plus size={17} />} onClick={addAlert}>Agregar alerta</Button>
        </Stack>
        <Stack spacing={1.5} sx={{ mt: 1.5 }}>
          {alertRules.map((alert, index) => (
            <Paper key={alert.id} variant="outlined" sx={{ p: 1.5 }}>
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField fullWidth label="Nombre" value={alert.name} onChange={(e) => updateAt(alertRules, setAlertRules, index, { ...alert, name: e.target.value })} />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField fullWidth label="Campo" value={alert.conditions[0]?.field || ""} onChange={(e) => updateAlertCondition(alertRules, setAlertRules, index, "field", e.target.value)} />
                </Grid>
                <Grid size={{ xs: 6, md: 1 }}>
                  <TextField fullWidth label="Op" value={alert.conditions[0]?.operator || "="} onChange={(e) => updateAlertCondition(alertRules, setAlertRules, index, "operator", e.target.value)} />
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <TextField fullWidth label="Valor" value={alert.conditions[0]?.value || ""} onChange={(e) => updateAlertCondition(alertRules, setAlertRules, index, "value", e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, md: 1 }}>
                  <IconButton onClick={() => setAlertRules(alertRules.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={18} /></IconButton>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField fullWidth label="Mensaje" value={alert.messageTemplate} onChange={(e) => updateAt(alertRules, setAlertRules, index, { ...alert, messageTemplate: e.target.value })} />
                </Grid>
              </Grid>
            </Paper>
          ))}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6">Diseño del grid</Typography>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth type="number" label="Filas" value={draftRows} inputProps={{ min: 1 }} onChange={(event) => handleRowsChange(event.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth type="number" label="Columnas" value={draftCols} inputProps={{ min: 1 }} onChange={(event) => handleColsChange(event.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack direction="row" spacing={1} sx={{ height: "100%" }}>
              <Button variant="outlined" fullWidth onClick={resetLayout}>Restaurar por defecto</Button>
              <Button variant="contained" fullWidth onClick={applyDraftLayout}>Guardar diseño</Button>
            </Stack>
          </Grid>
        </Grid>

        <Typography variant="subtitle2" sx={{ mt: 2 }}>Campos disponibles</Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1 }}>
          {availableFields.map((fieldKey) => {
            const definition = gridColumnDefinitions.find((column) => column.key === fieldKey);
            return (
              <Chip
                key={fieldKey}
                label={definition?.label || fieldKey}
                variant="outlined"
                onClick={() => {}}
                draggable
                onDragStart={(event) => event.dataTransfer.setData("fieldKey", fieldKey)}
              />
            );
          })}
        </Box>

        <Typography variant="subtitle2" sx={{ mt: 2 }}>Diseña tu grid</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${draftCols || 1}, minmax(0, 1fr))`, gap: 1, mt: 1 }}>
          {Array.from({ length: (draftRows || 1) * (draftCols || 1) }).map((_, index) => {
            const row = Math.floor(index / (draftCols || 1));
            const col = index % (draftCols || 1);
            const fieldKey = (draftLayout?.cells || []).find((cell) => cell.row === row && cell.col === col)?.fieldKey || null;
            const definition = gridColumnDefinitions.find((column) => column.key === fieldKey);
            return (
              <Box
                key={`${row}-${col}`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const droppedKey = event.dataTransfer.getData("fieldKey");
                  if (droppedKey) assignFieldToCell(droppedKey, row, col);
                }}
                sx={{ minHeight: 88, border: "1px solid #d1d5db", borderRadius: 1, bgcolor: fieldKey ? "#f8fafc" : "#f3f4f6", p: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}
              >
                {fieldKey ? (
                  <>
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>{definition?.label || fieldKey}</Typography>
                    <Button size="small" sx={{ alignSelf: "flex-start", mt: 1 }} onClick={() => removeFieldFromCell(row, col)}>Quitar</Button>
                  </>
                ) : (
                  <Typography variant="caption" color="text.secondary">Arrastra un campo aquí</Typography>
                )}
              </Box>
            );
          })}
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6">Columnas del grid</Typography>
        <Grid container spacing={1} sx={{ mt: 1 }}>
          {orderedGridColumns.map((column) => {
            const checked = visibleColumns.includes(column.key);
            return (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={column.key}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <IconButton size="small" disabled={!checked} onClick={() => moveColumn(column.key, -1, visibleColumns, setVisibleColumns)}><ArrowUp size={16} /></IconButton>
                <IconButton size="small" disabled={!checked} onClick={() => moveColumn(column.key, 1, visibleColumns, setVisibleColumns)}><ArrowDown size={16} /></IconButton>
                <FormControlLabel
                  control={<Checkbox checked={checked} onChange={(event) => toggleColumn(column.key, event.target.checked, visibleColumns, setVisibleColumns)} />}
                  label={column.label}
                  sx={{ flex: 1 }}
                />
              </Box>
            </Grid>
            );
          })}
        </Grid>
      </Paper>

      <Divider />
      <Button variant="contained" onClick={onSave}>Guardar configuración</Button>
    </Stack>
  );
}

function emptyFilter() {
  return { id: crypto.randomUUID(), name: "Filtro Jira", generatedJql: 'issuetype="Testing" AND status!="Cerrado"', conditions: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

function emptyAlert() {
  return { id: crypto.randomUUID(), name: "Nueva alerta", conditions: [{ field: "status", operator: "=", value: "Cerrado", joiner: "AND" }], messageTemplate: "{{issueKey}} cumple la alerta {{status}}", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

function updateAt(items, setter, index, value) {
  setter(items.map((item, itemIndex) => (itemIndex === index ? { ...value, updatedAt: new Date().toISOString() } : item)));
}

function updateAlertCondition(items, setter, index, key, value) {
  const alert = items[index];
  const condition = { ...(alert.conditions[0] || {}), [key]: value };
  updateAt(items, setter, index, { ...alert, conditions: [condition] });
}

function orderGridColumns(visibleColumns) {
  const definitions = new Map(gridColumnDefinitions.map((column) => [column.key, column]));
  const visible = visibleColumns.map((key) => definitions.get(key)).filter(Boolean);
  const hidden = gridColumnDefinitions.filter((column) => !visibleColumns.includes(column.key));
  return [...visible, ...hidden];
}

function toggleColumn(key, checked, visibleColumns, setVisibleColumns) {
  setVisibleColumns(checked ? [...visibleColumns, key] : visibleColumns.filter((column) => column !== key));
}

function moveColumn(key, direction, visibleColumns, setVisibleColumns) {
  const index = visibleColumns.indexOf(key);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= visibleColumns.length) return;
  const copy = [...visibleColumns];
  [copy[index], copy[target]] = [copy[target], copy[index]];
  setVisibleColumns(copy);
}
