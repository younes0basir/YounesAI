const { archiveEmail } = require('../integrations/gmail/actions');

async function archiveEmailTool({ userId, emailId }) {
  try {
    const result = await archiveEmail(userId, emailId, 'ai');
    return { success: true, ...result };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = archiveEmailTool;
