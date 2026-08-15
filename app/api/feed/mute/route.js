import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth.js';
import { FEED_EVENT_TYPES } from '../../../../lib/feed.js';
import { MUTE_ENTITY_TYPES, muteEntity, muteEventType, unmuteEntity, unmuteEventType } from '../../../../lib/watchlist-store.js';

function parseMuteBody(body) {
  if (!body || typeof body !== 'object') return null;
  const { type, value } = body;
  if (type === 'eventType') {
    if (!FEED_EVENT_TYPES.includes(value)) return null;
    return { kind: 'eventType', value };
  }
  if (MUTE_ENTITY_TYPES.includes(type) && value) {
    return { kind: 'entity', type, value };
  }
  return null;
}

export async function POST(request) {
  const session = await getSession();
  if (!session?.login) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const parsed = parseMuteBody(await request.json().catch(() => null));
  if (!parsed) return NextResponse.json({ error: 'Invalid mute request' }, { status: 400 });

  try {
    const watchlist = parsed.kind === 'eventType'
      ? await muteEventType(session.login, parsed.value)
      : await muteEntity(session.login, parsed.type, parsed.value);
    return NextResponse.json({ mutes: watchlist.mutes });
  } catch (error) {
    console.error('Feed mute failed:', error.message);
    return NextResponse.json({ error: 'Unable to mute' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const session = await getSession();
  if (!session?.login) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const parsed = parseMuteBody(await request.json().catch(() => null));
  if (!parsed) return NextResponse.json({ error: 'Invalid unmute request' }, { status: 400 });

  try {
    const watchlist = parsed.kind === 'eventType'
      ? await unmuteEventType(session.login, parsed.value)
      : await unmuteEntity(session.login, parsed.type, parsed.value);
    return NextResponse.json({ mutes: watchlist.mutes });
  } catch (error) {
    console.error('Feed unmute failed:', error.message);
    return NextResponse.json({ error: 'Unable to unmute' }, { status: 500 });
  }
}
