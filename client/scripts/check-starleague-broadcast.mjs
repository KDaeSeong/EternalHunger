import assert from 'node:assert/strict';
import {
  BUILD_DEFS,
  createNewState,
  getMatchArchiveRows,
  simulateSeasonAction,
} from '../src/app/games/myanimecraft/_lib/myAnimeCraftEngine.js';

const seasons = Array.from({ length: 16 }, (_, index) => simulateSeasonAction(createNewState({
  now: `2026-07-${String((index % 20) + 1).padStart(2, '0')}T00:00:00.000Z`,
  runId: `starleague-broadcast-check-${index}`,
})));
const matches = seasons.flatMap((state) => getMatchArchiveRows(state, 1000));
const sets = matches.flatMap((match) => match.sets || []);
const lines = sets.flatMap((setResult) => setResult.timeline || []);
const lineTexts = lines.map((line) => String(line.text || ''));
const normalizedLines = lineTexts.map((text) => (
  text.replace(/[A-Za-z가-힣0-9・._-]+(?=\(|은|는|이|가|을|를|와|과|의|,|\s)/g, '<명칭>')
));
const buildNames = sets.flatMap((setResult) => [
  setResult.homeBuildName,
  setResult.awayBuildName,
]).filter(Boolean);
const styleCounts = sets
  .flatMap((setResult) => [setResult.homeBuildStyle, setResult.awayBuildStyle])
  .reduce((out, style) => {
    out[style] = (out[style] || 0) + 1;
    return out;
  }, {});
const roleCounts = lines.reduce((out, line) => {
  out[line.caster] = (out[line.caster] || 0) + 1;
  return out;
}, {});
const poolCounts = BUILD_DEFS.reduce((out, build) => {
  const key = `${build.race}-${build.matchup}`;
  out[key] = (out[key] || 0) + 1;
  return out;
}, {});
const averageLinesPerSet = lines.length / Math.max(1, sets.length);

assert.ok(BUILD_DEFS.length >= 100, '스타리그 전체 빌드 풀은 100개 이상이어야 합니다.');
assert.ok(Object.keys(poolCounts).length >= 9, '세 종족의 주요 매치업 빌드 풀이 모두 있어야 합니다.');
for (const [pool, count] of Object.entries(poolCounts)) {
  assert.ok(count >= 10, `${pool} 빌드 풀은 최소 10개여야 합니다.`);
}
assert.ok(matches.length >= 700, '여러 시즌에서 충분한 경기 표본이 생성되어야 합니다.');
assert.ok(sets.length >= 2500, '중계 다양성을 검증할 충분한 세트 표본이 필요합니다.');
assert.ok(new Set(buildNames).size >= 90, '시뮬레이션에서 최소 90개 빌드가 실제 사용되어야 합니다.');
for (const style of ['rush', 'harass', 'macro', 'tech', 'balanced']) {
  assert.ok(styleCounts[style] >= 200, `${style} 빌드 성향이 충분히 등장해야 합니다.`);
}
assert.ok(averageLinesPerSet >= 15, '세트마다 개막부터 결과까지 최소 15줄 중계가 필요합니다.');
for (const role of ['캐스터', '해설', '해설 B', '데이터', '리플레이', '벤치']) {
  assert.ok(roleCounts[role] > 0, `${role} 역할의 중계가 생성되어야 합니다.`);
}
assert.ok(new Set(lineTexts).size >= 9000, '선수·맵·빌드 조합을 반영한 중계 문장 다양성이 부족합니다.');
assert.ok(new Set(normalizedLines).size >= 400, '이름을 제외한 중계 문장 골격도 충분히 다양해야 합니다.');

for (const setResult of sets) {
  const timeline = setResult.timeline || [];
  assert.ok(timeline.length >= 15, `세트 ${setResult.setNo || '?'}의 중계가 너무 짧습니다.`);
  assert.equal(Number(timeline[0]?.t || 0), 0, '중계는 경기 시작 시점부터 기록되어야 합니다.');
  assert.equal(
    Number(timeline.at(-1)?.t || 0),
    Number(setResult.durationSec || 0),
    '마지막 캐스터 멘트는 경기 종료 시점과 일치해야 합니다.',
  );
  for (let index = 1; index < timeline.length; index += 1) {
    assert.ok(
      Number(timeline[index].t || 0) >= Number(timeline[index - 1].t || 0),
      '중계 타임라인의 시간은 역행하면 안 됩니다.',
    );
  }
}

const visibleCommentary = lineTexts.join('\n');
assert.doesNotMatch(
  visibleCommentary,
  /내부|보정치|맵 보정|노이즈|예상 승률|승률 확률|데이터 체크/,
  '공개 중계에 시뮬레이터 내부 계산 용어를 노출하면 안 됩니다.',
);
assert.doesNotMatch(
  visibleCommentary,
  /이\(가\)|을\(를\)|은\(는\)|와\(과\)|노아이|노아은|운영와|동선와|전환가|Player [2459]은\b|Player [013678]는\b|Player [2459]이\b|Player [013678]가\b/,
  '중계 문장에 잘못된 조사나 병기형 조사가 남으면 안 됩니다.',
);

console.log(JSON.stringify({
  seasons: seasons.length,
  matches: matches.length,
  sets: sets.length,
  buildPool: BUILD_DEFS.length,
  matchupPools: poolCounts,
  uniqueBuildsUsed: new Set(buildNames).size,
  styleCounts,
  averageLinesPerSet: Number(averageLinesPerSet.toFixed(2)),
  uniqueExactLines: new Set(lineTexts).size,
  uniqueNormalizedLines: new Set(normalizedLines).size,
  roleCounts,
}, null, 2));