const EXPECT_WEAPON_TYPES = [
  '권총','돌격소총','저격총','장갑','톤파','쌍절곤','아르카나','검','쌍검','망치',
  '방망이','채찍','투척','암기','활','석궁','도끼','단검','창','레이피어',
];

const EXPECT_ARMOR_SLOTS = ['head', 'clothes', 'arm', 'shoes'];

const WEAPON_TYPE_ALIASES = [
  [/^pistol$/i, '권총'],
  [/^권총$/i, '권총'],
  [/(assault[_\s-]?rifle|ar)$/i, '돌격소총'],
  [/^(돌격소총|돌소총|기관단총)$/i, '돌격소총'],
  [/^sniper([_\s-]?rifle)?$/i, '저격총'],
  [/^저격총$/i, '저격총'],
  [/^(glove|fist|gauntlet)$/i, '장갑'],
  [/^(장갑|글러브)$/i, '장갑'],
  [/^tonfa$/i, '톤파'],
  [/^톤파$/i, '톤파'],
  [/^(nunchaku|numchaku)$/i, '쌍절곤'],
  [/^쌍절곤$/i, '쌍절곤'],
  [/^arcana$/i, '아르카나'],
  [/^아르카나$/i, '아르카나'],
  [/^(one[_\s-]?hand(ed)?[_\s-]?sword|sword)$/i, '검'],
  [/^(검|양손검)$/i, '검'],
  [/^(dual[_\s-]?swords?|dualswords?)$/i, '쌍검'],
  [/^쌍검$/i, '쌍검'],
  [/^(hammer|sledge)$/i, '망치'],
  [/^망치$/i, '망치'],
  [/^(bat|club)$/i, '방망이'],
  [/^방망이$/i, '방망이'],
  [/^whip$/i, '채찍'],
  [/^채찍$/i, '채찍'],
  [/^(throw|thrown)$/i, '투척'],
  [/^투척$/i, '투척'],
  [/^(shuriken|throwing[_\s-]?star)$/i, '암기'],
  [/^암기$/i, '암기'],
  [/^bow$/i, '활'],
  [/^활$/i, '활'],
  [/^crossbow$/i, '석궁'],
  [/^석궁$/i, '석궁'],
  [/^axe$/i, '도끼'],
  [/^도끼$/i, '도끼'],
  [/^dagger$/i, '단검'],
  [/^단검$/i, '단검'],
  [/^(spear|lance)$/i, '창'],
  [/^창$/i, '창'],
  [/^rapier$/i, '레이피어'],
  [/^레이피어$/i, '레이피어'],
];

function normalizeWeaponType(raw) {
  const txt = String(raw || '').trim();
  if (!txt) return '';
  if (EXPECT_WEAPON_TYPES.includes(txt)) return txt;
  for (const [regex, mapped] of WEAPON_TYPE_ALIASES) {
    if (regex.test(txt)) return mapped;
  }
  const compact = txt.toLowerCase().replace(/[^a-z]/g, '');
  for (const [regex, mapped] of WEAPON_TYPE_ALIASES) {
    if (regex.test(compact)) return mapped;
  }
  return txt;
}

module.exports = {
  EXPECT_WEAPON_TYPES,
  EXPECT_ARMOR_SLOTS,
  normalizeWeaponType,
};
