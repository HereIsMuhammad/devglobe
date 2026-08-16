import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth.js';
import { ALERT_FREQUENCIES } from '../../../../lib/saved-search.js';
import { deleteSavedSearch, getSavedSearch, updateSavedSearch } from '../../../../lib/saved-search-store.js';

export async function PATCH(request, { params }) {
  const session = await getSession();
  if (!session?.login) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await params;
  const existing = await getSavedSearch(session.login, id);
  if (!existing) return NextResponse.json({ error: 'Saved search not found' }, { status: 404 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const patch = {};
  if (typeof body.name === 'string') {
    const name = body.name.trim().slice(0, 80);
    if (!name) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 });
    patch.name = name;
  }
  if (body.alert) {
    if (!ALERT_FREQUENCIES.includes(body.alert.frequency)) {
      return NextResponse.json({ error: 'Invalid alert frequency' }, { status: 400 });
    }
    patch.alert = { frequency: body.alert.frequency, enabled: body.alert.frequency !== 'off' };
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  try {
    const search = await updateSavedSearch(session.login, id, patch);
    return NextResponse.json({ search });
  } catch (error) {
    console.error('Update saved search failed:', error.message);
    return NextResponse.json({ error: 'Unable to update saved search' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const session = await getSession();
  if (!session?.login) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await params;
  try {
    const deleted = await deleteSavedSearch(session.login, id);
    if (!deleted) return NextResponse.json({ error: 'Saved search not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Delete saved search failed:', error.message);
    return NextResponse.json({ error: 'Unable to delete saved search' }, { status: 500 });
  }
}
