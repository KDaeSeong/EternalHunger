import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profilePath = path.join(clientRoot, 'src', 'app', 'games', '_lib', 'gameBgmProfiles.js');
const soundtrackPath = path.join(clientRoot, 'src', 'app', 'games', 'dual-academy-tcg', '_lib', 'dualAcademyTcgSoundtrack.js');
const pagePath = path.join(clientRoot, 'src', 'app', 'games', 'dual-academy-tcg', 'play', 'page.js');
const soundPath = path.join(clientRoot, 'src', 'app', 'games', '_lib', 'useGameSfx.js');
const themePath = path.join(clientRoot, 'src', 'app', 'games', '_lib', 'gameAudioThemes.js');
const iconPath = path.join(clientRoot, 'src', 'app', 'games', '_components', 'GameActionIcon.js');

async function importSource(filePath) {
  const source = await readFile(filePath, 'utf8');
  const encoded = Buffer.from(source).toString('base64');
  return { source, module: await import(`data:text/javascript;base64,${encoded}`) };
}

const [{ module: profiles }, { module: soundtrack }] = await Promise.all([
  importSource(profilePath),
  importSource(soundtrackPath),
]);
const [pageSource, soundSource, themeSource, iconSource] = await Promise.all([
  readFile(pagePath, 'utf8'),
  readFile(soundPath, 'utf8'),
  readFile(themePath, 'utf8'),
  readFile(iconPath, 'utf8'),
]);

assert.equal(soundtrack.DUAL_ACADEMY_SOUNDTRACK.length, 10, 'Dual Academy OST는 열 장면을 가져야 합니다.');
assert.equal(
  new Set(soundtrack.DUAL_ACADEMY_SOUNDTRACK.map((track) => track.theme)).size,
  10,
  'Dual Academy OST 테마 키는 중복되면 안 됩니다.',
);

const expectedBars = {
  'academy-ready': 36,
  'academy-main': 40,
  'academy-battle': 44,
  'academy-chain': 40,
  'academy-danger': 44,
  'academy-mika': 40,
  'academy-hina': 44,
  'academy-yuuka': 40,
  'academy-victory': 36,
  'academy-defeat': 28,
};

const expectedBpm = {
  'academy-ready': 96,
  'academy-main': 124,
  'academy-battle': 148,
  'academy-chain': 144,
  'academy-danger': 156,
  'academy-mika': 136,
  'academy-hina': 150,
  'academy-yuuka': 128,
  'academy-victory': 124,
  'academy-defeat': 78,
};

assert.equal(profiles.gameBgmProfile('academy-duel').label, 'Dual Academy TCG', '전용 라우트 BGM 프로필이 필요합니다.');

