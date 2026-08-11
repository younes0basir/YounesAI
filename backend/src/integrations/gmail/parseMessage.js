function decodeBase64Url(data) {
  if (!data) return '';
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf8');
}

function getHeader(headers, name) {
  const h = (headers || []).find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : '';
}

function parseAddress(raw) {
  if (!raw) return { address: '', name: '' };
  const match = raw.match(/^(?:"?([^"]*)"?\s)?<?([^>]+@[^>]+)>?$/);
  if (match) return { name: (match[1] || '').trim(), address: match[2].trim() };
  return { name: '', address: raw.trim() };
}

function extractBody(payload) {
  let text = '';
  if (!payload) return text;

  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        text += decodeBase64Url(part.body.data);
      } else if (part.parts) {
        text += extractBody(part);
      }
    }
    if (!text) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/html' && part.body?.data) {
          text += decodeBase64Url(part.body.data);
        } else if (part.parts) {
          text += extractBody(part);
        }
      }
    }
  } else if (payload.body?.data) {
    text = decodeBase64Url(payload.body.data);
  }

  return text;
}

function normalizeGmailMessage(message) {
  const headers = message.payload?.headers || [];
  const from = parseAddress(getHeader(headers, 'From'));
  const toRaw = getHeader(headers, 'To');
  const toAddresses = toRaw
    ? toRaw.split(',').map((s) => parseAddress(s.trim()).address).filter(Boolean)
    : [];

  const bodyRaw = extractBody(message.payload);
  const receivedHeader = getHeader(headers, 'Date');
  const receivedAt = receivedHeader ? new Date(receivedHeader) : new Date(parseInt(message.internalDate, 10));

  return {
    gmailMessageId: message.id,
    gmailThreadId: message.threadId,
    fromAddress: from.address,
    fromName: from.name || from.address,
    toAddresses,
    subject: getHeader(headers, 'Subject') || '(no subject)',
    snippet: message.snippet || '',
    bodyRaw,
    receivedAt: Number.isNaN(receivedAt.getTime()) ? new Date() : receivedAt,
    isRead: !(message.labelIds || []).includes('UNREAD'),
    isStarred: (message.labelIds || []).includes('STARRED'),
    labelIds: message.labelIds || [],
  };
}

module.exports = { normalizeGmailMessage, parseAddress };
