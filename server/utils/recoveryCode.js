const crypto = require('crypto');

const RECOVERY_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RECOVERY_CODE_LENGTH = 20;

function normalizeRecoveryCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z2-9]/g, '');
}

function formatRecoveryCode(value) {
  const normalized = normalizeRecoveryCode(value);
  const groups = [];
  for (let i = 0; i < normalized.length; i += 4) {
    groups.push(normalized.slice(i, i + 4));
  }
  return groups.filter(Boolean).join('-');
}

function generateRecoveryCode() {
  let code = '';
  for (let i = 0; i < RECOVERY_CODE_LENGTH; i += 1) {
    code += RECOVERY_CODE_ALPHABET[crypto.randomInt(RECOVERY_CODE_ALPHABET.length)];
  }
  return formatRecoveryCode(code);
}

module.exports = {
  generateRecoveryCode,
  normalizeRecoveryCode,
};
