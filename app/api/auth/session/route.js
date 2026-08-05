import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth.js';

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({
    user: {
      login: session.login,
      name: session.name,
      avatarUrl: session.avatarUrl,
    },
  });
}
