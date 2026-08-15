import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth.js';
import {
  createEmailVerification,
  verifyDeveloperContactEmail,
} from '../../../../lib/developer-contact-store.js';
import {
  buildEmailVerificationEmail,
  sendLifecycleEmail,
} from '../../../../lib/lifecycle-email.js';
import { getSiteUrl } from '../../../../lib/site.js';

export async function POST() {
  const session = await getSession();
  if (!session?.login) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const verification = await createEmailVerification(session.login);
    if (verification.reason === 'not_found') {
      return NextResponse.json({ error: 'No contact email is stored' }, { status: 404 });
    }
    if (verification.reason === 'already_verified') {
      return NextResponse.json({ ok: true, alreadyVerified: true });
    }
    if (!verification.created) {
      return NextResponse.json({ error: 'Email verification is unavailable' }, { status: 503 });
    }

    const delivery = await sendLifecycleEmail({
      to: verification.email,
      message: buildEmailVerificationEmail({
        login: session.login,
        token: verification.token,
      }),
      idempotencyKey: `email-verification-${session.login.toLowerCase()}-${Date.now()}`,
    });
    if (!delivery.sent) {
      return NextResponse.json({ error: 'Email delivery is unavailable' }, { status: 503 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Email verification request failed:', error.message);
    return NextResponse.json({ error: 'Could not send verification email' }, { status: 500 });
  }
}

export async function GET(request) {
  const login = request.nextUrl.searchParams.get('login');
  const token = request.nextUrl.searchParams.get('token');
  let status = 'invalid';

  try {
    const result = await verifyDeveloperContactEmail(login, token);
    if (result.verified) status = 'success';
  } catch (error) {
    console.error('Email verification failed:', error.message);
  }

  const destination = new URL('/', getSiteUrl());
  destination.searchParams.set('email_verification', status);
  return NextResponse.redirect(destination);
}