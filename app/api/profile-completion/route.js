import { NextResponse } from 'next/server';
import { getSession } from '../../../lib/auth.js';
import { getCosmosContainer } from '../../../lib/cosmos.js';
import { calculateProfileCompletion } from '../../../lib/profile-completion.js';

async function getClaimedDeveloper(container, login) {
  const { resources } = await container.items.query({
    query: 'SELECT TOP 1 * FROM c WHERE LOWER(c.login) = @login AND c.claimed = true',
    parameters: [{ name: '@login', value: login.toLowerCase() }],
  }).fetchAll();
  return resources[0] || null;
}

function responseFor(developer) {
  return {
    ...calculateProfileCompletion({
      developer,
      cardGenerated: Boolean(developer.profileChecklist?.cardGeneratedAt),
    }),
    dismissed: Boolean(developer.profileChecklist?.dismissedAt),
  };
}

async function loadOwner() {
  const session = await getSession();
  if (!session?.login) return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };

  const container = getCosmosContainer();
  if (!container) return { error: NextResponse.json({ error: 'Profile completion is unavailable' }, { status: 503 }) };

  const developer = await getClaimedDeveloper(container, session.login);
  if (!developer) return { error: NextResponse.json({ error: 'Claim your profile first' }, { status: 403 }) };
  return { container, developer };
}

async function updateChecklist(container, developer, changes) {
  const profileChecklist = { ...developer.profileChecklist, ...changes };
  for (const [key, value] of Object.entries(profileChecklist)) {
    if (value == null) delete profileChecklist[key];
  }
  await container.item(developer.id, developer.location).patch([
    { op: 'set', path: '/profileChecklist', value: profileChecklist },
  ], {
    accessCondition: { type: 'IfMatch', condition: developer._etag },
  });
  return { ...developer, profileChecklist };
}

export async function GET() {
  try {
    const owner = await loadOwner();
    if (owner.error) return owner.error;
    return NextResponse.json(responseFor(owner.developer), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Profile completion read failed:', error.message);
    return NextResponse.json({ error: 'Unable to load profile completion' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (body.action !== 'generated-card') {
      return NextResponse.json({ error: 'Unsupported completion action' }, { status: 400 });
    }
    const owner = await loadOwner();
    if (owner.error) return owner.error;
    const developer = await updateChecklist(owner.container, owner.developer, {
      cardGeneratedAt: owner.developer.profileChecklist?.cardGeneratedAt || new Date().toISOString(),
    });
    return NextResponse.json(responseFor(developer));
  } catch (error) {
    console.error('Profile completion action failed:', error.message);
    return NextResponse.json({ error: 'Unable to update profile completion' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    if (typeof body.dismissed !== 'boolean') {
      return NextResponse.json({ error: 'dismissed must be a boolean' }, { status: 400 });
    }
    const owner = await loadOwner();
    if (owner.error) return owner.error;
    const developer = await updateChecklist(owner.container, owner.developer, {
      dismissedAt: body.dismissed ? new Date().toISOString() : null,
    });
    return NextResponse.json(responseFor(developer));
  } catch (error) {
    console.error('Profile completion preference failed:', error.message);
    return NextResponse.json({ error: 'Unable to update profile completion preference' }, { status: 500 });
  }
}