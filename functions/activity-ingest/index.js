module.exports = async function activityIngest(context) {
  const endpoint = process.env.ACTIVITY_INGEST_URL;
  const secret = process.env.ACTIVITY_INGEST_SECRET;
  if (!endpoint || !secret) throw new Error('ACTIVITY_INGEST_URL and ACTIVITY_INGEST_SECRET are required');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
  });
  const result = await response.json();
  context.log('DevGlobe activity ingestion', {
    status: response.status,
    fetched: result.fetched,
    matched: result.matched,
    inserted: result.inserted,
    pollInterval: result.pollInterval,
    rateLimitRemaining: result.rateLimitRemaining,
  });
  if (!response.ok) throw new Error(`Activity ingestion returned ${response.status}`);
};