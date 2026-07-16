import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ER_WEAPON_SKILLS,
  ER_WEAPON_TYPES_KO,
  normalizeErWeaponType,
  normalizeErWeaponTypes,
  pickInitialErWeaponType,
} from '../src/utils/erMeta.js';
import { createEquipmentItem } from '../src/utils/equipmentCatalog.js';

const addedWeapons = [
  '산탄총',
  '기관단총',
  '유탄발사기',
  '로켓발사기',
  '한손검',
  '철퇴',
  '기관총',
  '박격포',
];

for (const weapon of addedWeapons) {
  assert.ok(ER_WEAPON_TYPES_KO.includes(weapon), `${weapon} 무기군이 목록에 없습니다.`);
  assert.ok(ER_WEAPON_SKILLS[weapon]?.name, `${weapon} 무기 스킬이 없습니다.`);
  const generated = createEquipmentItem({ slot: 'weapon', tier: 1, weaponType: weapon });
  assert.equal(generated.weaponType, weapon, `${weapon} 생성 장비의 무기군이 일치하지 않습니다.`);
  assert.ok(String(generated.name || '').trim(), `${weapon} 생성 장비 이름이 없습니다.`);
}

assert.equal(normalizeErWeaponType('smg'), '기관단총');
assert.equal(normalizeErWeaponType('rocket launcher'), '로켓발사기');
assert.equal(normalizeErWeaponType('one-handed sword'), '한손검');
assert.deepEqual(
  normalizeErWeaponTypes(['smg', '기관단총', 'mortar', 'unknown']),
  ['기관단총', '박격포'],
  '무기 목록은 지원 무기만 정규화하고 중복을 제거해야 합니다.',
);

const actor = { erWeapons: ['산탄총', '기관단총', '박격포'], weaponType: '권총' };
assert.equal(pickInitialErWeaponType(actor, () => 0), '산탄총', '난수 0은 첫 허용 무기를 골라야 합니다.');
assert.equal(pickInitialErWeaponType(actor, () => 0.999999), '박격포', '상한 난수는 마지막 허용 무기를 골라야 합니다.');
assert.equal(
  pickInitialErWeaponType({ erWeapons: [], weaponType: '철퇴' }, () => 0.5),
  '철퇴',
  '다중 목록이 없으면 기존 단일 무기를 유지해야 합니다.',
);

const rosterSource = await readFile(new URL('../src/app/simulation/_lib/simulationInitialRosterRuntime.js', import.meta.url), 'utf8');
const mergeSource = await readFile(new URL('../src/app/simulation/_lib/runtimeParticipantRuntime.js', import.meta.url), 'utf8');
const modalSource = await readFile(new URL('../src/app/characters/_components/CharacterBasicEditModal.js', import.meta.url), 'utf8');
const gearCatalogSource = await readFile(new URL('../src/app/simulation/_lib/gearCatalogRuntime.js', import.meta.url), 'utf8');

assert.match(rosterSource, /pickInitialErWeaponType\(erPresetSeed\)/, '경기 시작 로스터에서 무기를 추첨해야 합니다.');
assert.match(rosterSource, /runWeaponType/, '경기 중 사용할 무기를 별도 필드로 고정해야 합니다.');
assert.match(mergeSource, /if \(base\.runWeaponType\)/, '서버 동기화가 경기 무기를 덮어쓰면 안 됩니다.');
assert.match(modalSource, /type="checkbox"/, '캐릭터 설정은 다중 무기 체크박스를 제공해야 합니다.');
assert.match(modalSource, /erWeapons/, '캐릭터 설정은 erWeapons 배열을 갱신해야 합니다.');
assert.match(gearCatalogSource, /createWeaponCatalogFallback/, '공개 아이템이 없는 신규 무기군은 같은 타입 장비를 생성해야 합니다.');

console.log(JSON.stringify({
  weaponTypes: ER_WEAPON_TYPES_KO.length,
  addedWeapons: addedWeapons.length,
  multiWeaponStart: true,
  runWeaponLocked: true,
}, null, 2));
