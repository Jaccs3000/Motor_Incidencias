import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEmptyCells, normalizeGridLayout, getAvailableFieldsForLayout, createDefaultGridLayout } from './gridLayout.js';

test('buildEmptyCells crea celdas vacías para la matriz indicada', () => {
  const cells = buildEmptyCells(2, 3);
  assert.equal(cells.length, 6);
  assert.deepEqual(cells[0], { row: 0, col: 0, fieldKey: null });
  assert.deepEqual(cells[5], { row: 1, col: 2, fieldKey: null });
});

test('normalizeGridLayout conserva campos al cambiar dimensiones y elimina valores fuera de rango', () => {
  const layout = {
    rows: 2,
    cols: 2,
    cells: [
      { row: 0, col: 0, fieldKey: 'description' },
      { row: 0, col: 1, fieldKey: 'testing' },
      { row: 1, col: 0, fieldKey: 'criteriaTesting' },
    ],
  };

  const normalized = normalizeGridLayout(layout, 3, 2, ['description', 'testing', 'criteriaTesting']);

  assert.equal(normalized.rows, 3);
  assert.equal(normalized.cols, 2);
  assert.equal(normalized.cells.length, 6);
  assert.equal(normalized.cells[0].fieldKey, 'description');
  assert.equal(normalized.cells[1].fieldKey, 'testing');
  assert.equal(normalized.cells[2].fieldKey, 'criteriaTesting');
});

test('getAvailableFieldsForLayout devuelve los campos no usados', () => {
  const layout = createDefaultGridLayout();
  const used = layout.cells.map((cell) => cell.fieldKey).filter(Boolean);
  const available = getAvailableFieldsForLayout(layout, ['description', 'testing', 'criteriaTesting', 'generalStatus']);
  assert.deepEqual(available, ['generalStatus']);
  assert.equal(used.length, 4);
});
