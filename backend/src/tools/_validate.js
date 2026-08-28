const Joi = require('joi');

const schemas = {
  task: Joi.object({
    title: Joi.string().max(500).default('Untitled Task'),
    description: Joi.string().max(5000).allow(null, '').default(null),
    details: Joi.string().max(10000).allow(null, '').default(null),
    priority: Joi.number().integer().min(1).max(5).default(3),
    urgency: Joi.number().integer().min(1).max(5).allow(null).default(null),
    due_at: Joi.date().iso().allow(null).default(null),
    status: Joi.string()
      .valid('pending', 'in_progress', 'done', 'cancelled', 'archived')
      .default('pending'),
    checklist: Joi.array().items(Joi.any()).default([]),
    is_favorite: Joi.boolean().default(false),
  }),

  event: Joi.object({
    title: Joi.string().max(500).default('Untitled Event'),
    description: Joi.string().max(5000).allow(null, '').default(null),
    starts_at: Joi.date().iso().required(),
    ends_at: Joi.date().iso().min(Joi.ref('starts_at')).required(),
    is_all_day: Joi.boolean().default(false),
    color: Joi.string().max(20).allow(null, '').default('#3b82f6'),
    location_text: Joi.string().max(500).allow(null, '').default(null),
    recurrence_rule: Joi.string().valid('daily', 'weekly', 'monthly').allow(null).default(null),
  }),

  reminder: Joi.object({
    title: Joi.string().max(500).required(),
    message: Joi.string().max(2000).allow(null, '').default(null),
    trigger_at: Joi.date().iso().allow(null).default(null),
    task_id: Joi.string().uuid().allow(null).default(null),
    event_id: Joi.string().uuid().allow(null).default(null),
    recurrence_rule: Joi.string().valid('daily', 'weekly', 'monthly').allow(null).default(null),
    warn_minutes_before: Joi.number().integer().min(0).max(1440).default(5),
  }),

  place: Joi.object({
    name: Joi.string().max(500).required(),
    address: Joi.string().max(1000).allow(null, '').default(null),
    category: Joi.string().max(100).allow(null, '').default(null),
    notes: Joi.string().max(5000).allow(null, '').default(null),
    latitude: Joi.number().min(-90).max(90).allow(null).default(null),
    longitude: Joi.number().min(-180).max(180).allow(null).default(null),
    urgency: Joi.number().integer().min(1).max(5).allow(null).default(null),
    is_visited: Joi.boolean().default(false),
  }),
};

/**
 * Validate and sanitize tool input data against a named schema.
 * Returns { value, error } — caller decides how to handle errors.
 *
 * @param {'task'|'event'|'reminder'|'place'} schemaName
 * @param {object} data
 * @returns {{ value: object, error: string|null }}
 */
function validate(schemaName, data) {
  const schema = schemas[schemaName];
  if (!schema) {
    console.warn(`[Validate] No schema found for "${schemaName}" — skipping validation`);
    return { value: data, error: null };
  }
  const { error, value } = schema.validate(data, {
    stripUnknown: true,
    abortEarly: false,
    convert: true,
  });
  return {
    value,
    error: error ? error.details.map((d) => d.message).join('; ') : null,
  };
}

module.exports = { validate };
