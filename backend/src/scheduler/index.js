const cron = require('node-cron');
const pool = require('../db');

// ─────────────────────────────────────────────────────────────────────────────
// REMINDER WARNING ENGINE — every minute
// Creates voice-warning notifications for reminders approaching their trigger time.
// ─────────────────────────────────────────────────────────────────────────────
async function runReminderWarningEngine() {
  try {
    const result = await pool.query(
      `SELECT r.id, r.user_id, r.title, r.message, r.trigger_at, r.warn_minutes_before
       FROM reminders r
       WHERE r.trigger_at > NOW()
         AND r.trigger_at - (COALESCE(r.warn_minutes_before, 5) * INTERVAL '1 minute') <= NOW()
         AND r.is_read = FALSE
         AND r.dismissed_at IS NULL
         AND (r.snoozed_until IS NULL OR r.snoozed_until <= NOW())
         AND NOT EXISTS (
           SELECT 1 FROM notifications n
           WHERE n.entity_id = r.id
             AND n.type = 'reminder_warning'
         )
       LIMIT 50`
    );

    if (result.rowCount === 0) return;
    console.log(`[Scheduler/Warnings] Processing ${result.rowCount} reminder warning(s)...`);

    for (const reminder of result.rows) {
      try {
        const minsUntilTrigger = Math.round(
          (new Date(reminder.trigger_at) - new Date()) / 60000
        );
        const body = minsUntilTrigger > 0
          ? `"${reminder.title}" is due in ${minsUntilTrigger} minute${minsUntilTrigger === 1 ? '' : 's'}`
          : `"${reminder.title}" is due now`;

        await pool.query(
          `INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id)
           VALUES ($1, 'reminder_warning', $2, $3, 'reminder', $4)
           ON CONFLICT DO NOTHING`,
          [reminder.user_id, reminder.title, body, reminder.id]
        );

        console.log(`[Scheduler/Warnings] Warning created: "${reminder.title}" → user ${reminder.user_id} (${minsUntilTrigger} min before)`);
      } catch (err) {
        console.error(`[Scheduler/Warnings] Failed for reminder ${reminder.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[Scheduler/Warnings] Engine error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REMINDER ENGINE — every minute
// Finds due reminders and creates ring notifications.
// ─────────────────────────────────────────────────────────────────────────────
async function runReminderEngine() {
  try {
    const result = await pool.query(
      `SELECT r.id, r.user_id, r.title, r.message, r.task_id, r.event_id
       FROM reminders r
       WHERE r.trigger_at <= NOW()
         AND r.is_read = FALSE
         AND r.dismissed_at IS NULL
         AND (r.snoozed_until IS NULL OR r.snoozed_until <= NOW())
       LIMIT 50`
    );

    if (result.rowCount === 0) return;
    console.log(`[Scheduler/Reminders] Processing ${result.rowCount} due reminder(s)...`);

    for (const reminder of result.rows) {
      try {
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id)
           VALUES ($1, 'reminder_due', $2, $3, 'reminder', $4)
           ON CONFLICT DO NOTHING`,
          [
            reminder.user_id,
            reminder.title,
            reminder.message || 'Reminder is due',
            reminder.id,
          ]
        );

        await pool.query(
          `UPDATE reminders SET is_read = TRUE WHERE id = $1`,
          [reminder.id]
        );

        console.log(`[Scheduler/Reminders] Ring delivered: "${reminder.title}" → user ${reminder.user_id}`);
      } catch (err) {
        console.error(`[Scheduler/Reminders] Failed to deliver reminder ${reminder.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[Scheduler/Reminders] Engine error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TASK DUE NOTIFICATION ENGINE — every 15 minutes
// Notifies users of tasks due within the next hour.
// ─────────────────────────────────────────────────────────────────────────────
async function runTaskDueNotificationEngine() {
  try {
    const result = await pool.query(
      `SELECT t.id, t.user_id, t.title, t.due_at
       FROM tasks t
       WHERE t.due_at BETWEEN NOW() AND NOW() + INTERVAL '1 hour'
         AND t.status IN ('pending', 'in_progress')
         AND t.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM notifications n
           WHERE n.entity_id = t.id
             AND n.type = 'task_due'
             AND n.created_at > NOW() - INTERVAL '2 hours'
         )
       LIMIT 50`
    );

    if (result.rowCount === 0) return;
    console.log(`[Scheduler/TaskDue] Sending ${result.rowCount} task-due notification(s)...`);

    for (const task of result.rows) {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id)
         VALUES ($1, 'task_due', $2, $3, 'task', $4)`,
        [
          task.user_id,
          `Task Due Soon: ${task.title}`,
          `"${task.title}" is due at ${new Date(task.due_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
          task.id,
        ]
      ).catch(() => {}); // idempotent — ignore duplicate key errors
    }
  } catch (err) {
    console.error('[Scheduler/TaskDue] Engine error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERDUE TASK ENGINE — daily at 08:00
// Notifies users of tasks that are overdue and still incomplete.
// ─────────────────────────────────────────────────────────────────────────────
async function runOverdueTaskEngine() {
  try {
    const result = await pool.query(
      `SELECT t.id, t.user_id, t.title, t.due_at
       FROM tasks t
       WHERE t.due_at < NOW()
         AND t.status IN ('pending', 'in_progress')
         AND t.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM notifications n
           WHERE n.entity_id = t.id
             AND n.type = 'task_overdue'
             AND n.created_at > NOW() - INTERVAL '24 hours'
         )
       LIMIT 100`
    );

    if (result.rowCount === 0) return;
    console.log(`[Scheduler/Overdue] Processing ${result.rowCount} overdue task(s)...`);

    for (const task of result.rows) {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id)
         VALUES ($1, 'task_overdue', $2, $3, 'task', $4)`,
        [
          task.user_id,
          `Overdue: ${task.title}`,
          `"${task.title}" was due ${new Date(task.due_at).toLocaleDateString('en-GB')} and is still incomplete`,
          task.id,
        ]
      ).catch(() => {});
    }
  } catch (err) {
    console.error('[Scheduler/Overdue] Engine error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RECURRING TASK ENGINE — every hour
// Creates the next occurrence for completed recurring tasks.
// ─────────────────────────────────────────────────────────────────────────────
async function runRecurringTaskEngine() {
  try {
    const result = await pool.query(
      `SELECT id, user_id, title, description, priority, recurrence_rule, recurrence_interval
       FROM tasks
       WHERE recurrence_rule IS NOT NULL
         AND status = 'done'
         AND (next_run_at IS NULL OR next_run_at <= NOW())
         AND deleted_at IS NULL
       LIMIT 20`
    );

    if (result.rowCount === 0) return;
    console.log(`[Scheduler/Recurring] Creating ${result.rowCount} recurring task occurrence(s)...`);

    for (const task of result.rows) {
      try {
        const nextDue = computeNextRun(task.recurrence_rule, task.recurrence_interval || 1);
        if (!nextDue) continue;

        // Create the next occurrence
        await pool.query(
          `INSERT INTO tasks
             (user_id, title, description, priority, due_at,
              recurrence_rule, recurrence_interval, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
          [
            task.user_id,
            task.title,
            task.description,
            task.priority,
            nextDue.toISOString(),
            task.recurrence_rule,
            task.recurrence_interval,
          ]
        );

        // Stamp the next_run_at on the completed original
        await pool.query(
          `UPDATE tasks SET next_run_at = $1 WHERE id = $2`,
          [nextDue.toISOString(), task.id]
        );

        console.log(`[Scheduler/Recurring] Created next "${task.title}" due ${nextDue.toISOString()}`);
      } catch (err) {
        console.error(`[Scheduler/Recurring] Failed for task ${task.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[Scheduler/Recurring] Engine error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RECURRING EVENT ENGINE — every hour
// Creates the next occurrence for recurring calendar events.
// ─────────────────────────────────────────────────────────────────────────────
async function runRecurringEventEngine() {
  try {
    const result = await pool.query(
      `SELECT id, user_id, title, description, recurrence_rule,
              starts_at, ends_at, is_all_day, color, location_text
       FROM calendar_events
       WHERE recurrence_rule IS NOT NULL
         AND ends_at < NOW()
         AND (next_run_at IS NULL OR next_run_at <= NOW())
       LIMIT 20`
    );

    if (result.rowCount === 0) return;

    for (const event of result.rows) {
      try {
        const duration = new Date(event.ends_at) - new Date(event.starts_at);
        const nextStart = computeNextRun(event.recurrence_rule, 1, new Date(event.starts_at));
        if (!nextStart) continue;
        const nextEnd = new Date(nextStart.getTime() + duration);

        await pool.query(
          `INSERT INTO calendar_events
             (user_id, title, description, starts_at, ends_at,
              is_all_day, color, location_text, recurrence_rule)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            event.user_id,
            event.title,
            event.description,
            nextStart.toISOString(),
            nextEnd.toISOString(),
            event.is_all_day,
            event.color,
            event.location_text,
            event.recurrence_rule,
          ]
        );

        await pool.query(
          `UPDATE calendar_events SET next_run_at = $1 WHERE id = $2`,
          [nextStart.toISOString(), event.id]
        );

        console.log(`[Scheduler/RecurringEvent] Created next "${event.title}" at ${nextStart.toISOString()}`);
      } catch (err) {
        console.error(`[Scheduler/RecurringEvent] Failed for event ${event.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[Scheduler/RecurringEvent] Engine error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function computeNextRun(rule, interval = 1, from = new Date()) {
  const base = new Date(from);
  switch (rule) {
    case 'daily':
      base.setDate(base.getDate() + interval);
      return base;
    case 'weekly':
      base.setDate(base.getDate() + interval * 7);
      return base;
    case 'monthly':
      base.setMonth(base.getMonth() + interval);
      return base;
    default:
      console.warn(`[Scheduler] Unknown recurrence rule: "${rule}"`);
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GMAIL SYNC ENGINE — every N minutes
// ─────────────────────────────────────────────────────────────────────────────
async function runGmailSyncEngine() {
  try {
    const { syncAllAccounts } = require('../integrations/gmail/sync');
    const outcomes = await syncAllAccounts();
    const synced = outcomes.filter((o) => o.success).length;
    if (synced > 0) {
      console.log(`[Scheduler/Gmail] Synced ${synced} account(s)`);
    }
  } catch (err) {
    console.error('[Scheduler/Gmail] Engine error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOTSTRAP
// ─────────────────────────────────────────────────────────────────────────────
function startScheduler() {
  console.log('[Scheduler] Starting background jobs...');

  // Reminder warning — every minute (before delivery)
  cron.schedule('* * * * *', () => {
    runReminderWarningEngine().catch(err => console.error('[Scheduler] Uncaught in reminder-warning engine:', err.message));
  });

  // Reminder delivery — every minute
  cron.schedule('* * * * *', () => {
    runReminderEngine().catch(err => console.error('[Scheduler] Uncaught in reminder engine:', err.message));
  });

  // Task-due notifications — every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    runTaskDueNotificationEngine().catch(err => console.error('[Scheduler] Uncaught in task-due engine:', err.message));
  });

  // Recurring tasks + events — every hour at :00
  cron.schedule('0 * * * *', () => {
    runRecurringTaskEngine().catch(err => console.error('[Scheduler] Uncaught in recurring-task engine:', err.message));
    runRecurringEventEngine().catch(err => console.error('[Scheduler] Uncaught in recurring-event engine:', err.message));
  });

  // Overdue task notifications — daily at 08:00
  cron.schedule('0 8 * * *', () => {
    runOverdueTaskEngine().catch(err => console.error('[Scheduler] Uncaught in overdue engine:', err.message));
  });

  // Gmail sync — every N minutes (default 5)
  const syncMinutes = parseInt(process.env.GMAIL_SYNC_INTERVAL_MINUTES || '5', 10);
  cron.schedule(`*/${syncMinutes} * * * *`, () => {
    runGmailSyncEngine().catch(err => console.error('[Scheduler] Uncaught in gmail sync:', err.message));
  });

  console.log('[Scheduler] ✓ Reminder warning engine → every minute');
  console.log('[Scheduler] ✓ Reminder ring engine    → every minute');
  console.log('[Scheduler] ✓ Task-due engine         → every 15 minutes');
  console.log('[Scheduler] ✓ Recurring engines       → every hour');
  console.log('[Scheduler] ✓ Overdue task engine     → daily at 08:00');
  console.log(`[Scheduler] ✓ Gmail sync engine       → every ${syncMinutes} minutes`);
}

module.exports = {
  startScheduler,
  // Export engines for testing
  runReminderWarningEngine,
  runReminderEngine,
  runTaskDueNotificationEngine,
  runOverdueTaskEngine,
  runRecurringTaskEngine,
  runRecurringEventEngine,
  runGmailSyncEngine,
};
