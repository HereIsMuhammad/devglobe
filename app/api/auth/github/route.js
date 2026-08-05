import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;

function getBaseUrl(hdrs) {
  const host = hdrs.get('x-forwarded-host') || hdrs.get('host') || 'localhost:3000';
  const proto = hdrs.get('x-forwarded-proto') || 'http';
  return `${proto}://${host}`;
}

export async function GET() {
  if (!GITHUB_CLIENT_ID) {
    return NextResponse.json(
      { error: 'GitHub OAuth is not configured' },
      { status: 503 }
    );
  }

  const hdrs = await headers();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || getBaseUrl(hdrs);

  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    scope: 'read:user user:email',
    redirect_uri: `${baseUrl}/api/auth/callback`,
  });

  return NextResponse.redirect(
    `https://github.com/login/oauth/authorize?${params.toString()}`
  );
}
