import { NextResponse } from 'next/server';
import { getSession } from '../../../lib/auth.js';
import { getCosmosContainer } from '../../../lib/cosmos.js';
import { aggregateProfileInsights, ENGAGEMENT_RETENTION_DAYS, isVerifiedProfileOwner } from '../../../lib/engagement.js';
import { getEngagementContainer, loadProfileEngagementEvents } from '../../../lib/engagement-store.js';

async function getDeveloper(container, login) {
  const { resources } = await container.items.query({
    query: 'SELECT TOP 1 c.id, c.login, c.claimed FROM c WHERE LOWER(c.login) = @login',
    parameters: [{ name: '@login', value: login.toLowerCase() }],
  }).fetchAll();
  return resources[0] || null;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.login) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const developerContainer = getCosmosContainer();
    const engagementContainer = getEngagementContainer();
    if (!developerContainer || !engagementContainer) {
      return NextResponse.json({ error: 'Profile insights are unavailable' }, { status: 503 });
    }
    const developer = await getDeveloper(developerContainer, session.login);
    if (!isVerifiedProfileOwner(session, developer)) {
      return NextResponse.json({ error: 'Claim your profile first' }, { status: 403 });
    }
    const now = new Date();
    const since = new Date(now.getTime() - ENGAGEMENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const events = await loadProfileEngagementEvents(engagementContainer, developer.login, since);
    return NextResponse.json(aggregateProfileInsights(events, { now }), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Profile insights read failed:', error.message);
    return NextResponse.json({ error: 'Unable to load profile insights' }, { status: 500 });
  }
}