/**
 * Recalculate derived score fields for existing public developer documents.
 *
 * Dry run: npm run rescore-developers
 * Apply:   npm run rescore-developers -- --apply
 */
import 'dotenv/config';
import { CosmosClient } from '@azure/cosmos';
import { scoreAll } from '../lib/scoring.js';

const APPLY = process.argv.includes('--apply');
const DATABASE = process.env.COSMOS_DATABASE || 'devglobe';
const CONTAINER = process.env.COSMOS_CONTAINER || 'developers';
const SCORE_FIELDS = ['score', 'scoreDimensions', 'scoreWeights', 'scoreHasSO', 'scorePercentile'];

function requireConfiguration() {
  const endpoint = process.env.COSMOS_ENDPOINT?.trim();
  const key = process.env.COSMOS_KEY?.trim();
  if (!endpoint || !key) throw new Error('COSMOS_ENDPOINT and COSMOS_KEY are required.');

  const hostname = new URL(endpoint).hostname;
  if (hostname.includes('your-account')) {
    throw new Error('COSMOS_ENDPOINT still contains the placeholder account name.');
  }

  return { endpoint, key };
}

function getPathValue(document, path) {
  return path
    .split('/')
    .filter(Boolean)
    .reduce((value, segment) => value?.[segment.replaceAll('~1', '/').replaceAll('~0', '~')], document);
}

function getPartitionKey(document, paths) {
  const values = paths.map(path => getPathValue(document, path));
  if (values.some(value => value === undefined)) {
    throw new Error(`Document ${document.id} is missing partition key ${paths.join(', ')}.`);
  }
  return values.length === 1 ? values[0] : values;
}

function changedScoreFields(before, after) {
  return SCORE_FIELDS.filter(field => JSON.stringify(before[field]) !== JSON.stringify(after[field]));
}

function isTransient(error) {
  return ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN'].includes(error.code) ||
    error.code === 408 || error.code === 429 || error.code >= 500;
}

async function patchWithRetry(item, operations, etag) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await item.patch(
        { operations },
        { accessCondition: { type: 'IfMatch', condition: etag } }
      );
      return;
    } catch (error) {
      if (!isTransient(error) || attempt === 5) throw error;
      const delay = error.retryAfterInMs || attempt * 1000;
      console.warn(`Transient Cosmos error; retrying in ${delay}ms (${attempt}/5)...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function main() {
  const { endpoint, key } = requireConfiguration();
  const client = new CosmosClient({ endpoint, key });
  const container = client.database(DATABASE).container(CONTAINER);
  const { resource: definition } = await container.read();
  const partitionPaths = definition?.partitionKey?.paths;
  if (!partitionPaths?.length) throw new Error('Container partition key metadata is unavailable.');

  const { resources: documents } = await container.items.query({
    query: `SELECT * FROM c
      WHERE NOT IS_DEFINED(c.nomination) OR c.nomination.status = 'approved'`,
  }).fetchAll();
  if (documents.length === 0) {
    console.log('No public developer records found.');
    return;
  }

  const rescored = scoreAll(documents);
  const documentsById = new Map(documents.map(document => [document.id, document]));
  const changes = rescored
    .map(document => ({
      before: documentsById.get(document.id),
      after: document,
    }))
    .map(change => ({ ...change, fields: changedScoreFields(change.before, change.after) }))
    .filter(change => change.fields.length > 0);

  console.log(`Container: ${DATABASE}/${CONTAINER} (${partitionPaths.join(', ')})`);
  console.log(`Public records: ${documents.length}; records requiring updates: ${changes.length}`);
  changes.slice(0, 10).forEach(({ before, after, fields }) => {
    console.log(`  ${before.login || before.id}: ${before.score ?? 'unset'} -> ${after.score} [${fields.join(', ')}]`);
  });

  if (!APPLY) {
    console.log('Dry run only. Re-run with --apply to patch these score fields.');
    return;
  }

  let updated = 0;
  for (const { before, after, fields } of changes) {
    const operations = fields.map(field => ({ op: 'set', path: `/${field}`, value: after[field] }));
    const item = container.item(before.id, getPartitionKey(before, partitionPaths));
    await patchWithRetry(item, operations, before._etag);
    updated++;
    if (updated % 100 === 0) console.log(`Updated ${updated}/${changes.length} records...`);
  }

  console.log(`Updated ${updated} records. Source profile fields were not modified.`);
}

main().catch(error => {
  console.error(`Rescore failed: ${error.message}`);
  process.exit(1);
});