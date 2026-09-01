const { EMAIL_CATEGORIES, AI_INBOX_CATEGORIES } = require('../agents/email/constants');
const { getMaxGmailAccounts } = require('../plans/config');

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/userinfo.email',
];

function getMaxAccountsPerUser(planTier) {
  if (planTier) {
    return getMaxGmailAccounts(planTier);
  }
  return parseInt(process.env.GMAIL_MAX_ACCOUNTS_PER_USER || '2', 10);
}

function getSyncIntervalMinutes() {
  return parseInt(process.env.GMAIL_SYNC_INTERVAL_MINUTES || '5', 10);
}

module.exports = {
  EMAIL_CATEGORIES,
  AI_INBOX_CATEGORIES,
  GMAIL_SCOPES,
  getMaxAccountsPerUser,
  getSyncIntervalMinutes,
};
