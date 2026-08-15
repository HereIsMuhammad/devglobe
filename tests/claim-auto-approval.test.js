import test from 'node:test';
import assert from 'node:assert/strict';
import { approvePendingNominationFromClaim } from '../lib/nominate.js';

test('authenticated ownership claim approves a pending nomination', () => {
  const submittedAt = '2026-08-15T10:00:00.000Z';
  const reviewedAt = '2026-08-16T10:00:00.000Z';
  const developer = {
    id: 'octocat',
    login: 'octocat',
    nomination: { status: 'pending', submittedAt, reviewedAt: null, reviewedBy: null },
  };

  const approved = approvePendingNominationFromClaim(developer, reviewedAt);

  assert.equal(approved.nomination.status, 'approved');
  assert.equal(approved.nomination.reviewedAt, reviewedAt);
  assert.equal(approved.nomination.reviewedBy, 'github-ownership-claim');
  assert.equal(approved.nomination.submittedAt, submittedAt);
  assert.equal(developer.nomination.status, 'pending');
});

test('ownership claim does not automatically approve rejected or public profiles', () => {
  assert.equal(approvePendingNominationFromClaim({ nomination: { status: 'rejected' } }), null);
  assert.equal(approvePendingNominationFromClaim({ nomination: { status: 'approved' } }), null);
  assert.equal(approvePendingNominationFromClaim({ login: 'legacy-profile' }), null);
});