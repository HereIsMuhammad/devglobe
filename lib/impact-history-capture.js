import { getCosmosContainer } from './cosmos.js';
import { saveFeedEvents } from './feed-store.js';
import { addDeveloperRanks } from './ranking.js';
import { scoreAll } from './scoring.js';
import { addLanguageRanks, createImpactSnapshot, createRankMovementEvent } from './impact-history.js';
import {
  getImpactCaptureProgress,
  getImpactSnapshotForDay,
  getLatestImpactDayBefore,
  saveImpactCaptureProgress,
  saveImpactSnapshot,
} from './impact-history-store.js';

const DEFAULT_CONCURRENCY = 8;
const MAX_CONCURRENCY = 64;
const DEFAULT_BATCH_SIZE = 500;
const MAX_BATCH_SIZE = 5000;

function resolveConcurrency(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_CONCURRENCY;
  return Math.min(parsed, MAX_CONCURRENCY);
}

function resolveBatchSize(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_BATCH_SIZE;
  return Math.min(parsed, MAX_BATCH_SIZE);
}

async function runWithConcurrency(items, concurrency, callback) {
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await callback(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
}

async function listPublicDevelopers() {
  const container = getCosmosContainer();
  if (!container) throw new Error('Cosmos DB is not configured');
  const { resources } = await container.items.query(`SELECT * FROM c
    WHERE NOT IS_DEFINED(c.nomination) OR c.nomination.status = 'approved'`).fetchAll();
  return resources;
}

export async function captureImpactHistory(options = {}) {
  const now = options.now || new Date();
  const developers = options.developers || await (options.loadDevelopers || listPublicDevelopers)();
  const day = now.toISOString().slice(0, 10);
  const managedRun = !options.developers;
  const getProgress = options.getProgress || getImpactCaptureProgress;
  const saveProgress = options.saveProgress || saveImpactCaptureProgress;
  const progress = managedRun ? await getProgress(day) : null;
  const previousDay = progress?.previousDay
    ?? await (options.getPreviousDay || getLatestImpactDayBefore)(day);
  const saveSnapshot = options.saveSnapshot || saveImpactSnapshot;
  const saveEvents = options.saveEvents || saveFeedEvents;
  const concurrency = resolveConcurrency(options.concurrency || process.env.IMPACT_HISTORY_CONCURRENCY);
  const batchSize = resolveBatchSize(options.batchSize || process.env.IMPACT_HISTORY_BATCH_SIZE);
  const scored = scoreAll(developers).sort((left, right) => (
    right.score - left.score || left.login.localeCompare(right.login)
  ));
  const ranked = addLanguageRanks(addDeveloperRanks(scored));
  const startIndex = managedRun ? progress?.nextIndex || 0 : 0;
  const batch = managedRun ? ranked.slice(startIndex, startIndex + batchSize) : ranked;
  let snapshots = 0;
  let movements = 0;

  await runWithConcurrency(batch, concurrency, async developer => {
    const snapshot = createImpactSnapshot(developer, now.toISOString());
    const previous = options.getPrevious
      ? await options.getPrevious(snapshot.login, snapshot.day)
      : await (options.getPreviousForDay || getImpactSnapshotForDay)(snapshot.login, previousDay);
    await saveSnapshot(snapshot);
    snapshots += 1;

    const event = createRankMovementEvent(snapshot, previous);
    if (event) {
      const result = await saveEvents([event], {
        isPublicDeveloper: developer.impactHistoryVisibility !== 'private',
      });
      movements += result.inserted;
    }
  });

  if (!managedRun) return { developers: ranked.length, snapshots, movements, day };

  const nextIndex = startIndex + batch.length;
  const complete = nextIndex >= ranked.length;
  await saveProgress({
    captureDay: day,
    previousDay,
    nextIndex,
    total: ranked.length,
    complete,
  });
  return {
    developers: ranked.length,
    snapshots,
    movements,
    day,
    processed: nextIndex,
    remaining: Math.max(ranked.length - nextIndex, 0),
    complete,
  };
}