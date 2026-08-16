import { NextResponse } from 'next/server';
import { getSession } from '../../../../../lib/auth.js';
import { diffNewMatches } from '../../../../../lib/saved-search.js';
import { runSavedSearch } from '../../../../../lib/saved-search-run.js';
import { getSavedSearch, updateSavedSearch } from '../../../../../lib/saved-search-store.js';

export async function POST(request, { params }) {
  const session = await getSession();
  if (!session?.login) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await params;
  const search = await getSavedSearch(session.login, id);
  if (!search) return NextResponse.json({ error: 'Saved search not found' }, { status: 404 });

  try {
    const results = await runSavedSearch(search.criteria);
    const currentLogins = results.map(developer => developer.login);
    const { newLogins, updatedSeenLogins } = diffNewMatches(currentLogins, search.seenLogins);

    const updated = await updateSavedSearch(session.login, id, {
      seenLogins: updatedSeenLogins,
      lastRunAt: new Date().toISOString(),
    });

    return NextResponse.json({
      results,
      newMatches: results.filter(developer => newLogins.includes(developer.login)),
      lastRunAt: updated.lastRunAt,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Run saved search failed:', error.message);
    return NextResponse.json({ error: 'Unable to run saved search' }, { status: 500 });
  }
}
