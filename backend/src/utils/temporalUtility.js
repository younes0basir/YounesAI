/**
 * Temporal Utility using chrono-node
 * Resolves raw temporal expressions (e.g. 'remind me in 10 minutes') to ISO 8601 strings.
 */
const chrono = require('chrono-node');

/**
 * Parses raw message for temporal references and extracts/replaces them, or returns computed date.
 * @param {string} rawMessage The user request containing time references
 * @param {Date} [referenceDate] Optional reference date (default: now)
 * @returns {object} { success: boolean, parsedDate: string|null, cleanedMessage: string }
 */
function parseTemporal(rawMessage, referenceDate = new Date()) {
  try {
    // Pre-process: fix common typos that chrono-node can't handle
    let cleanedMessage = rawMessage
      .replace(/\bmounth\b/gi, 'month')
      .replace(/\btommorow\b/gi, 'tomorrow')
      .replace(/\btomorow\b/gi, 'tomorrow');

    // Priority check: "N this month" / "the Nth of this month" pattern
    // chrono-node often misparses these, so we handle them manually first.
    const dayThisMonthMatch = cleanedMessage.match(
      /(?:on\s+)?(\d{1,2})(?:st|nd|rd|th)?\s*(?:this\s+month|of\s+this\s+month|of\s+the\s+month)/i
    );
    if (dayThisMonthMatch) {
      const day = parseInt(dayThisMonthMatch[1], 10);
      if (day >= 1 && day <= 31) {
        const targetDate = new Date(referenceDate);
        targetDate.setDate(day);
        // If the day has already passed this month, move to next month
        if (targetDate < referenceDate) {
          targetDate.setMonth(targetDate.getMonth() + 1);
        }
        return {
          success: true,
          parsedDate: targetDate.toISOString(),
          cleanedMessage: cleanedMessage
            .replace(dayThisMonthMatch[0], '')
            .replace(/\s+/g, ' ')
            .trim(),
        };
      }
    }

    // Try chrono-node parsing for other patterns
    let results = chrono.parse(cleanedMessage, referenceDate);

    // If chrono-node fails, try manual parsing for common relative expressions
    if (!results || results.length === 0) {
      const manualResult = parseRelativeDates(cleanedMessage, referenceDate);
      if (manualResult) {
        return manualResult;
      }

      return {
        success: false,
        parsedDate: null,
        cleanedMessage: rawMessage,
      };
    }

    // Use the first temporal reference found
    const firstResult = results[0];
    const parsedDate = firstResult.start.date().toISOString();

    // Replace the parsed time expression in the original message to get a cleaner prompt
    const resultCleanedMessage = cleanedMessage
      .replace(firstResult.text, '')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      success: true,
      parsedDate,
      cleanedMessage: resultCleanedMessage,
    };
  } catch (err) {
    console.error('[temporalUtility] Error parsing temporal expression:', err);
    return {
      success: false,
      parsedDate: null,
      cleanedMessage: rawMessage,
    };
  }
}

/**
 * Manual parsing for relative date expressions that chrono-node might miss
 * @param {string} message The message to parse
 * @param {Date} referenceDate The reference date
 * @returns {object|null} Parsed result or null if no match
 */
function parseRelativeDates(message, referenceDate) {
  const lowerMessage = message.toLowerCase();

  // Match patterns like "in X days", "X days later", "X days from now"
  const dayPatterns = [
    /(?:in\s+)?(\d+)\s+days?\s+(?:later|from now)/i,
    /(?:in\s+)?(\d+)\s+days?/i,
    /(\d+)\s+days?\s+later/i,
    /(\d+)\s+days?\s+from now/i,
    /three\s+days?\s+later/i,
    /in\s+three\s+days?/i,
  ];

  for (const pattern of dayPatterns) {
    const match = lowerMessage.match(pattern);
    if (match) {
      let days = 3; // default for "three days"
      if (match[1]) {
        days = parseInt(match[1], 10);
      }

      const targetDate = new Date(referenceDate);
      targetDate.setDate(targetDate.getDate() + days);

      // Find the original text to replace
      const originalMatch = message.match(new RegExp(match.source, 'i'));
      const originalText = originalMatch ? originalMatch[0] : match[0];

      const cleanedMessage = message.replace(originalText, '').replace(/\s+/g, ' ').trim();

      return {
        success: true,
        parsedDate: targetDate.toISOString(),
        cleanedMessage,
      };
    }
  }

  // Match patterns like "in X weeks", "X weeks later"
  const weekPatterns = [
    /(?:in\s+)?(\d+)\s+weeks?\s+(?:later|from now)/i,
    /(?:in\s+)?(\d+)\s+weeks?/i,
    /(\d+)\s+weeks?\s+later/i,
    /(\d+)\s+weeks?\s+from now/i,
    /next\s+week/i,
  ];

  for (const pattern of weekPatterns) {
    const match = lowerMessage.match(pattern);
    if (match) {
      let weeks = 1; // default for "next week"
      if (match[1]) {
        weeks = parseInt(match[1], 10);
      }

      const targetDate = new Date(referenceDate);
      targetDate.setDate(targetDate.getDate() + weeks * 7);

      const originalMatch = message.match(new RegExp(match.source, 'i'));
      const originalText = originalMatch ? originalMatch[0] : match[0];

      const cleanedMessage = message.replace(originalText, '').replace(/\s+/g, ' ').trim();

      return {
        success: true,
        parsedDate: targetDate.toISOString(),
        cleanedMessage,
      };
    }
  }

  return null;
}

module.exports = { parseTemporal };
