import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';

// Exercise actual dependencies as well as the phase function. Import-stripping
// previously hid integration errors and replaced production revival behavior.
const { runPhaseRevival } = await import('../src/app/simulation/_lib/phaseRevivalRuntime.js');
const { worldPhaseIndex: phaseIndex } = await import('../src/app/simulation/_lib/worldTime.js');

const reviveCfg = {
  corpseWindowSec: 30,
  corpseInteractSec: 5,
  autoCutoff: { day: 2, timeOfDay: 'night' },
  teamWipeProtectionCutoff: { day: 2, timeOfDay: 'day' },
  paidStart: { day: 3, timeOfDay: 'day' },
  paidCutoff: { day: 5, timeOfDay: 'day' },
  paidCostBase: 200,
  paidCostPerUse: 0,
  hpRatio: 0.65,
};

const mapObj = {
  zones: [
    { zoneId: 'alley' },
    { zoneId: 'temple' },
    { zoneId: 'hotel' },
  ],
};

function actor(id, teamId, fields = {}) {
  return {
    _id: id,
    name: id,
    teamId,
    teamName: teamId,
    hp: 100,
    maxHp: 100,
    zoneId: 'alley',
    ...fields,
  };
}

function runCase({ dead, survivors = [], day, phase, kiosks = [] }) {
  const logs = [];
  const events = [];
  let deadState = dead;
  const result = runPhaseRevival({
    state: {
      canReviveThisMatch: true,
      dead: deadState,
      forbiddenIds: new Set(),
      kiosks,
      mapObj,
      phaseIdxNow: phaseIndex(day, phase),
      phaseStartSec: 0,
      reviveCfg,
      survivors,
    },
    actions: {
      addLog: (msg, kind) => logs.push({ msg, kind }),
      emitRunEvent: (kind, payload) => events.push({ kind, payload }),
      setDead: (updater) => {
        deadState = typeof updater === 'function' ? updater(deadState) : updater;
      },
    },
  });
  return { result, logs, events, deadState, survivors };
}

{
  const dead = [actor('dead-a', 'A', { hp: 0, deadAtPhaseIdx: phaseIndex(2, 'morning') })];
  const out = runCase({ dead, day: 2, phase: 'morning' });
  assert.equal(out.result.revivedNow.length, 1, '2일차 낮까지는 전멸이어도 부활해야 합니다.');
  assert.equal(out.events[0]?.payload?.method, 'auto');
}

{
  const dead = [actor('dead-a', 'A', { hp: 0, deadAtPhaseIdx: phaseIndex(2, 'morning') })];
  const survivors = [actor('alive-a', 'A', { zoneId: 'temple' })];
  const out = runCase({ dead, survivors, day: 2, phase: 'night' });
  assert.equal(out.result.revivedNow.length, 1, '2일차 밤에는 팀 생존 시 자동 부활해야 합니다.');
  assert.equal(out.events[0]?.payload?.method, 'auto');
}

{
  const dead = [actor('dead-a', 'A', { hp: 0, deadAtPhaseIdx: phaseIndex(2, 'morning') })];
  const out = runCase({ dead, day: 2, phase: 'night' });
  assert.equal(out.result.revivedNow.length, 0, '2일차 밤 전멸 상태에서는 자동 부활하면 안 됩니다.');
}

{
  const dead = [actor('dead-a', 'A', { hp: 0, deadAtPhaseIdx: phaseIndex(2, 'night'), simCredits: 80 })];
  const survivors = [actor('alive-a', 'A', { zoneId: 'hotel', simCredits: 150 })];
  const out = runCase({ dead, survivors, day: 3, phase: 'morning', kiosks: [{ zoneId: 'hotel' }] });
  assert.equal(out.result.revivedNow.length, 1, '3일차 낮부터 키오스크 유료 부활이 가능해야 합니다.');
  assert.equal(out.events[0]?.payload?.method, 'kiosk_paid');
  assert.equal(out.result.revivedNow[0].zoneId, 'hotel');
  assert.equal(out.result.revivedNow[0].simCredits, 0, '사망자 크레딧이 먼저 차감되어야 합니다.');
  assert.equal(out.survivors[0].simCredits, 30, '부족분은 팀원 크레딧에서 차감되어야 합니다.');
}

{
  const dead = [actor('dead-a', 'A', { hp: 0, deadAtPhaseIdx: phaseIndex(4, 'night'), simCredits: 200 })];
  const survivors = [actor('alive-a', 'A', { zoneId: 'hotel', simCredits: 0 })];
  const out = runCase({ dead, survivors, day: 5, phase: 'morning', kiosks: [{ zoneId: 'hotel' }] });
  assert.equal(out.result.revivedNow.length, 1, '5일차 낮까지는 유료 부활이 가능해야 합니다.');
  assert.equal(out.events[0]?.payload?.method, 'kiosk_paid');
}

{
  const dead = [actor('dead-a', 'A', { hp: 0, deadAtPhaseIdx: phaseIndex(5, 'morning'), simCredits: 500 })];
  const survivors = [actor('alive-a', 'A', { zoneId: 'hotel', simCredits: 500 })];
  const out = runCase({ dead, survivors, day: 5, phase: 'night', kiosks: [{ zoneId: 'hotel' }] });
  assert.equal(out.result.revivedNow.length, 0, '5일차 밤 이후에는 부활하면 안 됩니다.');
}

console.log('[check:revive] 6 cases passed');
