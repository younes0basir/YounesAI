const EMAIL_CATEGORIES = [
  'IMPORTANT',
  'ACTION_REQUIRED',
  'PERSONAL',
  'NEWSLETTER',
  'PROMOTION',
  'SPAM',
  'UNKNOWN',
];

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/userinfo.email',
];

function getMaxAccountsPerUser() {
  return parseInt(process.env.GMAIL_MAX_ACCOUNTS_PER_USER || '2', 10);
}

function getSyncIntervalMinutes() {
  return parseInt(process.env.GMAIL_SYNC_INTERVAL_MINUTES || '5', 10);
}

module.exports = {
  EMAIL_CATEGORIES,
  GMAIL_SCOPES,
  getMaxAccountsPerUser,
  getSyncIntervalMinutes,
};
