export async function writeValuesToTransaction(transaction, values) {
  for (const value of values) {
    await transaction.store.put(value);
  }
}

export async function copyValuesBetweenStores(db, sourceStoreName, destinationStoreName) {
  const sourceValues = await db.getAll(sourceStoreName);
  const tx = db.transaction(destinationStoreName, "readwrite");
  await writeValuesToTransaction(tx, sourceValues);
  await tx.done;
  return sourceValues;
}
