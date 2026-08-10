/**
 * One-time migration: legacy `nominations` container -> `developers`-only
 * nomination model (issue #96).
 *
 * Usage:
 *   node scripts/migrate-nominations.js --dry-run     # report only, no writes
 *   node scripts/migrate-nominations.js --backup       # export nominations to a JSON file
 *   node scripts/migrate-nominations.js --apply         # actually write migrated documents
 *   node scripts/migrate-nominations.js --verify        # compare source/target counts + sample records
 *
 * For every legacy nomination document:
 *   - If a matching `developers` document already has `nomination` metadata,
 *     it's already migrated -> skipped (idempotent: safe to re-run).
 *   - If a matching `developers` document exists with NO `nomination` field,
 *     it's a public developer whose data would conflict with a legacy
 *     nomination -> reported as a conflict, never overwritten.
 *   - Otherwise, a new developer-shaped document is created from the legacy
 *     nomination fields, preserving its original submittedAt/reviewedAt and
 *     status, defaulting to 'pending' status if the legacy record has none.
 *
 * This script only ever writes to `developers`. It never deletes anything
 * from `nominations` — see the runbook comment at the bottom of this file
 * for the manual container-removal step, which is intentionally NOT
 * automated here.
 */
import 'dotenv/config';
import { writeFileSync } from 'fs';
import { CosmosClient } from '@azure/cosmos';
import { getDevelopersContainer, findDeveloperByLogin, resolveLocation, normalizeUsername, SCHEMA_VERSION } from '../lib/nominate.js';

const DATABASE = process.env.COSMOS_DATABASE || 'devglobe';
const NOMINATIONS_CONTAINER = 'nominations';

if (!process.env.COSMOS_ENDPOINT || !process.env.COSMOS_KEY) {
  console.error('Error: COSMOS_ENDPOINT and COSMOS_KEY are required in .env');
  process.exit(1);
}

async function getNominationsContainer(client) {
  const database = client.database(DATABASE);
  // Read-only intent: does not create the container if it's already gone.
  return database.container(NOMINATIONS_CONTAINER);
}

async function loadLegacyNominations(container) {
  const { resources } = await container.items.query({ query: 'SELECT * FROM c' }).fetchAll();
  return resources;
}

function buildMigratedDoc(legacy) {
  const login = normalizeUsername(legacy.username || legacy.login);
  const now = new Date().toISOString();
  const status = ['pending', 'approved', 'rejected'].includes(legacy.status) ? legacy.status : 'pending';

  return {
    id: login,
    login,
    name: legacy.name || login,
    avatarUrl: legacy.avatarUrl || null,
    bio: legacy.bio || null,
    githubUrl: legacy.githubUrl || `https://github.com/${login}`,
    location: resolveLocation(legacy.location, null),
    followers: legacy.followers || 0,
    publicRepos: legacy.publicRepos || 0,
    totalStars: legacy.totalStars || 0,
    totalForks: legacy.totalForks || 0,
    totalWatchers: legacy.totalWatchers || 0,
    totalCommits: legacy.totalCommits || 0,
    topLanguage: legacy.topLanguage || null,
    languages: legacy.languages || [],
    topRepos: legacy.topRepos || [],
    schemaVersion: SCHEMA_VERSION,
    source: 'self-nomination',
    nomination: {
      status,
      // Preserve original timestamps rather than stamping "now", so review
      // history/ordering from the legacy container survives the migration.
      submittedAt: legacy.createdAt || now,
      submittedLocation: legacy.location || null,
      reviewedAt: legacy.reviewedAt || null,
      reviewedBy: legacy.reviewedBy || null,
      rejectionReason: legacy.rejectionReason || null,
      enrichmentStatus: legacy.totalStars !== undefined ? 'complete' : 'partial',
      enrichedAt: legacy.createdAt || now,
      enrichmentError: null,
      migratedFrom: 'nominations',
      migratedAt: now,
    },
  };
}