for (const track of soundtrack.DUAL_ACADEMY_SOUNDTRACK) {
  const profile = profiles.gameBgmProfile(track.theme);
  assert.equal(profiles.GAME_BGM_PROFILE_KEYS.includes(track.theme), true, `누락된 OST 프로필: ${track.theme}`);
  assert.match(profile.label, /^Dual Academy TCG OST · /, `곡명이 OST 형식이 아닙니다: ${track.theme}`);
  assert.equal(profile.icon, track.icon, `곡 장면 아이콘이 일치하지 않습니다: ${track.theme}`);
  assert.equal(profile.bpm, expectedBpm[track.theme], `장면 템포 오류: ${track.theme}`);
  assert.equal(profile.steps / 16, expectedBars[track.theme], `곡 마디 수 오류: ${track.theme}`);
  assert.equal(profile.lead.length, 16, `A 주제 길이 오류: ${track.theme}`);
  assert.equal(profile.leadB.length, 16, `B 주제 길이 오류: ${track.theme}`);
  assert.equal(profile.leadC.length, 16, `C 주제 길이 오류: ${track.theme}`);
  assert.equal(profile.pulse.length, 16, `리듬 펄스 길이 오류: ${track.theme}`);
  assert.equal(profile.arrangement.length, 10, `곡은 열 개 구간으로 전개되어야 합니다: ${track.theme}`);
  assert.equal(profile.fadeInSeconds >= 0.55, true, `곡 시작 페이드가 너무 짧습니다: ${track.theme}`);
  assert.equal(profile.crossfadeSeconds >= 0.55, true, `장면 크로스페이드가 너무 짧습니다: ${track.theme}`);
  assert.equal(profile.chordVoicing.length >= 4, true, `OST 화음은 4성 이상이어야 합니다: ${track.theme}`);
  assert.equal(profile.chordRoots.length >= 8, true, `화성 진행은 최소 8마디 변주를 가져야 합니다: ${track.theme}`);
  assert.equal(profile.orchestration.stringGain > 0, true, `스트링 레이어가 누락됐습니다: ${track.theme}`);
  assert.equal(profile.orchestration.pulseGain > 0, true, `펄스 레이어가 누락됐습니다: ${track.theme}`);
  assert.equal(profile.orchestration.cymbalGain > 0, true, `심벌 레이어가 누락됐습니다: ${track.theme}`);
  assert.equal(profile.orchestration.ghostGain > 0, true, `고스트 스네어 레이어가 누락됐습니다: ${track.theme}`);
  assert.equal(
    profile.arrangement.some((section) => Array.isArray(section.leadSequence)),
    true,
    `마디별 주제 변주가 누락됐습니다: ${track.theme}`,
  );
  assert.equal(
    profile.arrangement.some((section) => Number(section.keyShift || 0) > 0),
    true,
    `후반 조성 이동이 누락됐습니다: ${track.theme}`,
  );
  const energies = profile.arrangement.map((section) => Number(section.energy || 0));
  assert.equal(
    Math.max(...energies) - Math.min(...energies) >= 0.5,
    true,
    `구간별 에너지 대비가 부족합니다: ${track.theme}`,
  );
  const loopSeconds = (profile.steps / 16) * 4 * (60 / profile.bpm);
  assert.equal(loopSeconds >= 65, true, `게임 BGM 루프가 너무 짧습니다: ${track.theme}`);
}

const scenes = soundtrack.DUAL_ACADEMY_BGM_SCENES;
const resolve = soundtrack.resolveDualAcademyBgmScene;
const duel = ({
  chain = 0,
  enemyLp = 8000,
  phase = 'MAIN1',
  playerLp = 8000,
  prompt = 'NONE',
  turn = 1,
  winner = '',
} = {}) => ({
  chain: Array.from({ length: chain }),
  phase,
  players: { player: { lp: playerLp }, enemy: { lp: enemyLp } },
  prompt: { kind: prompt },
  turn,
  winner,
});

assert.equal(resolve({ activeTabId: 'board', state: duel() }), scenes.ready);
assert.equal(resolve(), scenes.ready);
assert.equal(resolve({ activeTabId: 'board', state: duel({ turn: 2 }) }), scenes.main);
assert.equal(resolve({ activeTabId: 'logs', state: duel({ turn: 2 }) }), scenes.ready);
assert.equal(resolve({ activeTabId: 'board', state: duel({ phase: 'BATTLE', turn: 3 }) }), scenes.battle);
assert.equal(resolve({ activeTabId: 'board', state: duel({ chain: 2, turn: 3 }) }), scenes.chain);
assert.equal(resolve({ activeTabId: 'board', state: duel({ prompt: 'RESPOND', turn: 3 }) }), scenes.chain);
assert.equal(resolve({ activeTabId: 'board', state: duel({ playerLp: 2200, turn: 3 }) }), scenes.danger);
assert.equal(resolve({ activeTabId: 'board', state: duel({ turn: 7 }) }), scenes.danger);
assert.equal(resolve({ activeTabId: 'board', state: duel({ winner: 'player' }) }), scenes.victory);
assert.equal(resolve({ activeTabId: 'board', state: duel({ winner: 'enemy' }) }), scenes.defeat);

