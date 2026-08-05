import { NextResponse } from 'next/server';
import { buildLogoutCookie } from '../../../../lib/auth.js';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(buildLogoutCookie());
  return response;
}
