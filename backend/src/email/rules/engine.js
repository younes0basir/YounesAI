const { parseAddress } = require('../../integrations/gmail/parseMessage');

function extractDomain(address) {
  if (!address) return null;
  const parts = address.split('@');
  return parts.length > 1 ? parts[1].toLowerCase() : null;
}

function matchesRule(rule, email) {
  if (!rule.is_active) return false;
  const from = email.from_address || email.fromAddress || '';
  const domain = extractDomain(from);
  const subject = (email.subject || '').toLowerCase();
  const labels = email.label_ids || email.labelIds || [];

  if (rule.match_sender && from.toLowerCase() !== rule.match_sender.toLowerCase()) {
    return false;
  }
  if (rule.match_domain && domain !== rule.match_domain.toLowerCase()) {
    return false;
  }
  if (rule.match_subject_contains && !subject.includes(rule.match_subject_contains.toLowerCase())) {
    return false;
  }
  if (rule.match_label && !labels.includes(rule.match_label)) {
    return false;
  }
  return true;
}

function applyRules(rules, email) {
  const sorted = [...rules].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  for (const rule of sorted) {
    if (matchesRule(rule, email)) {
      return {
        matched: true,
        rule,
        category: rule.category || 'UNKNOWN',
        action: rule.action || 'classify',
        evidence: {
          ruleId: rule.id,
          ruleName: rule.name,
          matchedOn: {
            sender: rule.match_sender || null,
            domain: rule.match_domain || null,
            subjectContains: rule.match_subject_contains || null,
            label: rule.match_label || null,
          },
        },
      };
    }
  }
  return { matched: false };
}

module.exports = { applyRules, extractDomain, matchesRule };
