// Public name for a user. The login ID (`username`) is a credential half and is
// never shown to other people: users without a nickname get a stable alias built
// from the end of their account ID instead.
function publicDisplayName(user, fallback = '익명') {
  if (!user || typeof user !== 'object') return fallback;
  const nickname = String(user.nickname || '').trim();
  if (nickname) return nickname;
  const id = String(user._id || user.id || '').trim();
  return id ? `플레이어-${id.slice(-4)}` : fallback;
}

module.exports = { publicDisplayName };
