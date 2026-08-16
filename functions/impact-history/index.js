module.exports = async function impactHistory(context) {
  const endpoint = process.env.IMPACT_HISTORY_URL;
  const secret = process.env.CRON_SECRET;
  if (!endpoint || !secret) throw new Error('IMPACT_HISTORY_URL and CRON_SECRET are required');

  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const result = await response.json();
  context.log('DevGlobe impact history capture', {
    status: response.status,
    day: result.day,
    snapshots: result.snapshots,
    movements: result.movements,
    processed: result.processed,
    remaining: result.remaining,
    complete: result.complete,
  });
  if (!response.ok) throw new Error(`Impact history capture returned ${response.status}`);
};