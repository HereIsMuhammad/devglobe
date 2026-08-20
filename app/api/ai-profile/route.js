import { CosmosClient } from '@azure/cosmos';
import { NextResponse } from 'next/server';
import { getSession } from '../../../lib/auth.js';
import {
  AI_CONTACT_POLICIES,
  AI_PROFILE_VISIBILITIES,
  AI_TOOLS,
  AI_USAGE_LEVELS,
  OPPORTUNITY_TYPES,
  OPPORTUNITY_WORK_MODES,
  AiProfileValidationError,
  normalizeAiProfile,
} from '../../../lib/ai-profile.js';

const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT;
const COSMOS_KEY = process.env.COSMOS_KEY;
const DATABASE = process.env.COSMOS_DATABASE || 'devglobe';
const CONTAINER = process.env.COSMOS_CONTAINER || 'developers';

const DEFAULT_PROFILE = {
  tools: [],
  acceptsAgentRequests: false,
  visibility: 'private',
  contactPolicy: 'nobody',
  opportunityPreferences: { enabled: false },
};

function settingsResponse(profile, options) {
  return NextResponse.json({
    profile: profile || DEFAULT_PROFILE,
    options: {
      tools: AI_TOOLS,
      usageLevels: AI_USAGE_LEVELS,
      visibilities: AI_PROFILE_VISIBILITIES,
      contactPolicies: AI_CONTACT_POLICIES,
      opportunityTypes: OPPORTUNITY_TYPES,
      opportunityWorkModes: OPPORTUNITY_WORK_MODES,
    },
  }, options);
}

async function getClaimedDeveloper(container, login) {
  const { resources } = await container.items.query({
    query: 'SELECT TOP 1 * FROM c WHERE c.login = @login AND c.claimed = true',
    parameters: [{ name: '@login', value: login }],
  }).fetchAll();
  return resources[0] || null;
}

function getContainer() {
  const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY });
  return client.database(DATABASE).container(CONTAINER);
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  if (!COSMOS_ENDPOINT || !COSMOS_KEY) {
    return settingsResponse(DEFAULT_PROFILE, { headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const developer = await getClaimedDeveloper(getContainer(), session.login);
    if (!developer) {
      return NextResponse.json({ error: 'Claim your profile before editing AI settings' }, { status: 403 });
    }
    return settingsResponse(developer.aiProfile, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('AI profile read error:', error.message);
    return NextResponse.json({ error: 'Failed to load AI settings' }, { status: 500 });
  }
}

export async function PUT(request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let profile;
  try {
    const body = await request.json();
    profile = normalizeAiProfile(body.profile);
  } catch (error) {
    const message = error instanceof AiProfileValidationError ? error.message : 'Invalid request body';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!COSMOS_ENDPOINT || !COSMOS_KEY) {
    return NextResponse.json(
      { error: 'AI settings require a configured Cosmos DB connection' },
      { status: 503 }
    );
  }

  try {
    const container = getContainer();
    const developer = await getClaimedDeveloper(container, session.login);
    if (!developer) {
      return NextResponse.json({ error: 'Claim your profile before editing AI settings' }, { status: 403 });
    }

    developer.aiProfile = profile;
    await container.items.upsert(developer);
    return settingsResponse(profile, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('AI profile update error:', error.message);
    return NextResponse.json({ error: 'Failed to save AI settings' }, { status: 500 });
  }
}
