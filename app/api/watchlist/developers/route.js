import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth.js';
import {
  followEntity,
  getWatchlist,
  normalizeDeveloperFollow,
  unfollowEntity,
} from '../../../../lib/watchlist-store.js';

export async function GET() {
  const session = await getSession();
  if (!session?.login) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const watchlist = await getWatchlist(session.login);
    return NextResponse.json(
      { developers: watchlist.follows.developers },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('Developer watchlist query failed:', error.message);
    return NextResponse.json({ error: 'Unable to load followed developers' }, { status: 503 });
  }
}

async function updateFollow(request, remove) {
  const session = await getSession();
  if (!session?.login) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let login;
  try {
    const body = await request.json();
    login = normalizeDeveloperFollow(body.login);
    const watchlist = remove
      ? await unfollowEntity(session.login, 'developers', login)
      : await followEntity(session.login, 'developers', login);
    return NextResponse.json({ developers: watchlist.follows.developers });
  } catch (error) {
    const validationError = /Invalid GitHub login|own profile|follow limit/.test(error.message);
    if (!validationError) console.error('Developer watchlist update failed:', error.message);
    return NextResponse.json(
      { error: validationError ? error.message : 'Unable to update followed developers' },
      { status: validationError ? 400 : 500 },
    );
  }
}

export async function POST(request) {
  return updateFollow(request, false);
}

export async function DELETE(request) {
  return updateFollow(request, true);
}