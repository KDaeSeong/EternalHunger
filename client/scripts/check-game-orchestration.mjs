import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  GAME_BGM_LAYER_ROLES,
  GAME_BGM_PROFILE_KEYS,
  gameBgmProfile,
} from '../src/app/games/_lib/gameBgmProfiles.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(scriptDir, '..');
const providerSource = await readFile(
  path.join(clientRoot, 'src', 'app', 'games', '_components', 'GameBgmProvider.js'),
  'utf8',
);

const acousticRoles = Object.freeze({
  'piano-figure': 'pianoGain',
  'harp-arpeggio': 'harpGain',
  'woodwind-solo': 'woodwindGain',
  'horn-ensemble': 'hornGain',
});

assert.equal(GAME_BGM_LAYER_ROLES.length, 31, '공용 BGM 엔진은 31개 편성 역할을 제공해야 합니다.');
for (const [role, gainKey] of Object.entries(acousticRoles)) {
  assert.ok(GAME_BGM_LAYER_ROLES.includes(role), `공용 편성 역할이 누락되었습니다: ${role}`);
  for (const theme of GAME_BGM_PROFILE_KEYS) {
    const profile = gameBgmProfile(theme);
    assert.ok(Number(profile.orchestration?.[gainKey] || 0) > 0, `${theme}에 ${gainKey}가 필요합니다.`);
    assert.ok(
      profile.arrangement.some((section) => Number(section[role.split('-')[0]] || 0) >= 0.2),
      `${theme} 편곡에 ${role}가 실제로 등장해야 합니다.`,
    );
  }
}

const referenceProfile = GAME_BGM_PROFILE_KEYS
  .map((theme) => gameBgmProfile(theme))
  .find((profile) => (
    profile.arrangement.some((section) => section.id === 'break')
    && profile.arrangement.some((section) => section.id === 'climax')
  ));
assert.ok(referenceProfile, '브레이크와 클라이맥스를 모두 갖춘 기준 편곡이 필요합니다.');
const quietSection = referenceProfile.arrangement.find((section) => section.id === 'break');
const climaxSection = referenceProfile.arrangement.find((section) => section.id === 'climax');
assert.ok(quietSection, '잔잔한 브레이크 섹션이 필요합니다.');
assert.ok(climaxSection, '클라이맥스 섹션이 필요합니다.');
assert.ok(
  quietSection.harp > quietSection.horn && quietSection.woodwind > quietSection.horn,
  '잔잔한 섹션은 하프와 목관을 호른보다 앞세워야 합니다.',
);
assert.ok(
  climaxSection.horn > climaxSection.harp && climaxSection.horn > climaxSection.woodwind,
  '클라이맥스는 호른 앙상블을 전면에 배치해야 합니다.',
);

[
  'schedulePianoFigure',
  'scheduleHarpArpeggio',
  'scheduleWoodwindSolo',
  'scheduleHornEnsemble',
].forEach((scheduler) => {
  assert.match(providerSource, new RegExp(`function ${scheduler}\\(`), `${scheduler} 구현이 필요합니다.`);
  assert.match(providerSource, new RegExp(`${scheduler}\\(session, arrangement, chordRoot, start\\)`), `${scheduler}가 실시간 편곡 루프에 연결되어야 합니다.`);
});
assert.match(providerSource, /ratio: 2\.004/, '피아노 음색은 비정수 배음으로 현의 질감을 만들어야 합니다.');
assert.match(providerSource, /ratio: 3\.018/, '하프 음색은 별도의 배음 감쇠를 사용해야 합니다.');
assert.match(providerSource, /vibratoDepth: partial\.ratio === 1 \? 7 : 3/, '목관 주선율에는 비브라토가 필요합니다.');
assert.match(providerSource, /frequency: Math\.min\(4400, Math\.max\(1200, frequency \* 3\.2\)\)/, '목관에는 호흡 노이즈 대역이 필요합니다.');
assert.match(providerSource, /vibratoRate: 4\.65/, '호른 앙상블에는 느린 비브라토가 필요합니다.');

console.log(JSON.stringify({
  profiles: GAME_BGM_PROFILE_KEYS.length,
  roles: GAME_BGM_LAYER_ROLES.length,
  acousticRoles: Object.keys(acousticRoles),
  quietFocus: ['harp', 'woodwind'],
  climaxFocus: 'horn',
}, null, 2));
