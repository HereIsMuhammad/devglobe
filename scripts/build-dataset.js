/**
 * Build Dataset — orchestrates the full data pipeline
 *
 * Usage: node scripts/build-dataset.js
 *
 * Runs: fetch-github → fetch-stackoverflow → geocode → score → output
 * Output: data/developers.json (final dataset used by frontend)
 *
 * For quick local development, use data/developers-sample.json instead.
 */
import 'dotenv/config';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

function run(script, description) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  STEP: ${description}`);
  console.log(`${'='.repeat(60)}\n`);
  execSync(`node ${script}`, { stdio: 'inherit', cwd: process.cwd() });
}

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║     DevGlobe Data Pipeline Builder      ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // Ensure data directory exists
  mkdirSync('data', { recursive: true });

  // Check for required env vars
  if (!process.env.GITHUB_TOKEN) {
    console.error('⚠️  GITHUB_TOKEN not set. Create a .env file (see .env.example).');
    console.error('   The pipeline needs a GitHub token to fetch developer data.\n');
    process.exit(1);
  }

  // Step 1: Fetch GitHub data
  run('scripts/fetch-github.js', 'Fetching GitHub developer data');

  // Step 2: Enrich with StackOverflow data
  run('scripts/fetch-stackoverflow.js', 'Fetching StackOverflow data');

  // Step 3: Geocode locations
  run('scripts/geocode.js', 'Geocoding developer locations');

  // Step 4: Apply scoring
  console.log(`\n${'='.repeat(60)}`);
  console.log('  STEP: Computing composite scores');
  console.log(`${'='.repeat(60)}\n`);

  const developers = JSON.parse(readFileSync('data/github-so-geo.json', 'utf-8'));

  // Import scoring logic (reuse browser module logic)
  function logNormalize(value, max) {
    if (value <= 0 || max <= 0) return 0;
    return Math.log(1 + value) / Math.log(1 + max);
  }

  function linearNormalize(value, max) {
    if (max <= 0) return 0;
    return Math.min(value / max, 1);
  }

  const maxValues = {
    stars: Math.max(...developers.map(d => d.totalStars || 0)),
    commits: Math.max(...developers.map(d => d.totalCommits || 0)),
    repoReach: Math.max(...developers.map(d => (d.totalForks || 0) + (d.totalWatchers || 0))),
    soReputation: Math.max(...developers.map(d => d.soReputation || 0)),
    soEngagement: Math.max(...developers.map(d => ((d.soAcceptRate || 0) / 100) * (d.soAnswers || 0))),
    community: Math.max(...developers.map(d => (d.followers || 0) + (d.soBadges || 0)))
  };

  const WEIGHTS = { stars: 0.25, commits: 0.25, repoReach: 0.20, soReputation: 0.15, soEngagement: 0.10, community: 0.05 };

  const scored = developers.map(dev => {
    const dimensions = {
      stars: logNormalize(dev.totalStars || 0, maxValues.stars),
      commits: logNormalize(dev.totalCommits || 0, maxValues.commits),
      repoReach: logNormalize((dev.totalForks || 0) + (dev.totalWatchers || 0), maxValues.repoReach),
      soReputation: logNormalize(dev.soReputation || 0, maxValues.soReputation),
      soEngagement: linearNormalize(((dev.soAcceptRate || 0) / 100) * (dev.soAnswers || 0), maxValues.soEngagement),
      community: logNormalize((dev.followers || 0) + (dev.soBadges || 0), maxValues.community)
    };

    let score = 0;
    for (const [key, weight] of Object.entries(WEIGHTS)) {
      score += dimensions[key] * weight;
    }

    return { ...dev, score: Math.round(score * 100), scoreDimensions: dimensions };
  }).sort((a, b) => b.score - a.score);

  // Write final output
  writeFileSync('data/developers.json', JSON.stringify(scored, null, 2));

  console.log(`\n✅ Pipeline complete!`);
  console.log(`   Total developers: ${scored.length}`);
  console.log(`   Top scorer: ${scored[0]?.login} (${scored[0]?.score}/100)`);
  console.log(`   Output: data/developers.json`);
  console.log(`\n   To use in the app, update DATA_URL in src/app.js to 'data/developers.json'`);
}

main().catch(err => {
  console.error('\n❌ Pipeline failed:', err.message);
  process.exit(1);
});
