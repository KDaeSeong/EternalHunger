const { createHash } = require('node:crypto');

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function gameRunIdentity(body = {}) {
  if (body.clientRunId !== undefined) {
    if (typeof body.clientRunId === 'string' && body.clientRunId.trim() && body.clientRunId.trim().length <= 160) {
      return body.clientRunId.trim();
    }
    const error = new Error('경기 식별자는 1~160자 문자열이어야 합니다.');
    error.code = 'INVALID_RUN_ID';
    throw error;
  }
  // Older clients have no run ID. Identical completed-result payloads still
  // share a receipt; JSON object-key ordering must not defeat retry handling.
  const fields = ['winnerId', 'winnerTeamId', 'killCounts', 'assistCounts', 'fullLogs', 'participants', 'matchMode', 'runEvents', 'teamSize'];
  const result = Object.fromEntries(fields.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]));
  return 'legacy-' + createHash('sha256').update(JSON.stringify(canonical(result))).digest('hex');
}

module.exports = { gameRunIdentity };
