import { NextResponse } from 'next/server';
import { getSession } from '../../../lib/auth.js';
import { SavedSearchValidationError, normalizeSavedSearch } from '../../../lib/saved-search.js';
import { createSavedSearch, listSavedSearches } from '../../../lib/saved-search-store.js';

export async function GET() {
  const session = await getSession();
  if (!session?.login) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const searches = await listSavedSearches(session.login);
    return NextResponse.json({ searches }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('List saved searches failed:', error.message);
    return NextResponse.json({ error: 'Unable to load saved searches' }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getSession();
  if (!session?.login) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let normalized;
  try {
    normalized = normalizeSavedSearch(await request.json());
  } catch (error) {
    const message = error instanceof SavedSearchValidationError ? error.message : 'Invalid request body';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const search = await createSavedSearch(session.login, normalized);
    return NextResponse.json({ search }, { status: 201 });
  } catch (error) {
    const status = error.status || 500;
    console.error('Create saved search failed:', error.message);
    return NextResponse.json({ error: error.message || 'Unable to save search' }, { status });
  }
}
