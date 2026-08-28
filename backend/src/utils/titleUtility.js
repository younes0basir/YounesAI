/**
 * Extract a task/event title from natural-language messages.
 * Handles "named X", "called X", and "for X" patterns.
 */

function cleanTitle(raw) {
  if (!raw) return null;
  let title = raw
    .trim()
    .replace(/^["'.,]+|["'.,]+$/g, '')
    .replace(/^(?:named|called|titled)\s+/i, '')
    .trim();
  if (!title) return null;
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function looksLikeDateFragment(text) {
  return /^(?:\d{1,2}(?:st|nd|rd|th)?|today|tomorrow|next|this\s+month|in\s+\d)/i.test(text.trim());
}

/**
 * @param {string} message
 * @returns {string|null}
 */
function extractNamedTitle(message) {
  if (!message) return null;

  const normalized = message.replace(/\bmounth\b/gi, 'month').replace(/\bcretae\b/gi, 'create');

  // "named allo", "called team sync", etc. — anywhere in the message
  const namedMatch = normalized.match(
    /(?:named|called|titled)\s+["']?(.+?)["']?(?:\s*$|[.,!?]|$)/i
  );
  if (namedMatch?.[1]) {
    return cleanTitle(namedMatch[1]);
  }

  // "event for allo", "task for internship"
  const forMatch = normalized.match(
    /(?:event|meeting|task|todo)s?\s+for\s+["']?(.+?)["']?(?:\s*$|[.,!?]|$)/i
  );
  if (forMatch?.[1] && !looksLikeDateFragment(forMatch[1])) {
    return cleanTitle(forMatch[1]);
  }

  return null;
}

/**
 * Fill in a default/placeholder title from the user message when the LLM missed it.
 * @param {object} entity - parsed.task or parsed.event
 * @param {string[]} defaultTitles - titles treated as placeholders
 * @param {string} message - cleaned message shown to the agent
 * @param {string} [originalMessage] - full user message before temporal stripping
 */
function applyExtractedTitle(entity, defaultTitles, message, originalMessage) {
  if (!entity) return;

  const current = (entity.title || '').trim();
  const isPlaceholder =
    !current || defaultTitles.some((t) => t.toLowerCase() === current.toLowerCase());
  if (!isPlaceholder) return;

  const extracted = extractNamedTitle(originalMessage || message) || extractNamedTitle(message);

  if (extracted) {
    entity.title = extracted;
  }
}

module.exports = {
  extractNamedTitle,
  applyExtractedTitle,
  cleanTitle,
};
