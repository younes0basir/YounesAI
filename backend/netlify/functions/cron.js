// Netlify Scheduled Function.
// Schedule is set in netlify.toml via  [functions."cron"]  schedule = "@hourly"
// (swap in a cron expression like "0 * * * *" or "@daily" as needed).
// Runs the background engines that previously fired via node-cron on a long-
// running server.

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const ENGINES = [
  'runReminderWarningEngine',
  'runReminderEngine',
  'runTaskDueNotificationEngine',
  'runRecurringTaskEngine',
  'runRecurringEventEngine',
  'runOverdueTaskEngine',
  'runGmailSyncEngine',
];

exports.handler = async (event) => {
  const requestedJob = event?.queryStringParameters?.job;
  const scheduler = require('../../src/scheduler');

  // Allow a specific engine to be selected, otherwise run all.
  const names = requestedJob && scheduler[requestedJob]
    ? [requestedJob]
    : ENGINES;

  const results = [];
  for (const name of names) {
    try {
      await scheduler[name]();
      results.push({ engine: name, ok: true });
    } catch (err) {
      results.push({ engine: name, ok: false, error: err.message });
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ job: requestedJob || 'all', results }),
  };
};