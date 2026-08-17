import { NextResponse } from 'next/server';
import { sendEmailVerificationReminders } from '../../../../lib/email-verification-reminders.js';

export const maxDuration = 300;

export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const summary = await sendEmailVerificationReminders();
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error('Email verification reminders failed:', error.message);
    return NextResponse.json({ error: 'Email verification reminders failed' }, { status: 500 });
  }
}