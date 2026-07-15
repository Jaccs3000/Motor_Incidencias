import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateConditions } from './filters.js';

test('evaluateConditions reconoce campos con mayúsculas y condiciones de desigualdad', () => {
  const context = { status: 'Creado' };
  const conditions = [{ field: 'Status', operator: '!=', value: 'En Progreso' }];

  assert.equal(evaluateConditions(context, conditions), true);
});

test('evaluateConditions permite comparar accountId de usuario alternativo', () => {
  const context = { assignee: 'Juan Perez', assigneeAccountId: '712020:e0f54237-99d1-4264-9fd6-0ee5f330380f' };
  const conditions = [{ field: 'assignee', operator: '=', value: '712020:e0f54237-99d1-4264-9fd6-0ee5f330380f' }];

  assert.equal(evaluateConditions(context, conditions), true);
});
