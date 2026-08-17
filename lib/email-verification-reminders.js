import {
  createEmailVerification,
  isVerificationReminderDue,
  iterateVerificationReminderContacts,
  recordEmailVerificationReminder,
} from './developer-contact-store.js';
import { buildEmailVerificationEmail, sendLifecycleEmail } from './lifecycle-email.js';

export async function sendEmailVerificationReminders(options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const sentAt = now.toISOString();
  const dateKey = sentAt.slice(0, 10);
  const contacts = options.contacts || iterateVerificationReminderContacts({
    container: options.contactsContainer,
    now,
  });
  const createVerification = options.createVerification || (login => createEmailVerification(login, {
    container: options.contactsContainer,
    now,
  }));
  const sendEmail = options.sendEmail || sendLifecycleEmail;
  const recordDelivery = options.recordDelivery || ((login, delivery) => recordEmailVerificationReminder(login, delivery, {
    container: options.contactsContainer,
  }));
  const summary = { scanned: 0, eligible: 0, sent: 0, skipped: 0, failed: 0 };

  for await (const contact of contacts) {
    summary.scanned += 1;
    if (!isVerificationReminderDue(contact, now)) {
      summary.skipped += 1;
      continue;
    }
    summary.eligible += 1;

    try {
      const verification = await createVerification(contact.login);
      if (!verification.created) {
        summary.skipped += 1;
        continue;
      }
      const delivery = await sendEmail({
        to: verification.email,
        message: buildEmailVerificationEmail({
          login: contact.login,
          token: verification.token,
          reminder: true,
        }),
        idempotencyKey: `email-verification-reminder-${contact.id}-${dateKey}`,
      });
      if (!delivery.sent) {
        summary.failed += 1;
        continue;
      }
      await recordDelivery(contact.login, { sentAt, providerId: delivery.id || null });
      summary.sent += 1;
    } catch {
      summary.failed += 1;
    }
  }

  return summary;
}