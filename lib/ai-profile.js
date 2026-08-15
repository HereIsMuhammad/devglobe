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

const TOOL_IDS = new Set(AI_TOOLS.map(tool => tool.id));
const USAGE_LEVELS = new Set(AI_USAGE_LEVELS);
const VISIBILITIES = new Set(AI_PROFILE_VISIBILITIES);
const CONTACT_POLICIES = new Set(AI_CONTACT_POLICIES);

export class AiProfileValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AiProfileValidationError';
  }
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

  return {
    tools: [...toolsById.values()],
    acceptsAgentRequests,
    visibility: input.visibility,
    contactPolicy,
    updatedAt,
  };
}

export function getPublicAiProfile(aiProfile) {
  if (!aiProfile || aiProfile.visibility !== 'public') return null;

  try {
    return normalizeAiProfile(aiProfile, aiProfile.updatedAt);
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
