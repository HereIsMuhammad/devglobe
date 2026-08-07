/**
 * Vercel Serverless Function — "Add me to DevGlobe" self-nomination
 *
 * Endpoint: POST /api/nominate
 * Body: { username: string, location?: string }
 *
 * Validates the GitHub username via the GitHub API and stores the
 * nomination in the Cosmos DB 'nominations' container for admin review.
 */
import { submitNomination } from './lib/nominate.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { username, location } = req.body || {};
  const result = await submitNomination({ username, location });
  res.status(result.status).json(result.body);
}
