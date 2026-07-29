/**
 * Fetch StackOverflow data for GitHub developers
 *
 * Usage: SO_API_KEY=xxx node scripts/fetch-stackoverflow.js
 * Input: data/github-raw.json
 * Output: data/github-so-merged.json
 */
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'fs';

const SO_API_KEY = process.env.SO_API_KEY || '';
const SO_API_BASE = 'https://api.stackexchange.com/2.3';

async function fetchSOUser(query, retries = 3) {
  const params = new URLSearchParams({
    order: 'desc',
    sort: 'reputation',
    inname: query,
    site: 'stackoverflow',
    pagesize: '5',
    filter: '!LnNkvq0d-S*U.QkZOE2'
  });
  if (SO_API_KEY) params.set('key', SO_API_KEY);

  const url = `${SO_API_BASE}/users?${params}`;

  for (let attempt = 0; attempt < retries; attempt++) {
    const response = await fetch(url);

    if (response.status === 429) {
      const wait = Math.pow(2, attempt + 1) * 10; // 20s, 40s, 80s
      console.log(`    ⏳ Rate limited (429), waiting ${wait}s... (attempt ${attempt + 1}/${retries})`);
      await new Promise(r => setTimeout(r, wait * 1000));
      continue;
    }

    if (!response.ok) {
      throw new Error(`SO API error ${response.status}`);
    }

    const data = await response.json();

    if (data.backoff) {
      console.log(`    ⏳ Backoff requested: ${data.backoff}s...`);
      await new Promise(r => setTimeout(r, data.backoff * 1000));
    }

    return data.items || [];
  }

  console.log(`    ⚠️ Skipped after ${retries} retries`);
  return [];
}

function bestMatch(soUsers, ghUser) {
  if (!soUsers.length) return null;

  // Try exact display name match
  const nameMatch = soUsers.find(u =>
    u.display_name.toLowerCase() === (ghUser.name || '').toLowerCase() ||
    u.display_name.toLowerCase() === ghUser.login.toLowerCase()
  );
  if (nameMatch) return nameMatch;

  // Try partial match with high reputation
  const partialMatch = soUsers.find(u =>
    u.reputation > 5000 && (
      u.display_name.toLowerCase().includes(ghUser.login.toLowerCase()) ||
      (ghUser.name && u.display_name.toLowerCase().includes(ghUser.name.split(' ')[0].toLowerCase()))
    )
  );
  if (partialMatch) return partialMatch;

  // Return highest rep user only if name is somewhat similar
  return null;
}

async function main() {
  console.log('Fetching StackOverflow data...\n');

  let developers;
  try {
    developers = JSON.parse(readFileSync('data/github-raw.json', 'utf-8'));
  } catch {
    console.error('Error: data/github-raw.json not found. Run fetch-github.js first.');
    process.exit(1);
  }

  const enriched = [];
  let matched = 0;

  for (let i = 0; i < developers.length; i++) {
    const dev = developers[i];
    const searchTerm = dev.name || dev.login;
    const pct = ((i + 1) / developers.length * 100).toFixed(1);

    // Skip non-ASCII names — SO search can't match them
    if (!/^[\x20-\x7E]+$/.test(searchTerm)) {
      console.log(`  [${i + 1}/${developers.length} ${pct}%] Skipping (non-ASCII): ${searchTerm}`);
      enriched.push({ ...dev, soUserId: null, soReputation: 0, soAnswers: 0, soAcceptRate: 0, soBadges: 0 });
      continue;
    }

    console.log(`  [${i + 1}/${developers.length} ${pct}%] Looking up: ${searchTerm}`);

    try {
      const soUsers = await fetchSOUser(searchTerm);
      const match = bestMatch(soUsers, dev);

      if (match) {
        matched++;
        enriched.push({
          ...dev,
          soUserId: match.user_id,
          soReputation: match.reputation || 0,
          soAnswers: match.answer_count || 0,
          soAcceptRate: match.accept_rate || 0,
          soBadges: (match.badge_counts?.gold || 0) +
                    (match.badge_counts?.silver || 0) +
                    (match.badge_counts?.bronze || 0)
        });
        console.log(`    ✓ Matched: ${match.display_name} (rep: ${match.reputation})`);
      } else {
        enriched.push({
          ...dev,
          soUserId: null,
          soReputation: 0,
          soAnswers: 0,
          soAcceptRate: 0,
          soBadges: 0
        });
        console.log(`    ✗ No match found`);
      }
    } catch (err) {
      console.error(`    Error: ${err.message}`);
      enriched.push({
        ...dev,
        soUserId: null,
        soReputation: 0,
        soAnswers: 0,
        soAcceptRate: 0,
        soBadges: 0
      });
    }

    // SO API rate limit: with key 10K/day, ~350ms is safe
    await new Promise(r => setTimeout(r, SO_API_KEY ? 350 : 2000));
  }

  writeFileSync('data/github-so-merged.json', JSON.stringify(enriched, null, 2));
  console.log(`\nDone. Matched ${matched}/${developers.length} developers.`);
  console.log('Saved to data/github-so-merged.json');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
