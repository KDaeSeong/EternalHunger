const EXPECT_WEAPON_TYPES = [
  '권총','돌격소총','저격총','글러브','톤파','쌍절곤','아르카나','양손검','쌍검','망치',
  '방망이','채찍','투척','암기','활','석궁','도끼','단검','창','레이피어',
  '기타','카메라',
];

const EXPECT_ARMOR_SLOTS = ['head', 'clothes', 'arm', 'shoes'];

const WEAPON_TYPE_ALIASES = [
  [/^pistol$/i, '권총'],
  [/^권총$/i, '권총'],
  [/(assault[_\s-]?rifle|ar)$/i, '돌격소총'],
  [/^(돌격소총|돌소총|기관단총)$/i, '돌격소총'],
  [/^sniper([_\s-]?rifle)?$/i, '저격총'],
  [/^저격총$/i, '저격총'],
  [/^(glove|gloves|fist|knuckle|gauntlet)$/i, '글러브'],
  [/^(장갑|글러브)$/i, '글러브'],
  [/^tonfa$/i, '톤파'],
  [/^톤파$/i, '톤파'],
  [/^(nunchaku|numchaku)$/i, '쌍절곤'],
  [/^쌍절곤$/i, '쌍절곤'],
  [/^arcana$/i, '아르카나'],
  [/^아르카나$/i, '아르카나'],
  [/^(two[_\s-]?hand(ed)?[_\s-]?sword|one[_\s-]?hand(ed)?[_\s-]?sword|sword)$/i, '양손검'],
  [/^(검|양손검)$/i, '양손검'],
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
  [/^guitar$/i, '기타'],
  [/^기타$/i, '기타'],
  [/^camera$/i, '카메라'],
  [/^카메라$/i, '카메라'],
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
