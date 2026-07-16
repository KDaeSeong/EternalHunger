import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rosterRuntimeSource = await readFile(new URL('../src/app/simulation/_lib/customRosterRuntime.js', import.meta.url), 'utf8');
const rosterRuntimeUrl = `data:text/javascript;base64,${Buffer.from(rosterRuntimeSource).toString('base64')}`;
const {
  CUSTOM_ROSTER_SIZE,
  validateCustomRosterDraft,
} = await import(rosterRuntimeUrl);

const ids = Array.from({ length: CUSTOM_ROSTER_SIZE }, (_, index) => `char-${index + 1}`);
const balancedTeams = Object.fromEntries(ids.map((id, index) => [id, Math.floor(index / 3) + 1]));

const squad = validateCustomRosterDraft({
  characterIds: ids,
  teamAssignments: balancedTeams,
}, {
  matchMode: 'squad',
  maxParticipants: 24,
  maxTeams: 8,
  teamSize: 3,
});
assert.equal(squad.ready, true, '24명과 8개 완성 스쿼드는 시작 가능해야 합니다.');
assert.equal(squad.selectedCount, 24);
assert.deepEqual(Object.values(squad.teamCounts), Array(8).fill(3));
assert.deepEqual(squad.orderedCharacterIds.slice(0, 3), ids.slice(0, 3));

const mixedOrder = [...ids].reverse();
const regrouped = validateCustomRosterDraft({
  characterIds: mixedOrder,
  teamAssignments: balancedTeams,
}, { matchMode: 'squad', maxParticipants: 24, maxTeams: 8, teamSize: 3 });
assert.equal(regrouped.ready, true);
assert.deepEqual(regrouped.orderedCharacterIds.slice(0, 3), ids.slice(0, 3).reverse(), '팀 번호로 먼저 묶고 팀 내부 선택 순서를 유지해야 합니다.');

const missingAssignment = { ...balancedTeams };
delete missingAssignment[ids[0]];
const invalidSquad = validateCustomRosterDraft({
  characterIds: ids,
  teamAssignments: missingAssignment,
}, { matchMode: 'squad', maxParticipants: 24, maxTeams: 8, teamSize: 3 });
assert.equal(invalidSquad.ready, false);
assert.ok(invalidSquad.errors.some((message) => message.includes('지정되지')));

const duplicateRoster = validateCustomRosterDraft({
  characterIds: [...ids.slice(0, 23), ids[0]],
  teamAssignments: balancedTeams,
}, { matchMode: 'squad', maxParticipants: 24, maxTeams: 8, teamSize: 3 });
assert.equal(duplicateRoster.selectedCount, 23);
assert.equal(duplicateRoster.ready, false, '중복 캐릭터로 24명을 채울 수 없어야 합니다.');

const solo = validateCustomRosterDraft({ characterIds: ids }, {
  matchMode: 'solo',
  maxParticipants: 24,
  maxTeams: 24,
  teamSize: 1,
});
assert.equal(solo.ready, true, '솔로는 팀 배정 없이 24명만 선택하면 시작 가능해야 합니다.');
assert.deepEqual(solo.orderedCharacterIds, ids);

const componentSource = await readFile(new URL('../src/app/simulation/_components/SimulationPregameRosterSetup.js', import.meta.url), 'utf8');
const actionSource = await readFile(new URL('../src/app/simulation/_lib/participantPresetActionRuntime.js', import.meta.url), 'utf8');
const presetSource = await readFile(new URL('../src/app/simulation/_lib/participantPresetRuntime.js', import.meta.url), 'utf8');
const screenSource = await readFile(new URL('../src/app/simulation/_components/SimulationGameScreen.js', import.meta.url), 'utf8');
const cssSource = await readFile(new URL('../src/styles/ERSimulation.css', import.meta.url), 'utf8');

assert.match(componentSource, /사용자 지정 24인 편성/);
assert.match(componentSource, /Array\.from\(\{ length: 8 \}/, '스쿼드 편집기는 8개 팀을 렌더링해야 합니다.');
assert.match(componentSource, /applyCustomParticipantRoster/);
assert.match(actionSource, /buildCustomParticipantsForRun/);
assert.match(actionSource, /writeLocalParticipantPresets\(nextPresets\)/, '마지막 직접 편성을 로컬 프리셋에 저장해야 합니다.');
assert.match(actionSource, /setWinnerPredictionId\(''\)/, '편성 변경 시 기존 승자 예측을 초기화해야 합니다.');
assert.match(presetSource, /CUSTOM_PARTICIPANT_PRESET_ID = '__custom__'/);
assert.match(presetSource, /custom \? \[custom, \.\.\.userPresets\]/, '직접 편성 슬롯은 일반 프리셋 제한과 분리해야 합니다.');
assert.match(screenSource, /participantSelectionMode/);
assert.match(cssSource, /\.simulation-roster-modal/);
assert.match(cssSource, /@media \(max-width: 760px\)/);

console.log(JSON.stringify({
  participantCount: 24,
  squadTeams: 8,
  squadSize: 3,
  duplicateGuard: true,
  soloCustomRoster: true,
  pregameEditor: true,
  persistentCustomSlot: true,
}, null, 2));
