export const AI_TOOLS = [
  { id: 'github-copilot', name: 'GitHub Copilot' },
  { id: 'claude-code', name: 'Claude Code' },
  { id: 'cursor', name: 'Cursor' },
  { id: 'openai-codex', name: 'OpenAI Codex' },
  { id: 'gemini-cli', name: 'Gemini CLI' },
  { id: 'windsurf', name: 'Windsurf' },
  { id: 'custom-agent', name: 'Custom agent' },
];

export const AI_USAGE_LEVELS = ['experimenting', 'regular', 'daily'];
export const AI_PROFILE_VISIBILITIES = ['private', 'public'];
export const AI_CONTACT_POLICIES = ['nobody', 'verified-agents'];
export const OPPORTUNITY_TYPES = ['employment', 'contract', 'open-source', 'speaking', 'mentoring'];
export const OPPORTUNITY_WORK_MODES = ['remote', 'hybrid', 'onsite'];

const TOOL_IDS = new Set(AI_TOOLS.map(tool => tool.id));
const USAGE_LEVELS = new Set(AI_USAGE_LEVELS);
const VISIBILITIES = new Set(AI_PROFILE_VISIBILITIES);
const CONTACT_POLICIES = new Set(AI_CONTACT_POLICIES);
const OPPORTUNITY_TYPE_IDS = new Set(OPPORTUNITY_TYPES);
const OPPORTUNITY_WORK_MODE_IDS = new Set(OPPORTUNITY_WORK_MODES);
const MAX_OPPORTUNITY_DAYS = 90;

export class AiProfileValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AiProfileValidationError';
  }
}

function normalizeStringList(value, label) {
  if (!Array.isArray(value)) throw new AiProfileValidationError(`${label} must be an array`);
  if (value.length > 10) throw new AiProfileValidationError(`${label} can contain at most 10 values`);

  const normalized = new Map();
  for (const entry of value) {
    if (typeof entry !== 'string') throw new AiProfileValidationError(`${label} must contain text values`);
    const text = entry.trim();
    if (text.length < 2 || text.length > 60) {
      throw new AiProfileValidationError(`${label} values must be between 2 and 60 characters`);
    }
    normalized.set(text.toLowerCase(), text);
  }
  return [...normalized.values()];
}

function normalizeOpportunityPreferences(input, now) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new AiProfileValidationError('Opportunity preferences must be an object');
  }
  if (typeof input.enabled !== 'boolean') {
    throw new AiProfileValidationError('Open to opportunities preference must be a boolean');
  }
  if (!input.enabled) return { enabled: false };

  if (!Array.isArray(input.types) || input.types.length === 0 || input.types.some(type => !OPPORTUNITY_TYPE_IDS.has(type))) {
    throw new AiProfileValidationError('Choose at least one supported opportunity type');
  }
  if (!Array.isArray(input.workModes) || input.workModes.length === 0 || input.workModes.some(mode => !OPPORTUNITY_WORK_MODE_IDS.has(mode))) {
    throw new AiProfileValidationError('Choose at least one supported work mode');
  }

  const expiresAt = new Date(input.expiresAt);
  if (!input.expiresAt || Number.isNaN(expiresAt.getTime())) {
    throw new AiProfileValidationError('Opportunity expiry must be a valid date');
  }
  const maximumExpiry = new Date(now.getTime() + MAX_OPPORTUNITY_DAYS * 24 * 60 * 60 * 1000);
  if (expiresAt <= now || expiresAt > maximumExpiry) {
    throw new AiProfileValidationError('Opportunity expiry must be within the next 90 days');
  }

  return {
    enabled: true,
    types: [...new Set(input.types)],
    roles: normalizeStringList(input.roles, 'Desired roles'),
    locations: normalizeStringList(input.locations, 'Opportunity locations'),
    workModes: [...new Set(input.workModes)],
    expiresAt: expiresAt.toISOString(),
    source: 'self-declared',
  };
}

export function normalizeAiProfile(input, updatedAt = new Date().toISOString()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new AiProfileValidationError('AI profile must be an object');
  }

  if (!Array.isArray(input.tools)) {
    throw new AiProfileValidationError('Tools must be an array');
  }

  const toolsById = new Map();
  for (const tool of input.tools) {
    if (!tool || typeof tool !== 'object' || !TOOL_IDS.has(tool.id)) {
      throw new AiProfileValidationError('Unsupported AI tool');
    }
    if (!USAGE_LEVELS.has(tool.usage)) {
      throw new AiProfileValidationError('Unsupported AI tool usage level');
    }
    toolsById.set(tool.id, {
      id: tool.id,
      usage: tool.usage,
      source: 'self-declared',
    });
  }

  if (typeof input.acceptsAgentRequests !== 'boolean') {
    throw new AiProfileValidationError('Agent request preference must be a boolean');
  }
  if (!VISIBILITIES.has(input.visibility)) {
    throw new AiProfileValidationError('Unsupported AI profile visibility');
  }
  if (!CONTACT_POLICIES.has(input.contactPolicy)) {
    throw new AiProfileValidationError('Unsupported contact policy');
  }

  const acceptsAgentRequests = input.acceptsAgentRequests;
  const contactPolicy = acceptsAgentRequests ? input.contactPolicy : 'nobody';
  if (acceptsAgentRequests && contactPolicy === 'nobody') {
    throw new AiProfileValidationError('Choose a contact policy when accepting agent requests');
  }

  const profile = {
    tools: [...toolsById.values()],
    acceptsAgentRequests,
    visibility: input.visibility,
    contactPolicy,
    updatedAt,
  };
  if (Object.hasOwn(input, 'opportunityPreferences')) {
    profile.opportunityPreferences = normalizeOpportunityPreferences(input.opportunityPreferences, new Date(updatedAt));
    if (profile.opportunityPreferences.enabled
      && (!acceptsAgentRequests || input.visibility !== 'public' || contactPolicy !== 'verified-agents')) {
      throw new AiProfileValidationError('Open opportunities require a public profile and verified agent requests');
    }
  }
  return profile;
}

export function getActiveOpportunityPreferences(aiProfile, now = new Date()) {
  const preferences = aiProfile?.opportunityPreferences;
  if (!preferences?.enabled || !preferences.expiresAt) return null;
  return new Date(preferences.expiresAt) > now ? preferences : null;
}

export function getPublicAiProfile(aiProfile, now = new Date()) {
  if (!aiProfile || aiProfile.visibility !== 'public') return null;

  try {
    const normalized = normalizeAiProfile(aiProfile, aiProfile.updatedAt);
    if (!getActiveOpportunityPreferences(normalized, now)) delete normalized.opportunityPreferences;
    return normalized;
  } catch {
    return null;
  }
}

export function getPublicAiToolNames(aiProfile) {
  const profile = getPublicAiProfile(aiProfile);
  if (!profile) return [];
  const namesById = new Map(AI_TOOLS.map(tool => [tool.id, tool.name]));
  return profile.tools.map(tool => namesById.get(tool.id)).filter(Boolean);
}
