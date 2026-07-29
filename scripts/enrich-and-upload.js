/**
 * Enrich & Upload — Takes existing github-raw.json, adds SO + geocoding, uploads to Cosmos DB
 *
 * Skips the slow GitHub fetch (already done). Focuses on enrichment + upload.
 * Run: node scripts/enrich-and-upload.js > enrich.log 2>&1
 */
import 'dotenv/config';
import { CosmosClient } from '@azure/cosmos';
import { writeFileSync, readFileSync, existsSync } from 'fs';

const SO_API_KEY = process.env.SO_API_KEY || '';
const SO_ACCESS_TOKEN = process.env.SO_ACCESS_TOKEN || '';
const GEOCODE_API_KEY = process.env.GEOCODE_API_KEY || '';
const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT || 'https://devglobe-cosmos.documents.azure.com:443/';
const COSMOS_KEY = process.env.COSMOS_KEY;

if (!COSMOS_KEY) { console.error('COSMOS_KEY required in .env'); process.exit(1); }

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============ STACKOVERFLOW ============
// Alternate between key-only and access_token calls for 20K/day total
let useAccessToken = false;

async function fetchSO(login) {
  if (!SO_API_KEY) return null;
  let url = `https://api.stackexchange.com/2.3/users?order=desc&sort=reputation&inname=${encodeURIComponent(login)}&site=stackoverflow&key=${SO_API_KEY}&pagesize=1&filter=!nNPvSNVZJS`;

  // Alternate with access_token for separate quota
  if (SO_ACCESS_TOKEN && useAccessToken) {
    url += `&access_token=${SO_ACCESS_TOKEN}`;
  }
  useAccessToken = !useAccessToken;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.backoff) { log(`  SO backoff: ${data.backoff}s`); await sleep(data.backoff * 1000); }
    if (data.items?.[0]) {
      const u = data.items[0];
      return { soUserId: u.user_id, soReputation: u.reputation || 0, soAnswers: u.answer_count || 0, soAcceptRate: u.accept_rate || 0, soBadges: (u.badge_counts?.gold||0)+(u.badge_counts?.silver||0)+(u.badge_counts?.bronze||0) };
    }
  } catch(e) {}
  return null;
}

// ============ GEOCODING ============
const geoCache = new Map();
async function geocode(location) {
  if (!location || !GEOCODE_API_KEY) return { lat: null, lng: null };
  if (geoCache.has(location)) return geoCache.get(location);
  try {
    const res = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(location)}&key=${GEOCODE_API_KEY}&limit=1&no_annotations=1`);
    if (!res.ok) { geoCache.set(location, {lat:null,lng:null}); return {lat:null,lng:null}; }
    const data = await res.json();
    if (data.results?.[0]) {
      const {lat, lng} = data.results[0].geometry;
      geoCache.set(location, {lat,lng});
      return {lat,lng};
    }
  } catch(e) {}
  geoCache.set(location, {lat:null,lng:null});
  return {lat:null,lng:null};
}

// ============ MAIN ============
async function main() {
  const start = Date.now();
  log('Loading github-raw.json...');
  const devs = JSON.parse(readFileSync('data/github-raw.json', 'utf-8'));
  log(`Loaded ${devs.length} developers`);

  // SO enrichment
  log('\n--- SO Enrichment ---');
  let soCount = 0;
  for (let i = 0; i < devs.length; i++) {
    const dev = devs[i];
    if (/^[a-zA-Z0-9_-]+$/.test(dev.login)) {
      const so = await fetchSO(dev.login);
      if (so) { Object.assign(dev, so); soCount++; }
      await sleep(400);
    }
    dev.soUserId = dev.soUserId || null;
    dev.soReputation = dev.soReputation || 0;
    dev.soAnswers = dev.soAnswers || 0;
    dev.soAcceptRate = dev.soAcceptRate || 0;
    dev.soBadges = dev.soBadges || 0;

    if ((i+1) % 100 === 0) log(`  SO: ${i+1}/${devs.length} (matched: ${soCount})`);
  }
  log(`  SO done: ${soCount} matched\n`);

  // Geocoding
  log('--- Geocoding ---');
  let geoCount = 0;
  for (let i = 0; i < devs.length; i++) {
    const {lat, lng} = await geocode(devs[i].location);
    devs[i].lat = lat;
    devs[i].lng = lng;
    if (lat) geoCount++;
    // Only delay for non-cached lookups (1 req/sec free tier)
    if (!geoCache.has(devs[i].location)) await sleep(1100);
    if ((i+1) % 100 === 0) log(`  Geo: ${i+1}/${devs.length} (resolved: ${geoCount})`);
  }
  log(`  Geo done: ${geoCount} resolved\n`);

  // Scoring
  log('--- Scoring ---');
  const maxV = {
    stars: Math.max(1,...devs.map(d=>d.totalStars||0)),
    commits: Math.max(1,...devs.map(d=>d.totalCommits||0)),
    forks: Math.max(1,...devs.map(d=>d.totalForks||0)),
    soRep: Math.max(1,...devs.map(d=>d.soReputation||0)),
    followers: Math.max(1,...devs.map(d=>d.followers||0))
  };
  const norm = (v,m) => Math.log(1+v)/Math.log(1+m);

  devs.forEach(dev => {
    const dims = {
      stars: norm(dev.totalStars||0, maxV.stars),
      commits: norm(dev.totalCommits||0, maxV.commits),
      repoReach: norm(dev.totalForks||0, maxV.forks),
      soReputation: norm(dev.soReputation||0, maxV.soRep),
      soEngagement: norm(((dev.soAcceptRate||0)/100)*(dev.soAnswers||0), 1000),
      community: norm(dev.followers||0, maxV.followers)
    };
    dev.score = Math.round((dims.stars*0.25 + dims.commits*0.25 + dims.repoReach*0.20 + dims.soReputation*0.15 + dims.soEngagement*0.10 + dims.community*0.05)*100);
    dev.scoreDimensions = dims;
  });
  devs.sort((a,b) => b.score - a.score);
  log(`  Scored ${devs.length} developers`);

  // Save locally
  writeFileSync('data/developers.json', JSON.stringify(devs, null, 2));
  log(`  Saved data/developers.json\n`);

  // Upload to Cosmos DB
  log('--- Uploading to Cosmos DB ---');
  const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY });
  const container = client.database('devglobe').container('developers');

  let uploaded = 0, errors = 0;
  for (let i = 0; i < devs.length; i += 25) {
    const batch = devs.slice(i, i + 25);
    await Promise.all(batch.map(async dev => {
      try {
        await container.items.upsert({ ...dev, id: dev.login, location: dev.location || 'Unknown' });
        uploaded++;
      } catch(e) { errors++; }
    }));
    if ((i+25) % 100 === 0 || i+25 >= devs.length) log(`  Cosmos: ${uploaded}/${devs.length} uploaded`);
  }

  const mins = ((Date.now()-start)/60000).toFixed(1);
  log(`\n═══ COMPLETE in ${mins} min ═══`);
  log(`  Developers: ${devs.length}`);
  log(`  SO enriched: ${soCount}`);
  log(`  Geocoded: ${geoCount}`);
  log(`  Cosmos: ${uploaded} uploaded, ${errors} errors`);
}

main().catch(e => { log(`FATAL: ${e.message}`); process.exit(1); });
