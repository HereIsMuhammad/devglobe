import { randomBytes } from 'node:crypto';
import { hashAgentToken } from '../lib/agent-introductions.js';

const values = Object.fromEntries(process.argv.slice(2).map(argument => {
  const [key, ...parts] = argument.replace(/^--/, '').split('=');
  return [key, parts.join('=')];
}));

if (!values.id || !values.name || !values.owner) {
  console.error('Usage: npm run create-agent-key -- --id=agent-id --name="Agent name" --owner="Owner"');
  process.exit(1);
}

const token = randomBytes(32).toString('base64url');
const key = {
  id: values.id,
  name: values.name,
  owner: values.owner,
  tokenHash: hashAgentToken(token),
};

console.log('Agent token (show once to the agent owner):');
console.log(token);
console.log('\nAdd this object to the DEVGLOBE_AGENT_KEYS JSON array:');
console.log(JSON.stringify(key, null, 2));
