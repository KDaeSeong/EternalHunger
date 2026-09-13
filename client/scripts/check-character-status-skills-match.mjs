import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
await import('./generate-simulation-version.mjs');
const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { createSimulationRunInput, cloneReplayData, compareSimulationReplay } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');
const { saveGuestCharacterProfile, readGuestCharacterProfiles } = await import('../src/app/simulation/_lib/guestCharacterProfileRuntime.js');
const { buildGuestSimulationRoster } = await import('../src/app/simulation/_lib/guestSimulationBootstrap.js');
const store = new Map(); const storage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
const controls = ['기절', '속박', '침묵', '수면', '공포', '변이'];
for (const [index, actor] of buildGuestSimulationRoster().entries()) {
  const result = saveGuestCharacterProfile({ id: actor._id, name: `상태 편집 검사자 ${index + 1}`, characterSkills: {
    q: { enabled: true, type: index % 3 ? 'attack_skill' : 'basic_attack_enhance', name: `제어 Q ${index + 1}`, flatDamage: [12],
      cooldownSec: 10, castDelaySec: 0.5, recoveryDelaySec: 0.25, radius: index % 3 === 1 ? 1 : 0,
      statusEffects: [{ name: controls[index % controls.length], durationSec: 1.5, target: 'target' }] },
    w: { enabled: true, type: 'support_skill', name: `지원 W ${index + 1}`, cooldownSec: 12, castDelaySec: 0.25, recoveryDelaySec: 0.25,
      supportTargetScope: 'team', statusEffects: [{ name: index % 2 ? '해로운 효과 제거' : '회피', durationSec: index % 2 ? 0 : 1.5, target: 'target' }] },
  } }, storage);
  assert.equal(result.ok, true, result.errors?.join(' '));
}
const loaded = readGuestCharacterProfiles(storage); assert.equal(loaded.ok, true); assert.equal(loaded.profiles.length, 24);
const fixture = JSON.parse(await createRandomIsolationInput('authored-status-skills-1', { guestProfiles: loaded.profiles }));
const input = createSimulationRunInput({ ...fixture, activeMap: fixture.map, publicItems: fixture.items });
// A later edit cannot retroactively change the archived starting definitions.
saveGuestCharacterProfile({ ...loaded.profiles[0], name: '나중 수정', characterSkills: {} }, storage);
let apiCalls = 0; const originalFetch = globalThis.fetch;
globalThis.fetch = () => { apiCalls++; throw Error('Authored status skills must not require an account API.'); };
try {
  const first = await runRandomIsolationMatch(null, { savedInput: cloneReplayData(input) });
  const effects = first.events.filter((row) => row.kind === 'effect' && row.source === 'character_skill');
  assert.ok(effects.length > 0); assert.ok(effects.some((row) => row.effect === '해로운 효과 제거' && row.removedEffects?.length));
  assert.ok(effects.some((row) => row.effect === '수면' && row.outcome === 'applied'));
  const casts = new Map(first.events.filter((row) => row.kind === 'skill_cast').map((row) => [row.castId, row]));
  const cancelled = new Set(first.events.filter((row) => row.kind === 'skill_cancel').map((row) => row.castId));
  for (const event of effects) {
    assert.ok(casts.has(event.castId)); assert.ok(event.at.sec >= casts.get(event.castId).releaseAtSec);
    assert.equal(cancelled.has(event.castId), false); assert.equal(event.sourceActorId, casts.get(event.castId).who);
  }
  console.log(`CHARACTER_STATUS_SKILLS_ORIGINAL ${JSON.stringify({ ...first.evidence, effects: effects.length,
    cleanses: effects.filter((row) => row.removedEffects?.length).length })}`);
  const second = await runRandomIsolationMatch(null, { savedInput: cloneReplayData(input), noisy: true });
  const comparison = compareSimulationReplay({ events: first.events, finalFrame: first.finalFrame, random: first.evidence.random },
    { events: second.events, finalFrame: second.finalFrame, random: second.evidence.random });
  assert.equal(comparison.matched, true); assert.equal(first.evidence.frameDigest, second.evidence.frameDigest); assert.equal(apiCalls, 0);
  console.log(`CHARACTER_STATUS_SKILLS_MATCH ${JSON.stringify({ ...first.evidence, effects: effects.length, comparison, apiCalls })}`);
} finally { globalThis.fetch = originalFetch; }
