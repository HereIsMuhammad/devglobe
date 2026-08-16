import { getCosmosContainer } from './cosmos.js';

const memorySnapshots = new Map();

function getHistoryContainer() {
  return getCosmosContainer(process.env.COSMOS_IMPACT_HISTORY_CONTAINER || 'impact-history');
}

export async function getLatestImpactSnapshot(login, beforeDay = null) {
  const normalizedLogin = String(login || '').toLowerCase();
  const container = getHistoryContainer();
  if (!container) {
    return [...memorySnapshots.values()]
      .filter(snapshot => snapshot.login === normalizedLogin && (!beforeDay || snapshot.day < beforeDay))
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0] || null;
  }

  const conditions = ['c.login = @login'];
  const parameters = [{ name: '@login', value: normalizedLogin }];
  if (beforeDay) {
    conditions.push('c.day < @beforeDay');
    parameters.push({ name: '@beforeDay', value: beforeDay });
  }
  const { resources } = await container.items.query({
    query: `SELECT TOP 1 * FROM c WHERE ${conditions.join(' AND ')} ORDER BY c.capturedAt DESC`,
    parameters,
  }, { partitionKey: normalizedLogin }).fetchAll();
  return resources[0] || null;
}

export async function listImpactSnapshots(login, days = 90, now = new Date()) {
  const normalizedLogin = String(login || '').toLowerCase();
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  const container = getHistoryContainer();
  if (!container) {
    return [...memorySnapshots.values()]
      .filter(snapshot => snapshot.login === normalizedLogin && snapshot.capturedAt >= cutoff)
      .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  }

  const { resources } = await container.items.query({
    query: `SELECT * FROM c
      WHERE c.login = @login AND c.capturedAt >= @cutoff
      ORDER BY c.capturedAt ASC`,
    parameters: [
      { name: '@login', value: normalizedLogin },
      { name: '@cutoff', value: cutoff },
    ],
  }, { partitionKey: normalizedLogin }).fetchAll();
  return resources;
}

export async function saveImpactSnapshot(snapshot) {
  const container = getHistoryContainer();
  if (!container) {
    memorySnapshots.set(snapshot.id, snapshot);
    return snapshot;
  }
  const { resource } = await container.items.upsert(snapshot);
  return resource || snapshot;
}

export function __resetMemoryImpactHistoryForTests() {
  memorySnapshots.clear();
}