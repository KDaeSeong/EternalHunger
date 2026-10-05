const axios = require('axios');

// This public DB is linked by the game's official character-guide announcement.
// Requests stay on one fixed host, never a URL supplied by a user or an AI.
const API = 'https://comm-api.game.naver.com/nng_main/v1';
const DB_PAGE = 'https://game.naver.com/lounge/Eternal_Return/db/character';
const GUIDE_PAGE = 'https://playeternalreturn.com/posts/news/1280?hl=ko-KR';
const OBJECT_ID = /^CH_(?:[A-Z]+_)?670_\d{1,8}$/;
const CACHE_MS = 15 * 60 * 1000;
const normalizeName = value => String(value || '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();

function plainText(value, limit = 6000) {
  if (typeof value !== 'string' || value.length > 30000) throw new Error('ER_SOURCE_INVALID');
  const text = value.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]*>/g, '')
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code) => {
      const point = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '';
    }).replace(/&(amp|lt|gt|quot|apos|nbsp);/gi, (_, key) =>
      ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' })[key.toLowerCase()])
    .replace(/\r\n?/g, '\n').trim();
  if (text.length > limit) throw new Error('ER_SOURCE_TOO_LONG');
  return text;
}

function extractErSource(detail, row) {
  if (detail?.intro?.gameId !== 'GM_670' || detail.intro.objectId !== row.objectId
    || normalizeName(detail.intro.name) !== normalizeName(row.name) || !Array.isArray(detail.skill)) {
    throw new Error('ER_SOURCE_INVALID');
  }
  const skills = {};
  for (const entry of detail.skill) {
    if (entry.dataType !== 'skill') continue; // Weapon skills are not Q/W/E/R/T.
    const match = plainText(entry.name, 150).match(/^([QWERPT])\s*[-:：]\s*(.+)$/i);
    if (!match) continue;
    const slot = ['t', 'p'].includes(match[1].toLowerCase()) ? 'passive' : match[1].toLowerCase();
    if (skills[slot]) throw new Error('ER_SOURCE_AMBIGUOUS');
    skills[slot] = { name: match[2].trim(), description: plainText(entry.description) };
  }
  if (!['q', 'w', 'e', 'r', 'passive'].every(slot => skills[slot]?.description)) throw new Error('ER_SOURCE_INCOMPLETE');
  const stats = (detail.videoWithStats?.stats || []).slice(0, 40).map(entry => ({
    name: plainText(entry.name, 100), value: plainText(entry.value, 500),
  }));
  return {
    material: { name: plainText(detail.intro.name, 40), description: plainText(detail.intro.description || '', 3000),
      weapons: (detail.intro.filters || []).filter(entry => entry.name === '무기')
        .map(entry => plainText(entry.value, 100)), stats, skills },
    warnings: ['공식 홈페이지에서 안내한 네이버 캐릭터 DB를 직접 읽었습니다. DB에 최신 패치 적용일은 표시되지 않아 최신 수치와 같다고 보장하지 않습니다.',
      '원작의 폼 전환·중첩·적중 시 발동 패시브 등 지원하지 않는 효과는 초안에서 생략하거나 비활성으로 표시합니다.'],
    sources: [{ title: `${row.name} · 공식 안내 캐릭터 DB (네이버 게임)`, url: `${DB_PAGE}/${row.objectId}` },
      { title: '이터널 리턴 공식 캐릭터 DB 안내', url: GUIDE_PAGE }],
  };
}

function createErCharacterSourceReader({ now = Date.now, getJson = async (url) =>
  (await axios.get(url, { timeout: 8000, maxContentLength: 524288, maxBodyLength: 524288,
    maxRedirects: 0, headers: { 'Accept-Encoding': 'identity', Accept: 'application/json' } })).data } = {}) {
  let cache = null, pending = null;
  async function loadList() {
    if (cache && now() - cache.time < CACHE_MS) return cache.rows;
    if (pending) return pending;
    pending = (async () => {
      const gameId = await getJson(`${API}/baseurl/domain-name/Eternal_Return`);
      if (gameId !== 'GM_670') throw new Error('ER_SOURCE_INVALID');
      const rows = [];
      for (let offset = 0; offset < 500; offset += 100) {
        const page = await getJson(`${API}/game/db/character/GM_670/dataType/character?offset=${offset}&limit=100`);
        if (!Number.isInteger(page?.totalCount) || page.totalCount < 1 || page.totalCount > 500
          || !Array.isArray(page.result?.character) || !page.result.character.length) throw new Error('ER_SOURCE_INVALID');
        for (const row of page.result.character) {
          if (!OBJECT_ID.test(row.objectId) || typeof row.name !== 'string' || row.name.length > 40
            || rows.some(existing => existing.objectId === row.objectId)) throw new Error('ER_SOURCE_INVALID');
          rows.push({ name: row.name, objectId: row.objectId });
        }
        if (rows.length >= page.totalCount) {
          if (rows.length !== page.totalCount) throw new Error('ER_SOURCE_INVALID');
          cache = { time: now(), rows }; return rows;
        }
      }
      throw new Error('ER_SOURCE_INCOMPLETE');
    })();
    try { return await pending; } finally { pending = null; }
  }
  return async (name) => {
    const matches = (await loadList()).filter(row => normalizeName(row.name) === normalizeName(name));
    if (matches.length !== 1) throw new Error(matches.length ? 'ER_SOURCE_AMBIGUOUS' : 'ER_SOURCE_NOT_FOUND');
    const row = matches[0];
    return extractErSource(await getJson(`${API}/game/db/character/objectId/${row.objectId}`), row);
  };
}

module.exports = { createErCharacterSourceReader, extractErSource, plainText };
