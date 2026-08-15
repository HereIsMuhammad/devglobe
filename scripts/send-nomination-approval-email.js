import dotenv from 'dotenv';
import { findDeveloperByLogin, getDevelopersContainer, normalizeUsername } from '../lib/nominate.js';
import { getDeveloperContact } from '../lib/developer-contact-store.js';
import { buildNominationApprovedEmail, sendLifecycleEmail } from '../lib/lifecycle-email.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

async function sendApprovalEmail(container, rawLogin) {
  const login = normalizeUsername(rawLogin);
  if (!login) throw new Error('A GitHub login is required.');

  const developer = await findDeveloperByLogin(container, login);
  if (!developer?.nomination) throw new Error(`"${login}" is not a nomination.`);
  if (developer.nomination.status !== 'approved') throw new Error(`"${login}" is not approved.`);

  const contact = await getDeveloperContact(developer.login);
  if (!contact?.transactionalEmailsEnabled) {
    throw new Error(`"${login}" has no opted-in transactional contact.`);
  }

  const delivery = await sendLifecycleEmail({
    to: contact.email,
    message: buildNominationApprovedEmail({ login: developer.login, name: developer.name }),
    idempotencyKey: `nomination-approved-${developer.login.toLowerCase()}-${Date.parse(developer.nomination.submittedAt)}`,
  });

  if (!delivery.sent) throw new Error(`Email not sent: ${delivery.reason}.`);
  console.log(`✓ ${developer.login}: approval email accepted (message ${delivery.id || 'unknown'}).`);
}

async function main() {
  const logins = process.argv.slice(2);
  if (logins.length === 0) {
    console.error('Usage: node scripts/send-nomination-approval-email.js <login> [login...]');
    process.exit(1);
  }

  const container = await getDevelopersContainer();
  let failed = false;
  for (const login of logins) {
    try {
      await sendApprovalEmail(container, login);
    } catch (error) {
      failed = true;
      console.error(`✗ ${login}: ${error.message}`);
    }
  }
  if (failed) process.exit(1);
}

main().catch(error => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});