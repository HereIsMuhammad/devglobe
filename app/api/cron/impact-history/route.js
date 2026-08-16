import { NextResponse } from 'next/server';
import { captureImpactHistory } from '../../../../lib/impact-history-capture.js';

export const maxDuration = 300;

export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    return NextResponse.json({ ok: true, ...await captureImpactHistory() });
  } catch (error) {
    console.error('Impact history capture failed:', error.message);
    return NextResponse.json({ error: 'Impact history capture failed' }, { status: 500 });
  }
}