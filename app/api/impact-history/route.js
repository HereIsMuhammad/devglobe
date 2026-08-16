import { NextResponse } from 'next/server';
import { getSession } from '../../../lib/auth.js';
import { getCosmosContainer } from '../../../lib/cosmos.js';
import { buildImpactHistory, canViewImpactHistory } from '../../../lib/impact-history.js';
import { listImpactSnapshots } from '../../../lib/impact-history-store.js';

async function findPublicDeveloper(login) {
  const container = getCosmosContainer();
  if (!container) return { login, claimed: false, impactHistoryVisibility: 'public' };
  const { resources } = await container.items.query({
    query: `SELECT TOP 1 c.id, c.login, c.location, c.claimed, c.impactHistoryVisibility
      FROM c WHERE LOWER(c.login) = @login
      AND (NOT IS_DEFINED(c.nomination) OR c.nomination.status = 'approved')`,
    parameters: [{ name: '@login', value: login.toLowerCase() }],
  }).fetchAll();
  return resources[0] || null;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const login = searchParams.get('login')?.trim();
  if (!login) return NextResponse.json({ error: 'login is required' }, { status: 400 });

  try {
    const [developer, session] = await Promise.all([findPublicDeveloper(login), getSession()]);
    if (!developer) return NextResponse.json({ error: 'Developer not found' }, { status: 404 });
    if (!canViewImpactHistory(developer, session?.login)) {
      return NextResponse.json({ error: 'Impact history is private' }, { status: 403 });
    }

    const snapshots = await listImpactSnapshots(developer.login, 121);
    const result = buildImpactHistory(snapshots);
    const ninetyDayCutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    result.history = result.history.filter(snapshot => Date.parse(snapshot.capturedAt) >= ninetyDayCutoff);
    return NextResponse.json({
      ...result,
      owner: Boolean(session?.login && session.login.toLowerCase() === developer.login.toLowerCase()),
      visibility: developer.impactHistoryVisibility === 'private' ? 'private' : 'public',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Impact history query failed:', error.message);
    return NextResponse.json({ error: 'Unable to load impact history' }, { status: 503 });
  }
}

export async function PUT(request) {
  const session = await getSession();
  if (!session?.login) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let visibility;
  try {
    visibility = (await request.json()).visibility;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (!['public', 'private'].includes(visibility)) {
    return NextResponse.json({ error: 'visibility must be public or private' }, { status: 400 });
  }

  try {
    const container = getCosmosContainer();
    if (!container) return NextResponse.json({ error: 'Cosmos DB is not configured' }, { status: 503 });
    const { resources } = await container.items.query({
      query: 'SELECT TOP 1 * FROM c WHERE LOWER(c.login) = @login AND c.claimed = true',
      parameters: [{ name: '@login', value: session.login.toLowerCase() }],
    }).fetchAll();
    const developer = resources[0];
    if (!developer) return NextResponse.json({ error: 'Claim your profile first' }, { status: 403 });

    await container.item(developer.id, developer.location).patch([
      { op: 'set', path: '/impactHistoryVisibility', value: visibility },
    ], { accessCondition: { type: 'IfMatch', condition: developer._etag } });
    return NextResponse.json({ visibility });
  } catch (error) {
    console.error('Impact history visibility update failed:', error.message);
    return NextResponse.json({ error: 'Unable to update impact history visibility' }, { status: 500 });
  }
}