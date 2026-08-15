import { NextResponse } from 'next/server';
import { setProductUpdatesPreference } from '../../../../lib/developer-contact-store.js';
import { verifyDigestPreferenceToken } from '../../../../lib/weekly-digest.js';
import { getSiteUrl } from '../../../../lib/site.js';

async function unsubscribe(request) {
  const login = request.nextUrl.searchParams.get('login');
  const token = request.nextUrl.searchParams.get('token');
  if (!verifyDigestPreferenceToken(login, token)) {
    return { ok: false, status: 400 };
  }

  const result = await setProductUpdatesPreference(login, false);
  if (!result.updated && result.reason !== 'not_found') {
    return { ok: false, status: 503 };
  }
  return { ok: true, status: 200 };
}

export async function GET(request) {
  const result = await unsubscribe(request);
  const destination = new URL('/', getSiteUrl());
  destination.searchParams.set('weekly_email', result.ok ? 'unsubscribed' : 'invalid');
  return NextResponse.redirect(destination);
}

export async function POST(request) {
  const result = await unsubscribe(request);
  return NextResponse.json(result.ok ? { ok: true } : { error: 'Unable to unsubscribe' }, {
    status: result.status,
  });
}