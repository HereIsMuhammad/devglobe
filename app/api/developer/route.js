import { CosmosClient } from '@azure/cosmos';
import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT;
const COSMOS_KEY = process.env.COSMOS_KEY;
const DATABASE = process.env.COSMOS_DATABASE || 'devglobe';
const CONTAINER = process.env.COSMOS_CONTAINER || 'developers';

async function getSampleData() {
  const filePath = path.join(process.cwd(), 'data', 'developers-sample.json');
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json(
      { error: 'Query parameter "id" is required' },
      { status: 400 }
    );
  }

  // Fallback to sample data when Cosmos DB is not configured
  if (!COSMOS_ENDPOINT || !COSMOS_KEY) {
    const data = await getSampleData();
    const dev = data.find(d => d.login === id || d.id === id);
    if (!dev) {
      return NextResponse.json({ error: 'Developer not found' }, { status: 404 });
    }
    return NextResponse.json(dev);
  }

  try {
    const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY });
    const container = client.database(DATABASE).container(CONTAINER);

    const { resources } = await container.items.query({
      query: "SELECT c.id, c.login, c.name, c.avatarUrl, c.bio, c.location, c.lat, c.lng, c.followers, c.totalStars, c.totalForks, c.totalCommits, c.topLanguage, c.languages, c.publicRepos, c.topRepos, c.soReputation, c.soAnswers, c.soAcceptRate, c.soBadges, c.soUserId, c.claimed, c.claimedAt FROM c WHERE c.id = @id AND (NOT IS_DEFINED(c.nomination) OR c.nomination.status = 'approved')",
      parameters: [{ name: '@id', value: id }]
    }).fetchAll();

    if (resources.length === 0) {
      return NextResponse.json(
        { error: 'Developer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(resources[0], {
      headers: {
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=600',
      },
    });
  } catch (err) {
    console.error('Cosmos DB error:', err.message);
    // Fallback to sample data on connection errors
    const data = await getSampleData();
    const dev = data.find(d => d.login === id || d.id === id);
    if (!dev) {
      return NextResponse.json({ error: 'Developer not found' }, { status: 404 });
    }
    return NextResponse.json(dev);
  }
}