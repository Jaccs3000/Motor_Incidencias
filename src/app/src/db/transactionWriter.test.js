import test from 'node:test';
import assert from 'node:assert/strict';
import { writeValuesToTransaction, copyValuesBetweenStores } from './transactionWriter.js';

test('writeValuesToTransaction escribe los valores de forma secuencial', async () => {
  const written = [];
  const tx = {
    store: {
      put: async (value) => {
        written.push(value);
      },
    },
  };

  await writeValuesToTransaction(tx, [{ id: 1 }, { id: 2 }]);

  assert.deepEqual(written, [{ id: 1 }, { id: 2 }]);
});

test('copyValuesBetweenStores lee desde el origen y escribe en el destino', async () => {
  const sourceValues = [{ id: 1 }, { id: 2 }];
  const written = [];
  const db = {
    async getAll() {
      return sourceValues;
    },
    transaction() {
      return {
        store: {
          put: async (value) => {
            written.push(value);
          },
        },
        done: Promise.resolve(),
      };
    },
  };

  const result = await copyValuesBetweenStores(db, 'issues', 'issuesMirror');

  assert.deepEqual(result, sourceValues);
  assert.deepEqual(written, sourceValues);
});
