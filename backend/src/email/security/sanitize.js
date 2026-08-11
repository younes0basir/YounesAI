function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeEmailBody(rawBody) {
  const withoutHtml = stripHtml(rawBody);
  const cleaned = withoutHtml.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ').trim();
  const maxLen = 2048;
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen)}…`;
}

module.exports = { sanitizeEmailBody, stripHtml };