assert.deepEqual(soundtrack.dualAcademyResultMusic('tcgStart'), { theme: scenes.ready, durationMs: 8_000 });
assert.deepEqual(soundtrack.dualAcademyResultMusic('tcgSummon'), { theme: scenes.main, durationMs: 7_000 });
assert.deepEqual(soundtrack.dualAcademyResultMusic('tcgAttack'), { theme: scenes.battle, durationMs: 9_000 });
assert.deepEqual(soundtrack.dualAcademyResultMusic('tcgChain'), { theme: scenes.chain, durationMs: 10_000 });
assert.deepEqual(soundtrack.dualAcademyResultMusic('tcgDamage'), { theme: scenes.danger, durationMs: 10_000 });
assert.deepEqual(soundtrack.dualAcademyResultMusic('tcgMikaBurst'), { theme: scenes.mika, durationMs: 12_000 });
assert.deepEqual(soundtrack.dualAcademyResultMusic('tcgHinaDiscipline'), { theme: scenes.hina, durationMs: 12_000 });
assert.deepEqual(soundtrack.dualAcademyResultMusic('tcgYuukaGuard'), { theme: scenes.yuuka, durationMs: 12_000 });
assert.deepEqual(soundtrack.dualAcademyResultMusic('tcgVictory'), { theme: scenes.victory, durationMs: 18_000 });
assert.deepEqual(soundtrack.dualAcademyResultMusic('tcgDefeat'), { theme: scenes.defeat, durationMs: 16_000 });
assert.equal(soundtrack.dualAcademyResultMusic('tcgInvalid'), null);

assert.match(pageSource, /useGameBgm/, 'Dual Academy 페이지가 동적 음악 공급자를 사용해야 합니다.');
assert.match(pageSource, /resolveDualAcademyBgmScene/, '탭과 듀얼 상태가 기본 음악 장면에 연결되어야 합니다.');
assert.match(pageSource, /dualAcademyResultMusic/, '듀얼 결과가 임시 음악 장면에 연결되어야 합니다.');
assert.match(pageSource, /cue \? dualAcademyResultMusic/, '실제 피드백 이벤트만 임시 음악을 재생해야 합니다.');
assert.match(pageSource, /setMusicScene\(musicTransition\.theme\)/, '듀얼 장면 전환이 BGM 공급자에 전달되어야 합니다.');
assert.match(themeSource, /\['dual-academy-tcg', 'academy-duel'\]/, '공용 카드 음향을 Dual Academy 전용 테마로 분리해야 합니다.');
assert.match(soundSource, /'academy-duel': \{ panSpread: 0\.56, reverb: 0\.2 \}/, '전용 스테레오 공간 음향 설정이 필요합니다.');

for (const cue of [
  'tcgStart', 'tcgDraw', 'tcgSummon', 'tcgSet', 'tcgEffect', 'tcgChain',
  'tcgAttack', 'tcgHit', 'tcgDamage', 'tcgDestroy', 'tcgNegate',
  'tcgMikaCost', 'tcgMikaNegate', 'tcgMikaBurst', 'tcgHinaDiscipline',
  'tcgHinaRecover', 'tcgYuukaGuard', 'tcgYuukaSearch', 'tcgPosition',
  'tcgPhase', 'tcgTurn', 'tcgPrompt', 'tcgInvalid', 'tcgVictory', 'tcgDefeat',
]) {
  assert.match(soundSource, new RegExp(`\\n    ${cue}: \\[`), `${cue} 전용 다층 효과음이 있어야 합니다.`);
}
for (const icon of soundtrack.DUAL_ACADEMY_SOUNDTRACK.map((track) => track.icon)) {
  assert.match(iconSource, new RegExp(`\\n  ['"]?${icon}['"]?: `), `${icon} 장면 아이콘 매핑이 있어야 합니다.`);
}

console.log(`Dual Academy soundtrack checks passed (${soundtrack.DUAL_ACADEMY_SOUNDTRACK.length} tracks).`);
