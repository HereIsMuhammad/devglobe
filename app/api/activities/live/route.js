import { NextResponse } from 'next/server';
import { decodeActivityCursor, encodeActivityCursor, listActivities } from '../../../../lib/activity-store.js';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const requestedLimit = Number.parseInt(searchParams.get('limit') || '50', 10);
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50;
  const cursorValue = searchParams.get('cursor');
  const afterValue = searchParams.get('after');
  const cursor = decodeActivityCursor(cursorValue);
  const after = decodeActivityCursor(afterValue);

  if ((cursorValue && !cursor) || (afterValue && !after) || (cursor && after)) {
    return NextResponse.json({ error: 'Invalid activity cursor' }, { status: 400 });
  }

  try {
    const result = await listActivities({ limit, cursor, after });
    return NextResponse.json({
      ...result,
      afterCursor: encodeActivityCursor(result.activities[0]),
      sourceUpdatedAt: result.activities[0]?.ingestedAt || null,
      bestEffort: true,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=20' },
    });
  } catch (error) {
    console.error('Live activity query failed:', error.message);
    return NextResponse.json({ error: 'Unable to load live activity' }, { status: 503 });
  }
}