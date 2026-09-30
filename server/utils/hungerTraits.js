// Keep normalization in sync with client/src/utils/hungerTraits.js. Unknown safe
// keys are retained so authored event packs can introduce their own capabilities.
function normalizeHungerTraits(value) {
  return [...new Set((Array.isArray(value) ? value : [])
    .filter((entry) => typeof entry === 'string')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => /^[a-z][a-z0-9_]{0,63}$/.test(entry)))]
    .slice(0, 32).sort();
}

module.exports = { normalizeHungerTraits };
