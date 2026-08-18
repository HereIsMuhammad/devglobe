import { CosmosClient } from '@azure/cosmos';
import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { projectAgentReadiness } from '../../../lib/agent-network.js';
import { parsePaginationParams } from '../../../lib/pagination.js';

const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT;
const COSMOS_KEY = process.env.COSMOS_KEY;
const DATABASE = process.env.COSMOS_DATABASE || 'devglobe';
const CONTAINER = process.env.COSMOS_CONTAINER || 'developers';

async function getSampleData() {
  const filePath = path.join(process.cwd(), 'data', 'developers-sample.json');
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

function projectAgentReadinessList(developers) {
  return developers.map(projectAgentReadiness);
}

// GET /api/developers            -> full array (legacy shape, unchanged for existing callers)
// GET /api/developers?limit=&offset= -> { developers, hasMore, nextOffset } for initial-batch +
//   progressive background loading (see #182). Ordered by score desc so the first, fast-loading
//   batch is also the most relevant one.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const pagination = parsePaginationParams(searchParams);

  // Fallback to sample data when Cosmos DB is not configured
  if (!COSMOS_ENDPOINT || !COSMOS_KEY) {
    const projected = projectAgentReadinessList(await getSampleData());
    if (!pagination) {
      return NextResponse.json(projected, { headers: { 'Cache-Control': 'no-store' } });
    }
    const { limit, offset } = pagination;
    const page = projected.slice(offset, offset + limit);
    return NextResponse.json({
      developers: page,
      hasMore: offset + limit < projected.length,
      nextOffset: offset + limit,
    }, { headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY });
    const container = client.database(DATABASE).container(CONTAINER);
    const fields = 'c.id, c.login, c.name, c.avatarUrl, c.location, c.lat, c.lng, c.followers, c.publicRepos, c.totalStars, c.totalForks, c.totalCommits, c.topLanguage, c.soUserId, c.soReputation, c.soAnswers, c.soBadges, c.score, c.specialTags, c.claimed, c.metricsUpdatedAt, c.aiProfile';
    const baseQuery = `SELECT ${fields} FROM c WHERE (NOT IS_DEFINED(c.nomination) OR c.nomination.status = 'approved') ORDER BY c.score DESC`;

    if (!pagination) {
      const { resources } = await container.items.query(baseQuery).fetchAll();
      return NextResponse.json(projectAgentReadinessList(resources), {
        headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=600' },
      });
    }

    const { limit, offset } = pagination;
    const { resources } = await container.items.query({
      query: `${baseQuery} OFFSET @offset LIMIT @limit`,
      parameters: [
        { name: '@offset', value: offset },
        { name: '@limit', value: limit },
      ],
    }).fetchAll();

    return NextResponse.json({
      developers: projectAgentReadinessList(resources),
      // A full page suggests more may follow; the client stops once a short page comes back.
      hasMore: resources.length === limit,
      nextOffset: offset + resources.length,
    }, { headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=600' } });
  } catch (err) {
    console.error('Cosmos DB error:', err.message);
    // Fallback to sample data on connection errors
    const projected = projectAgentReadinessList(await getSampleData());
    if (!pagination) {
      return NextResponse.json(projected, { headers: { 'Cache-Control': 'no-store' } });
    }
    const { limit, offset } = pagination;
    const page = projected.slice(offset, offset + limit);
    return NextResponse.json({
      developers: page,
      hasMore: offset + limit < projected.length,
      nextOffset: offset + limit,
    }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
