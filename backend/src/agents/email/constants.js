const EMAIL_CATEGORIES = [
  'IMPORTANT',
  'ACTION_REQUIRED',
  'PERSONAL',
  'NEWSLETTER',
  'PROMOTION',
  'SPAM',
  'UNKNOWN',
];

/** Categories shown in the default AI Inbox view (noise filtered out). */
const AI_INBOX_CATEGORIES = ['IMPORTANT', 'ACTION_REQUIRED'];

module.exports = {
  EMAIL_CATEGORIES,
  AI_INBOX_CATEGORIES,
};
