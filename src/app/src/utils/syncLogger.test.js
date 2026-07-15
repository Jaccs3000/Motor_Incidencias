import test from 'node:test';
import assert from 'node:assert/strict';
import { createSyncLogger } from './syncLogger.js';

test('createSyncLogger registra eventos de información y error con etapa y detalle', async () => {
  const events = [];
  const logger = createSyncLogger({
    writeLog: (entry) => events.push(entry),
    emitBackendLog: async () => {},
  });

  logger.info('prepare', 'Iniciando preparación', { count: 1 });
  logger.error('persist', new Error('boom'), { store: 'issues' });

  assert.equal(events.length, 2);
  assert.equal(events[0].level, 'INFO');
  assert.equal(events[0].step, 'prepare');
  assert.equal(events[0].message, 'Iniciando preparación');
  assert.equal(events[1].level, 'ERROR');
  assert.equal(events[1].step, 'persist');
  assert.equal(events[1].message, 'boom');
});

test('createSyncLogger ejecuta el callback y registra el resultado', async () => {
  const events = [];
  const logger = createSyncLogger({
    writeLog: (entry) => events.push(entry),
    emitBackendLog: async () => {},
  });

  const result = await logger.run('persist', 'Persistiendo datos', async () => 7);

  assert.equal(result, 7);
  assert.equal(events[0].level, 'INFO');
  assert.equal(events[0].step, 'persist');
  assert.equal(events[1].level, 'INFO');
  assert.equal(events[1].step, 'persist');
  assert.equal(events[1].message, 'Persistencia completada');
});
