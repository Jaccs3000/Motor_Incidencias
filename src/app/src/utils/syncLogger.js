import { writeBackendLog } from '../api/backendApi.js';

function normalizeError(error) {
  if (!error) return { message: 'Error desconocido', name: 'Error' };
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return {
    name: 'Error',
    message: String(error),
  };
}

export function createSyncLogger({ writeLog = console.log, emitBackendLog = writeBackendLog } = {}) {
  const events = [];

  function append(level, step, message, details = {}) {
    const entry = {
      level,
      step,
      message,
      details,
      timestamp: new Date().toISOString(),
    };
    events.push(entry);
    writeLog(entry);
    return entry;
  }

  async function flushToBackend(syncId, context = {}) {
    try {
      await emitBackendLog('sync', 'INFO', JSON.stringify({ syncId, ...context, events: events.slice(-20) }));
    } catch {
      // ignore logging failures to avoid breaking sync flow
    }
  }

  return {
    events,
    info(step, message, details) {
      return append('INFO', step, message, details);
    },
    warn(step, message, details) {
      return append('WARN', step, message, details);
    },
    error(step, error, details) {
      const normalized = normalizeError(error);
      return append('ERROR', step, normalized.message, { ...details, error: normalized });
    },
    async run(step, message, task, details = {}) {
      this.info(step, message, details);
      try {
        const result = await task();
        this.info(step, 'Persistencia completada', { ...details, result });
        return result;
      } catch (error) {
        this.error(step, error, details);
        throw error;
      }
    },
    async flush(syncId, context) {
      await flushToBackend(syncId, context);
    },
  };
}
