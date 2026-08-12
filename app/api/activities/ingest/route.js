import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { ingestGlobalActivities } from '../../../../lib/global-activity-ingest.js';

function isAuthorized(request) {
  const expected = process.env.ACTIVITY_INGEST_SECRET;
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!expected || !provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await ingestGlobalActivities();
    console.info('Global activity ingestion', result);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Global activity ingestion failed:', error.message);
    return NextResponse.json({
      error: 'Activity ingestion failed',
      retryAfter: error.retryAfter || null,
    }, { status: error.status === 429 ? 429 : 502 });
  }
}