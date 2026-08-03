import { CosmosClient } from '@azure/cosmos';
import dotenv from 'dotenv';
dotenv.config();

const client = new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, key: process.env.COSMOS_KEY });
const container = client.database('devglobe').container('developers');

// Check Sri Lanka coverage
const { resources: slDevs } = await container.items.query(
  "SELECT c.login, c.location, c.totalStars, c.followers, c.soReputation FROM c WHERE CONTAINS(LOWER(c.location), 'sri lanka') OR CONTAINS(LOWER(c.location), 'colombo') OR CONTAINS(LOWER(c.location), 'kandy')"
).fetchAll();

console.log('Sri Lanka devs in Cosmos DB:', slDevs.length);
slDevs.slice(0, 15).forEach(d => console.log(' ', d.login, '|', d.location, '| stars:', d.totalStars, '| followers:', d.followers, '| SO:', d.soReputation));

// Check total
const { resources: total } = await container.items.query('SELECT VALUE COUNT(1) FROM c').fetchAll();
console.log('\nTotal devs in DB:', total[0]);

// Missing geo
const { resources: noGeo } = await container.items.query('SELECT VALUE COUNT(1) FROM c WHERE NOT IS_DEFINED(c.lat) OR c.lat = null').fetchAll();
console.log('Missing lat/lng:', noGeo[0]);

// Check sajeetharan
const { resources: me } = await container.items.query("SELECT c.login, c.location, c.totalStars, c.followers, c.soReputation, c.soAnswers, c.topLanguage FROM c WHERE c.login = 'sajeetharan'").fetchAll();
console.log('\nsajeetharan:', me.length ? JSON.stringify(me[0], null, 2) : 'NOT FOUND');
