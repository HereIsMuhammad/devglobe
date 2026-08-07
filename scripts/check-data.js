import { CosmosClient } from '@azure/cosmos';
import dotenv from 'dotenv';
dotenv.config();

const client = new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, key: process.env.COSMOS_KEY });
const container = client.database('devglobe').container('developers');

// Sample some developers to check field completeness
const { resources: sample } = await container.items.query(
  'SELECT TOP 5 c.login, c.totalStars, c.totalCommits, c.totalForks, c.followers, c.topLanguage, c.soReputation, c.soAnswers, c.topRepos, c.languages FROM c ORDER BY c.followers DESC'
).fetchAll();

console.log('=== Top 5 by followers ===');
sample.forEach(d => {
  console.log(`  ${d.login}: stars=${d.totalStars ?? 'MISSING'}, commits=${d.totalCommits ?? 'MISSING'}, forks=${d.totalForks ?? 'MISSING'}, lang=${d.topLanguage ?? 'MISSING'}, soRep=${d.soReputation ?? 'MISSING'}, repos=${d.topRepos?.length ?? 'MISSING'}, langs=${d.languages?.length ?? 'MISSING'}`);
});

// Count missing fields
const queries = [
  ['totalStars = 0 or missing', "SELECT VALUE COUNT(1) FROM c WHERE NOT IS_DEFINED(c.totalStars) OR c.totalStars = 0"],
  ['totalCommits = 0 or missing', "SELECT VALUE COUNT(1) FROM c WHERE NOT IS_DEFINED(c.totalCommits) OR c.totalCommits = 0"],
  ['totalForks = 0 or missing', "SELECT VALUE COUNT(1) FROM c WHERE NOT IS_DEFINED(c.totalForks) OR c.totalForks = 0"],
  ['topLanguage missing', "SELECT VALUE COUNT(1) FROM c WHERE NOT IS_DEFINED(c.topLanguage) OR c.topLanguage = null"],
  ['soReputation = 0', "SELECT VALUE COUNT(1) FROM c WHERE NOT IS_DEFINED(c.soReputation) OR c.soReputation = 0"],
  ['topRepos missing', "SELECT VALUE COUNT(1) FROM c WHERE NOT IS_DEFINED(c.topRepos) OR ARRAY_LENGTH(c.topRepos) = 0"],
  ['languages missing', "SELECT VALUE COUNT(1) FROM c WHERE NOT IS_DEFINED(c.languages) OR ARRAY_LENGTH(c.languages) = 0"],
  ['location missing', "SELECT VALUE COUNT(1) FROM c WHERE NOT IS_DEFINED(c.location) OR c.location = null"],
  ['lat/lng missing', "SELECT VALUE COUNT(1) FROM c WHERE NOT IS_DEFINED(c.lat) OR c.lat = null"],
  ['total', "SELECT VALUE COUNT(1) FROM c"],
];

console.log('\n=== Data completeness (out of total) ===');
for (const [label, query] of queries) {
  const { resources } = await container.items.query(query).fetchAll();
  console.log(`  ${label}: ${resources[0]}`);
}
