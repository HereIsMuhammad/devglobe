import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getCosmosContainer } from '../../../../lib/cosmos.js';

async function getSampleCount() {
  const filePath = path.join(process.cwd(), 'data', 'developers-sample.json');
  const developers = JSON.parse(await fs.readFile(filePath, 'utf-8'));
  return developers.length;
}

export async function GET() {
  const container = getCosmosContainer();

  if (container) {
    try {
      const { resources } = await container.items.query(
        "SELECT VALUE COUNT(1) FROM c WHERE NOT IS_DEFINED(c.nomination) OR c.nomination.status = 'approved'"
      ).fetchAll();

      return NextResponse.json({ count: resources[0] || 0 }, {
        headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' },
      });
    } catch (error) {
      console.error('Cosmos DB count error:', error.message);
    }
  }

  return NextResponse.json({ count: await getSampleCount() }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}