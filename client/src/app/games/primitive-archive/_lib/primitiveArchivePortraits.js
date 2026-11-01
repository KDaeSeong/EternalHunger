const root = '/games/primitive-archive/portraits/';
const portraits = [
  ['shiroko', '시로코', '수영복', 'shiroko-swimsuit.png', 1280, 720, 22.2, 32.1, 5],
  ['hina', '히나', '드레스', 'hina-dress.jpg', 908, 1210, 64.7, 35.5, 4.3],
  ['noa', '노아', '파자마', 'noa-pajamas.png', 1219, 686, 24, 33.3, 5.4],
  ['hoshino', '호시노', '무장', 'hoshino-armed.png', 1280, 720, 21.7, 34.9, 5.2],
  ['nonomi', '노노미', '수영복', 'nonomi-swimsuit.png', 780, 438, 73.3, 28.3, 4.5],
  ['ako', '아코', '드레스', 'ako-dress.jpg', 908, 1210, 65.3, 28.9, 4.3],
  ['fuuka', '후우카', '새해', 'fuuka-newyear.jpg', 1175, 1565, 47.4, 20.8, 5],
  ['yuuka', '유우카', '파자마', 'yuuka-pajamas.png', 1219, 686, 21.8, 34.5, 5.5],
];
export const ARCHIVE_OFFICIAL_PORTRAITS = Object.freeze(Object.fromEntries(portraits.map(
  ([id, name, variant, file, width, height, x, y, zoom]) => [id, Object.freeze({
    src: `${root}official/${file}`, width, height, variant, label: `${name}(${variant})`,
    objectPosition: `${x}% ${y}%`, crop: Object.freeze({ x, y, zoom }),
  })],
)));

const legacyPortraits = new Set(['placeholder', 'shiroko', 'hina', 'noa'].map(id => `${root}${id}.svg`));
for (const [id] of portraits) legacyPortraits.add(`${root}official/${id}.${['noa', 'ako'].includes(id) ? 'jpg' : 'png'}`);

// Display-only migration: known built-in portraits resolve to current artwork.
// Saved bytes, custom portraits, identities and generated heirs stay untouched.
export function resolveArchivePortrait(member) {
  const id = member?.id || member?.actorId;
  const official = Object.hasOwn(ARCHIVE_OFFICIAL_PORTRAITS, id) ? ARCHIVE_OFFICIAL_PORTRAITS[id] : null;
  const saved = typeof member?.portrait === 'string' ? member.portrait : '';
  if (official && (!saved || legacyPortraits.has(saved) || saved === official.src)) return official;
  return { src: saved || `${root}placeholder.svg`, width: 256, height: 256,
    objectPosition: '50% 50%', crop: null };
}
