import { NextResponse } from 'next/server';
import {
  AgentRequestValidationError,
  authenticateAgent,
  createIntroductionDocument,
  normalizeIntroductionRequest,
  parseAgentKeys,
} from '../../../../lib/agent-introductions.js';
import { getPublicAiProfile } from '../../../../lib/ai-profile.js';
import { getCosmosContainer } from '../../../../lib/cosmos.js';

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function getRateLimit() {
  const configured = Number.parseInt(process.env.DEVGLOBE_AGENT_RATE_LIMIT || '10', 10);
  return Number.isFinite(configured) && configured > 0 ? Math.min(configured, 100) : 10;
}

function authenticateRequest(request) {
  const configuredKeys = parseAgentKeys(process.env.DEVGLOBE_AGENT_KEYS);
  return authenticateAgent(request.headers.get('authorization'), configuredKeys);
}

export async function GET(request) {
  let agent;
  try {
    agent = authenticateRequest(request);
  } catch (error) {
    console.error('Agent key configuration error:', error.message);
    return NextResponse.json({ error: 'Agent authentication is not configured' }, { status: 503 });
  }
  if (!agent) return NextResponse.json({ error: 'Invalid or missing agent credentials' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const developerLogin = searchParams.get('developerLogin');
  if (!/^[a-f\d-]{36}$/i.test(id || '') || !developerLogin) {
    return NextResponse.json({ error: 'Request id and developer login are required' }, { status: 400 });
  }

  const introductions = getCosmosContainer(process.env.COSMOS_INTRODUCTIONS_CONTAINER || 'agent-introductions');
  if (!introductions) return NextResponse.json({ error: 'Introduction requests are not configured' }, { status: 503 });

  try {
    const { resource } = await introductions.item(id, developerLogin).read();
    if (!resource || resource.agentId !== agent.id) {
      return NextResponse.json({ error: 'Introduction request not found' }, { status: 404 });
    }
    const expired = resource.status === 'pending' && resource.expiresAt <= new Date().toISOString();
    const status = expired ? 'expired' : resource.status;
    return NextResponse.json({
      request: {
        id: resource.id,
        developerLogin: resource.developerLogin,
        status,
        createdAt: resource.createdAt,
        expiresAt: resource.expiresAt,
        ...(status === 'accepted' && {
          contact: {
            type: 'github',
            url: `https://github.com/${encodeURIComponent(resource.developerLogin)}`,
          },
        }),
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error.code === 404) return NextResponse.json({ error: 'Introduction request not found' }, { status: 404 });
    console.error('Agent introduction status error:', error.message);
    return NextResponse.json({ error: 'Failed to load introduction request' }, { status: 500 });
  }
}

export async function POST(request) {
  let agent;
  try {
    agent = authenticateRequest(request);
  } catch (error) {
    console.error('Agent key configuration error:', error.message);
    return NextResponse.json({ error: 'Agent authentication is not configured' }, { status: 503 });
  }

  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent credentials' }, { status: 401 });
  }

  let input;
  try {
    input = normalizeIntroductionRequest(await request.json());
  } catch (error) {
    const message = error instanceof AgentRequestValidationError ? error.message : 'Invalid request body';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const developers = getCosmosContainer();
  const introductions = getCosmosContainer(process.env.COSMOS_INTRODUCTIONS_CONTAINER || 'agent-introductions');
  if (!developers || !introductions) {
    return NextResponse.json({ error: 'Introduction requests are not configured' }, { status: 503 });
  }

  try {
    const { resources: matches } = await developers.items.query({
      query: `SELECT TOP 1 c.login, c.aiProfile
        FROM c
        WHERE c.login = @login
          AND c.claimed = true
          AND (NOT IS_DEFINED(c.nomination) OR c.nomination.status = 'approved')`,
      parameters: [{ name: '@login', value: input.developerLogin }],
    }).fetchAll();
    const publicAiProfile = getPublicAiProfile(matches[0]?.aiProfile);
    if (!publicAiProfile?.acceptsAgentRequests || publicAiProfile.contactPolicy !== 'verified-agents') {
      return NextResponse.json({ error: 'Developer is not accepting verified agent requests' }, { status: 409 });
    }

    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { resources: counts } = await introductions.items.query({
      query: 'SELECT VALUE COUNT(1) FROM c WHERE c.agentId = @agentId AND c.createdAt >= @since',
      parameters: [
        { name: '@agentId', value: agent.id },
        { name: '@since', value: since },
      ],
    }).fetchAll();
    if ((counts[0] || 0) >= getRateLimit()) {
      return NextResponse.json({ error: 'Agent introduction rate limit exceeded' }, { status: 429 });
    }

    const document = createIntroductionDocument(input, agent);
    await introductions.items.create(document, { disableAutomaticIdGeneration: true });

    return NextResponse.json({
      request: {
        id: document.id,
        developerLogin: document.developerLogin,
        status: document.status,
        createdAt: document.createdAt,
        expiresAt: document.expiresAt,
      },
      message: 'The developer must approve this introduction before any further contact.',
    }, { status: 201 });
  } catch (error) {
    console.error('Agent introduction error:', error.message);
    return NextResponse.json({ error: 'Failed to create introduction request' }, { status: 500 });
  }
}