async function run({ dryRun, apply, backup, verify }) {
  const client = new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, key: process.env.COSMOS_KEY });
  const nominationsContainer = await getNominationsContainer(client);
  const developersContainer = await getDevelopersContainer();

  const legacy = await loadLegacyNominations(nominationsContainer);
  console.log(`Loaded ${legacy.length} legacy nomination record(s).\n`);

  if (backup) {
    const filename = `nominations-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    writeFileSync(filename, JSON.stringify(legacy, null, 2));
    console.log(`✓ Backed up ${legacy.length} record(s) to ${filename}\n`);
  }

  const counts = { migrated: 0, skipped: 0, conflicted: 0, failed: 0 };
  const details = { conflicted: [], failed: [] };

  for (const item of legacy) {
    const login = normalizeUsername(item.username || item.login);
    if (!login) {
      counts.failed++;
      details.failed.push({ item, reason: 'No username/login field' });
      continue;
    }

    try {
      const existing = await findDeveloperByLogin(developersContainer, login);

      if (existing?.nomination) {
        // Already has lifecycle metadata — either migrated previously or
        // already handled by the new submission flow. Safe to skip.
        counts.skipped++;
        continue;
      }

      if (existing && !existing.nomination) {
        // A public developer document exists with no nomination metadata.
        // Never overwrite it — report so a human can decide.
        counts.conflicted++;
        details.conflicted.push({ login, reason: 'Existing public developer document with no nomination field' });
        continue;
      }

      const doc = buildMigratedDoc(item);

      if (dryRun) {
        counts.migrated++;
        continue;
      }

      if (apply) {
        await developersContainer.items.upsert(doc);
        counts.migrated++;
      }
    } catch (err) {
      counts.failed++;
      details.failed.push({ login, reason: err.message });
    }
  }

  console.log(`${dryRun ? '[DRY RUN] ' : ''}Migration summary:`);
  console.log(`  Migrated:   ${counts.migrated}`);
  console.log(`  Skipped (already migrated): ${counts.skipped}`);
  console.log(`  Conflicted: ${counts.conflicted}`);
  console.log(`  Failed:     ${counts.failed}`);

  if (details.conflicted.length) {
    console.log('\nConflicts (not written, needs manual review):');
    details.conflicted.forEach(c => console.log(`  - ${c.login}: ${c.reason}`));
  }
  if (details.failed.length) {
    console.log('\nFailures:');
    details.failed.forEach(f => console.log(`  - ${f.login || '(unknown)'}: ${f.reason}`));
  }

  if (verify) {
    const { resources: migratedCount } = await developersContainer.items
      .query({ query: "SELECT VALUE COUNT(1) FROM c WHERE IS_DEFINED(c.nomination.migratedFrom)" })
      .fetchAll();
    console.log(`\nVerification: developers container now has ${migratedCount[0]} document(s) tagged migratedFrom='nominations' (source had ${legacy.length}).`);
    if (migratedCount[0] < legacy.length - counts.conflicted - counts.failed) {
      console.log('  ⚠ Counts do not reconcile — investigate before removing the legacy container.');
    } else {
      console.log('  ✓ Counts reconcile with migrated + (legacy minus conflicts/failures).');
    }
  }

  if (!dryRun && !apply && !backup && !verify) {
    console.log('\nNo action flag given — nothing was written. Pass --dry-run, --backup, --apply, or --verify.');
  }
}

const args = new Set(process.argv.slice(2));
run({
  dryRun: args.has('--dry-run'),
  apply: args.has('--apply'),
  backup: args.has('--backup'),
  verify: args.has('--verify'),
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

/**
 * ── Cleanup runbook (manual, run only after verification) ──────────────
 *
 * 1. node scripts/migrate-nominations.js --backup           # export a JSON snapshot
 * 2. node scripts/migrate-nominations.js --dry-run           # review counts
 * 3. node scripts/migrate-nominations.js --apply --verify    # write + verify
 * 4. Manually spot-check several migrated documents in the Azure portal or
 *    via `node scripts/review-nominations.js status <username>`.
 * 5. Keep the `nominations` container around for an agreed rollback window
 *    (e.g. 1-2 weeks) before deleting it.
 * 6. After the rollback window, delete the container manually:
 *
 *      az cosmosdb sql container delete \
 *        --account-name <account> \
 *        --database-name devglobe \
 *        --name nominations \
 *        --resource-group <resource-group> \
 *        --yes
 *
 *    This is deliberately NOT scripted here — container deletion is
 *    irreversible and must be a conscious, separate action, not something
 *    that can run as part of normal app startup or CI.
 */
