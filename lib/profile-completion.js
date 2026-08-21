export const PROFILE_COMPLETION_STEPS = [
  { id: 'claim', label: 'Claim your profile', action: 'claim' },
  { id: 'review', label: 'Review imported data', action: 'profile' },
  { id: 'preferences', label: 'Add interests and availability', action: 'ai-profile' },
  { id: 'repositories', label: 'Feature repositories', action: 'repositories' },
  { id: 'card', label: 'Generate an identity card', action: 'card' },
];

export function calculateProfileCompletion({ developer, cardGenerated = false } = {}) {
  const claimed = developer?.claimed === true;
  const aiProfile = developer?.aiProfile;
  const opportunity = aiProfile?.opportunityPreferences;
  const completion = {
    claim: claimed,
    review: claimed && Boolean(developer?.metricsUpdatedAt),
    preferences: claimed && Boolean(
      aiProfile?.tools?.length
      || aiProfile?.acceptsAgentRequests
      || opportunity?.enabled
    ),
    repositories: claimed && Boolean(developer?.topRepos?.length),
    card: claimed && cardGenerated === true,
  };
  const steps = PROFILE_COMPLETION_STEPS.map(step => ({
    ...step,
    complete: completion[step.id],
  }));
  const completed = steps.filter(step => step.complete).length;

  return {
    steps,
    completed,
    total: steps.length,
    percent: Math.round((completed / steps.length) * 100),
    complete: completed === steps.length,
  };
}