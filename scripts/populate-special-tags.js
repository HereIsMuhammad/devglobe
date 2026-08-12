/**
 * Populate verified developer credentials from official public rosters.
 *
 * Dry run: node scripts/populate-special-tags.js
 * Apply:   node scripts/populate-special-tags.js --apply
 */
import 'dotenv/config';
import { CosmosClient } from '@azure/cosmos';

const APPLY = process.argv.includes('--apply');
const DATABASE = process.env.COSMOS_DATABASE || 'devglobe';
const CONTAINER = process.env.COSMOS_CONTAINER || 'developers';
const SOURCES = {
  'github-star': 'https://stars.github.com/profiles/',
  'cncf-ambassador': 'https://raw.githubusercontent.com/cncf/people/main/people.json',
};

function normalizeLogin(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/^@/, '');
  const urlMatch = trimmed.match(/^https?:\/\/(?:www\.)?github\.com\/([a-z\d](?:[a-z\d-]{0,37}[a-z\d])?)(?:[/?#]|$)/i);
  const login = urlMatch?.[1] || trimmed;
  return /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(login) ? login.toLowerCase() : null;
}

function flattenRecords(value, records = []) {
  if (Array.isArray(value)) {
    value.forEach(item => flattenRecords(item, records));
  } else if (value && typeof value === 'object') {
    records.push(value);
    Object.values(value).forEach(item => {
      if (Array.isArray(item)) flattenRecords(item, records);
    });
  }
  return records;
}

async function fetchGitHubStars() {
  const response = await fetch(SOURCES['github-star'], {
    headers: { 'User-Agent': 'DevGlobe credential enricher' },
  });
  if (!response.ok) throw new Error(`GitHub Stars directory returned ${response.status}`);

  const html = await response.text();
  return new Set(
    [...html.matchAll(/href=["'](?:https:\/\/stars\.github\.com)?\/profiles\/([a-z\d-]+)\/?["']/gi)]
      .map(match => normalizeLogin(match[1]))
      .filter(Boolean)
  );
}

async function fetchCNCFAmbassadors() {
  const response = await fetch(SOURCES['cncf-ambassador'], {
    headers: { 'User-Agent': 'DevGlobe credential enricher' },
  });
  if (!response.ok) throw new Error(`CNCF people roster returned ${response.status}`);

  const data = await response.json();
  const ambassadors = new Set();
  flattenRecords(data).forEach(record => {
    const categories = [record.category, record.categories, record.type, record.role]
      .flat()
      .filter(Boolean)
      .join(' ');
    if (!/ambassador/i.test(categories)) return;

    const login = normalizeLogin(record.github || record.githubUrl || record.github_url);
    if (login) ambassadors.add(login);
  });
  return ambassadors;
}

async function main() {
  if (!process.env.COSMOS_ENDPOINT || !process.env.COSMOS_KEY) {
    throw new Error('COSMOS_ENDPOINT and COSMOS_KEY are required');
  }

  const [githubStars, cncfAmbassadors] = await Promise.all([
    fetchGitHubStars(),
    fetchCNCFAmbassadors(),
  ]);
  console.log(`Official rosters: ${githubStars.size} GitHub Stars, ${cncfAmbassadors.size} CNCF Ambassadors`);

  const client = new CosmosClient({
    endpoint: process.env.COSMOS_ENDPOINT,
    key: process.env.COSMOS_KEY,
  });
  const container = client.database(DATABASE).container(CONTAINER);
  const { resources: developers } = await container.items.query(
    'SELECT c.id, c.login, c.location, c.specialTags FROM c WHERE IS_DEFINED(c.login)'
  ).fetchAll();

  const matches = developers.flatMap(developer => {
    const login = normalizeLogin(developer.login);
    if (!login) return [];

    const verifiedTags = [];
    if (githubStars.has(login)) verifiedTags.push('github-star');
    if (cncfAmbassadors.has(login)) verifiedTags.push('cncf-ambassador');
    if (verifiedTags.length === 0) return [];

    const existingTags = Array.isArray(developer.specialTags) ? developer.specialTags : [];
    const specialTags = [...new Set([...existingTags, ...verifiedTags])];
    return [{ ...developer, verifiedTags, specialTags, changed: specialTags.length !== existingTags.length }];
  });

  const counts = Object.fromEntries(Object.keys(SOURCES).map(tag => [tag, matches.filter(match => match.verifiedTags.includes(tag)).length]));
  console.log(`Dataset: ${developers.length} developers`);
  console.log(`Exact matches: ${matches.length} developers (${JSON.stringify(counts)})`);
  matches.forEach(match => console.log(`  ${match.login}: ${match.verifiedTags.join(', ')}${match.changed ? '' : ' (already populated)'}`));

  if (!APPLY) {
    console.log('\nDry run only. Re-run with --apply to patch exact matches.');
    return;
  }

  const changedMatches = matches.filter(match => match.changed);
  let updated = 0;
  for (const match of changedMatches) {
    await container.item(match.id, match.location || 'Unknown').patch({
      operations: [{ op: 'set', path: '/specialTags', value: match.specialTags }],
    });
    updated++;
  }
  console.log(`\nUpdated ${updated} developer documents.`);
}

main().catch(error => {
  console.error(`Credential population failed: ${error.message}`);
  process.exitCode = 1;
});