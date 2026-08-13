import { NextResponse } from 'next/server';
import { getSession } from '../../../lib/auth.js';
import { getCosmosContainer } from '../../../lib/cosmos.js';
import {
  AgentRequestValidationError,
  normalizeIntroductionDecision,
} from '../../../lib/agent-introductions.js';

function getContainer() {
  return getCosmosContainer(process.env.COSMOS_INTRODUCTIONS_CONTAINER || 'agent-introductions');
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const container = getContainer();
  if (!container) return NextResponse.json({ requests: [] }, { headers: { 'Cache-Control': 'no-store' } });

  try {
    const { resources } = await container.items.query({
      query: `SELECT c.id, c.developerLogin, c.requesterAgent, c.reason, c.project,
        c.status, c.createdAt, c.expiresAt, c.respondedAt
        FROM c
        WHERE c.developerLogin = @login
        ORDER BY c.createdAt DESC`,
      parameters: [{ name: '@login', value: session.login }],
    }, { partitionKey: session.login }).fetchAll();

    return NextResponse.json({ requests: resources }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Introduction inbox error:', error.message);
    return NextResponse.json({ error: 'Failed to load introduction requests' }, { status: 500 });
  }
}

export async function PATCH(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let decision;
  try {
    decision = normalizeIntroductionDecision(await request.json());
  } catch (error) {
    const message = error instanceof AgentRequestValidationError ? error.message : 'Invalid request body';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const container = getContainer();
  if (!container) return NextResponse.json({ error: 'Introduction requests are not configured' }, { status: 503 });

  try {
    const item = container.item(decision.id, session.login);
    const { resource } = await item.read();
    if (!resource || resource.developerLogin !== session.login) {
      return NextResponse.json({ error: 'Introduction request not found' }, { status: 404 });
    }
    if (resource.status !== 'pending' || resource.expiresAt <= new Date().toISOString()) {
      return NextResponse.json({ error: 'Introduction request can no longer be changed' }, { status: 409 });
    }

    const updated = {
      ...resource,
      status: decision.status,
      respondedAt: new Date().toISOString(),
    };
    await item.replace(updated);

    return NextResponse.json({
      request: {
        id: updated.id,
        status: updated.status,
        respondedAt: updated.respondedAt,
      },
    });
  } catch (error) {
    if (error.code === 404) return NextResponse.json({ error: 'Introduction request not found' }, { status: 404 });
    console.error('Introduction decision error:', error.message);
    return NextResponse.json({ error: 'Failed to update introduction request' }, { status: 500 });
  }
}
