export function createDefaultGridLayout() {
  return {
    rows: 1,
    cols: 6,
    cells: [
      { row: 0, col: 0, fieldKey: 'description' },
      { row: 0, col: 1, fieldKey: 'generalStatus' },
      { row: 0, col: 2, fieldKey: 'testing' },
      { row: 0, col: 3, fieldKey: 'criteriaTesting' },
      { row: 0, col: 4, fieldKey: 'criteriaDoc' },
      { row: 0, col: 5, fieldKey: 'preProdDeploy' },
    ],
  };
}

export function buildEmptyCells(rows, cols) {
  const cells = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      cells.push({ row, col, fieldKey: null });
    }
  }
  return cells;
}

export function normalizeGridLayout(layout, rows, cols, availableFieldKeys = []) {
  const safeRows = Math.max(1, Number(rows) || 1);
  const safeCols = Math.max(1, Number(cols) || 1);
  const nextCells = buildEmptyCells(safeRows, safeCols);
  const fieldSet = new Set(availableFieldKeys);

  for (const cell of layout?.cells || []) {
    if (!Number.isInteger(cell?.row) || !Number.isInteger(cell?.col)) continue;
    if (cell.row < 0 || cell.row >= safeRows || cell.col < 0 || cell.col >= safeCols) continue;
    if (!cell?.fieldKey || !fieldSet.has(cell.fieldKey)) continue;
    const target = nextCells.find((candidate) => candidate.row === cell.row && candidate.col === cell.col);
    if (target) target.fieldKey = cell.fieldKey;
  }

  return {
    rows: safeRows,
    cols: safeCols,
    cells: nextCells,
  };
}

export function getAvailableFieldsForLayout(layout, fieldKeys = []) {
  const used = new Set((layout?.cells || []).filter((cell) => cell?.fieldKey).map((cell) => cell.fieldKey));
  return fieldKeys.filter((fieldKey) => !used.has(fieldKey));
}

export function getCellField(layout, row, col) {
  return layout?.cells?.find((cell) => cell.row === row && cell.col === col)?.fieldKey || null;
}
