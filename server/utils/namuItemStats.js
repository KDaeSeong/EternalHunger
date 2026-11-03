const number = value => {
  const match = String(value ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
};

function parseNamuItemStats(raw = {}) {
  const args = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key.replace(/\s/g, ''), value]));
  const read = (...keys) => keys.map(key => args[key]).find(value => value != null) ?? '';
  const ratio = (...keys) => number(read(...keys)) / 100;
  const move = read('이동속도');
  const penetration = read('방어관통');
  return {
    atk: number(read('공격력')), def: number(read('방어력')), hp: number(read('최대체력', '체력')),
    skillAmp: number(read('스킬증폭')), atkSpeed: ratio('공격속도'),
    atkPerLevel: number(read('레벨당공격력')), defPerLevel: number(read('레벨당방어력')),
    hpPerLevel: number(read('레벨당최대체력', '레벨당체력')), skillAmpPerLevel: number(read('레벨당스킬증폭')),
    critChance: ratio('치명타확률'), cdr: ratio('쿨다운감소'),
    lifesteal: ratio('생명력흡수'), omnisyphon: ratio('모든피해흡혈'),
    moveSpeed: /%/.test(String(move)) ? number(move) / 100 : 0,
    moveSpeedFlat: /%/.test(String(move)) ? 0 : number(move),
    armorPen: /%/.test(String(penetration)) ? number(penetration) / 100 : 0,
    armorPenFlat: /%/.test(String(penetration)) ? 0 : number(penetration),
    adaptiveForce: number(read('맞춤형능력치')),
  };
}

function parseNamuStatTemplates(text, { includeInactive = false } = {}) {
  text = String(text || '');
  for (const marker of includeInactive ? [] : [/^==#?\s*삭제된 아이템\s*#?==\s*$/m, /^==#?\s*삭제된\s+항목\s*#?==\s*$/m]) {
    const match = marker.exec(text);
    if (match) text = text.slice(0, match.index);
  }
  const rows = [];
  const blocks = String(text).match(/\[include\(틀:이터널 리턴\/아이템\s*,[\s\S]*?\)\]/g) || [];
  for (const block of blocks) {
    const fields = block.slice(block.indexOf(',') + 1, block.lastIndexOf(')')).replace(/\\,/g, '\u0000').split(',');
    const args = Object.fromEntries(fields.map(field => {
      const at = field.indexOf('=');
      return at < 0 ? ['', ''] : [field.slice(0, at).trim(), field.slice(at + 1).replace(/\u0000/g, ',').trim()];
    }).filter(([key]) => key));
    const name = String(args['아이템명'] || '').trim();
    if (name) rows.push({ name, category: String(args['분류'] || '').replace(/\s/g, ''), stats: parseNamuItemStats(args) });
  }
  return rows;
}

module.exports = { parseNamuItemStats, parseNamuStatTemplates };
