import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { FeedValidationError } from '../../../../lib/feed.js';
import { saveFeedEvents } from '../../../../lib/feed-store.js';

function isAuthorized(request) {
  const expected = process.env.FEED_INGEST_SECRET;
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

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!Array.isArray(body.events)) {
    return NextResponse.json({ error: 'events array is required' }, { status: 400 });
  }

  try {
    const result = await saveFeedEvents(body.events, { isPublicDeveloper: body.isPublicDeveloper !== false });
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof FeedValidationError ? 400 : 500;
    console.error('Feed ingestion failed:', error.message);
    return NextResponse.json({ error: error.message || 'Feed ingestion failed' }, { status });
  }
}
