import { CosmosClient } from '@azure/cosmos';
import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth.js';
import { promises as fs } from 'fs';
import path from 'path';

const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT;
const COSMOS_KEY = process.env.COSMOS_KEY;
const DATABASE = process.env.COSMOS_DATABASE || 'devglobe';
const CONTAINER = process.env.COSMOS_CONTAINER || 'developers';

export async function POST() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const login = session.login;

  // If Cosmos DB is configured, update the developer record
  if (COSMOS_ENDPOINT && COSMOS_KEY) {
    try {
      const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY });
      const container = client.database(DATABASE).container(CONTAINER);

      // Find developer by login
      const { resources } = await container.items.query({
        query: 'SELECT * FROM c WHERE c.login = @login',
        parameters: [{ name: '@login', value: login }],
      }).fetchAll();

      if (resources.length === 0) {
        return NextResponse.json(
          { error: 'No developer profile found matching your GitHub login' },
          { status: 404 }
        );
      }

      const dev = resources[0];

      // Mark as claimed
      dev.claimed = true;
      dev.claimedAt = new Date().toISOString();
      dev.claimedBy = login;

      await container.items.upsert(dev);

      return NextResponse.json({
        ok: true,
        login,
        claimedAt: dev.claimedAt,
      });
    } catch (err) {
      console.error('Claim error:', err);
      return NextResponse.json({ error: 'Failed to claim profile' }, { status: 500 });
    }
  }

  // Fallback: check sample data for match (no persistence in dev mode)
  const filePath = path.join(process.cwd(), 'data', 'developers-sample.json');
  const raw = await fs.readFile(filePath, 'utf-8');
  const data = JSON.parse(raw);
  const dev = data.find(d => d.login === login);

  if (!dev) {
    return NextResponse.json(
      { error: 'No developer profile found matching your GitHub login' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    login,
    claimedAt: new Date().toISOString(),
    note: 'Claim recorded (dev mode — not persisted without Cosmos DB)',
  });
}
