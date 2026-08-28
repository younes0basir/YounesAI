const { Router } = require('express');

// Vercel Cron replaces node-cron on serverless deployments.
// Configure Vercel Cron Jobs to hit /api/cron: e.g. every 5 min, hourly, daily.
const router = Router();

const ENGINES = {
  reminders: ['runReminderWarningEngine', 'runReminderEngine'],
  tasks: ['runTaskDueNotificationEngine'],
  recurring: ['runRecurringTaskEngine', 'runRecurringEventEngine'],
  overdue: ['runOverdueTaskEngine'],
  gmail: ['runGmailSyncEngine'],
  all: [
    'runReminderWarningEngine',
    'runReminderEngine',
    'runTaskDueNotificationEngine',
    'runRecurringTaskEngine',
    'runRecurringEventEngine',
    'runOverdueTaskEngine',
    'runGmailSyncEngine',
  ],
};

router.post('/', async (req, res) => {
  const { job } = req.query;
  if (!job || !ENGINES[job]) {
    return res.status(400).json({ error: 'Unknown job', jobs: Object.keys(ENGINES) });
  }

  const scheduler = require('../scheduler');
  const results = [];
  for (const name of ENGINES[job]) {
    try {
      await scheduler[name]();
      results.push({ engine: name, ok: true });
    } catch (err) {
      results.push({ engine: name, ok: false, error: err.message });
    }
  }
  res.json({ job, results });
});

module.exports = router;
