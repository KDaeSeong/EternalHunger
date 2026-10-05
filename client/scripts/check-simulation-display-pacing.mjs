import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
const { createVisibleClockPacer } = await import('../src/app/simulation/_lib/visibleClockPacingRuntime.js');
const { beginSimulationPhase } = await import('../src/app/simulation/_lib/phasePreparationRuntime.js');
let checks = 0;
async function check(name, run) { await run(); checks++; console.log(`PASS ${name}`); }
function fixture() {
  let wall = 0, view = 'visible';
  const pacer = createVisibleClockPacer({ now: () => wall, visibility: () => view });
  return { pacer, get wall() { return wall; }, set wall(value) { wall = value; },
    set view(value) { view = value; }, step(elapsed, speed, work = 0, overshoot = 0) {
      wall += work;
      const wait = pacer.getDelayMs(elapsed, speed);
      wall += wait + overshoot;
      pacer.markCommitted();
      return wait;
    } };
}
await check('x32 credits calculation time instead of adding it to every wait', () => {
  const f = fixture();
  for (let i = 0; i < 60; i++) f.step(1, 32, 20);
  assert.equal(f.wall, 1875); // Old scheduling: (20 + 31) * 60 = 3060ms.
});
await check('all offered speeds use the same elapsed-time deadline', () => {
  for (const speed of [1, 2, 4, 8, 16, 32]) {
    const f = fixture();
    for (let i = 0; i < 32; i++) f.step(1, speed, 20);
    assert.equal(f.wall, 32000 / speed);
  }
});
await check('fractional combat intervals retain precision without timer rounding drift', () => {
  const f = fixture();
  for (let i = 0; i < 320; i++) f.step(0.1, 32, 1);
  assert.equal(f.wall, 1000);
});
await check('timer overshoot is credited to the next display interval', () => {
  const f = fixture();
  assert.equal(f.step(1, 32, 20, 5), 12);
  assert.equal(f.step(1, 32, 20), 6);
  assert.equal(f.wall, 63);
});
await check('overdue frames add no artificial sleep and recover without skipping time', () => {
  const f = fixture();
  assert.equal(f.step(1, 32, 80), 0);
  for (let i = 0; i < 7; i++) f.step(1, 32, 20);
  assert.equal(f.wall, 250);
});
await check('work above the available budget cannot claim a guaranteed x32', () => {
  const f = fixture();
  for (let i = 0; i < 8; i++) assert.equal(f.step(1, 32, 60), 0);
  assert.equal(f.wall, 480);
});
await check('long stalls discard display debt rather than causing a catch-up burst', () => {
  const f = fixture();
  assert.equal(f.step(1, 32, 2000), 0);
  assert.equal(f.step(1, 32, 20), 12);
});
await check('returning to a visible tab starts a fresh display interval', () => {
  const f = fixture(); f.step(1, 32, 20);
  f.view = 'hidden'; f.wall += 5000;
  assert.equal(f.step(1, 32), 32);
  f.view = 'visible';
  assert.equal(f.step(1, 32, 20), 32);
});
await check('speed changes are forward-only and still account for the next calculation', () => {
  const f = fixture(); f.step(1, 32, 20);
  assert.equal(f.step(1, 1, 20), 980);
  assert.equal(f.step(1, 32, 20), 12);
});
await check('zero or malformed elapsed time creates neither waiting nor display debt', () => {
  const f = fixture();
  for (const elapsed of [0, -1, NaN, Infinity]) assert.equal(f.step(elapsed, 32), 0);
  assert.equal(f.step(1, 32, 20), 12);
});
await check('headless checks retain nominal delay callbacks without a real timer', () => {
  const pacer = createVisibleClockPacer({ now: null });
  assert.equal(pacer.getDelayMs(0.5, 1), 500);
  assert.equal(pacer.getDelayMs(1, 32), 31);
  assert.equal(pacer.getDelayMs(0.000001, 32), 1);
});
await check('a nonfinite wall clock falls back safely and a backwards clock rebases', () => {
  const f = fixture(); f.wall = NaN; assert.equal(f.pacer.getDelayMs(1, 32), 31);
  f.wall = 100; assert.equal(f.pacer.getDelayMs(1, 32), 32);
  f.pacer.markCommitted(); f.wall = 50;
  assert.equal(f.pacer.getDelayMs(1, 32), 32);
});
await check('the real phase clock uses compensation while preserving every committed second', async () => {
  let wall = 0;
  const waits = [], clocks = [];
  const phase = beginSimulationPhase({ state: { day: 0, phase: 'night', matchSec: 0, settings: {}, autoSpeed: 32 },
    actions: { visibleClockNow: () => wall, visibleClockVisibility: () => 'visible',
      waitForVisibleTick: async (delay, clock) => { waits.push({ delay, ...clock }); wall += delay; },
      setMatchSec: value => clocks.push(value) } });
  for (let i = 0; i < 60; i++) { wall += 20; phase.reserveActionSecond(1); await phase.commitVisibleClock(); }
  assert.equal(wall, 1875);
  assert.deepEqual(clocks, Array.from({ length: 60 }, (_, i) => i + 1));
  assert.equal(waits.reduce((sum, row) => sum + row.elapsedSec, 0), 60);
  assert.equal(phase.currentActionSec(), 60);
});
await check('duplicate, fractional and unpaced commits retain the phase clock contract', async () => {
  let wall = 0;
  const waits = [], clocks = [];
  const phase = beginSimulationPhase({ state: { day: 0, phase: 'night', matchSec: 100, settings: {}, autoSpeed: 32 },
    actions: { visibleClockNow: () => wall, visibleClockVisibility: () => 'visible',
      waitForVisibleTick: async (delay, clock) => { waits.push({ delay, ...clock }); wall += delay; },
      setMatchSec: value => clocks.push(value) } });
  for (const delta of [0.5, 0, 0.25, 0.25]) { wall += 1; phase.reserveActionSecond(delta); await phase.commitVisibleClock(); }
  assert.deepEqual(clocks, [100.5, 100.5, 100.75, 101]);
  assert.deepEqual(waits.map(row => row.elapsedSec), [0.5, 0.25, 0.25]);
  wall += 5000; phase.reserveActionSecond(1); await phase.commitVisibleClock(undefined, { wait: false });
  assert.equal(waits.length, 3);
  wall += 20; phase.reserveActionSecond(1); await phase.commitVisibleClock();
  assert.equal(waits.at(-1).delay, 12);
});
await check('an overdue product frame never allocates an extra zero-delay timer', async () => {
  const originalWindow = globalThis.window;
  let wall = 0, timers = 0;
  globalThis.window = { setTimeout() { timers++; throw new Error('No artificial delay is due'); } };
  try {
    const phase = beginSimulationPhase({ state: { day: 0, phase: 'night', matchSec: 0, settings: {}, autoSpeed: 32 },
      actions: { visibleClockNow: () => wall } });
    wall = 80; phase.reserveActionSecond(1); await phase.commitVisibleClock();
    assert.equal(timers, 0); assert.equal(phase.currentActionSec(), 1);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
console.log(`DISPLAY_PACING_CHECKS ${checks}/${checks}`);

// Small, account-free browser timing fixture. The 20ms synthetic work is an
// async timer (not CPU burn). It does not claim full-match or rendering speed.
if (process.argv.includes('--preview')) {
  const source = readFileSync(new URL('../src/app/simulation/_lib/visibleClockPacingRuntime.js', import.meta.url), 'utf8');
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>표시 시계 배속 확인</title>
  <style>body{font:16px system-ui;background:#f0f5fa;color:#172638;margin:32px;line-height:1.7}main{max-width:760px;padding:24px;background:white;border-radius:16px}button{font:inherit;padding:10px 16px;background:#1766a8;color:white;border:0;border-radius:8px}td,th{text-align:left;padding:10px 18px;border-bottom:1px solid #dce5ee}output{display:block;margin:16px 0;white-space:pre-line}.note{color:#536478}</style></head><body><main><h1>32배속 표시 시계 확인</h1><p>경기 시간 60초 · 매 단계 합성 작업 20ms · x32</p><p class="note">실제 게임이나 CPU 성능 검사가 아닌, 실제 브라우저 타이머와 표시 시계 일정의 비교랍니다. 계정·저장·서버 API는 사용하지 않사와요.</p><button id="run">기존·수정 일정 비교</button><output id="status">준비됨</output><table><thead><tr><th>표시 일정</th><th>현실 경과</th><th>배속</th></tr></thead><tbody id="rows"></tbody></table></main>
  <script type="module">import {createVisibleClockPacer} from '/pacer.js';
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)), button=document.querySelector('#run'), status=document.querySelector('#status'), rows=document.querySelector('#rows');
  button.addEventListener('click',async()=>{button.disabled=true;rows.replaceChildren();
    try { for(const mode of ['기존 추가 대기','수정 계산 시간 포함']) {
      status.textContent=mode+' 진행 중 · 페이지 상태 '+document.visibilityState;
      const start=performance.now(), pacer=createVisibleClockPacer();
      for(let i=0;i<60;i++){await sleep(20);const delay=mode.startsWith('기존')?31:pacer.getDelayMs(1,32);if(delay>0)await sleep(delay);pacer.markCommitted();}
      const seconds=(performance.now()-start)/1000, row=document.createElement('tr');
      for(const text of [mode,seconds.toFixed(3)+'초',(60/seconds).toFixed(2)+'배']){const cell=document.createElement('td');cell.textContent=text;row.append(cell);}rows.append(row);
    } status.textContent='비교 완료 · 합성 작업 조건의 결과이며, 실제 전체 경기 속도는 별도 확인이 필요하답니다.';
    }catch(error){status.textContent='확인 실패: '+error.message;}finally{button.disabled=false;}
  });</script></body></html>`;
  createServer((request, response) => {
    response.setHeader('Content-Type', request.url === '/pacer.js' ? 'text/javascript' : 'text/html; charset=utf-8');
    response.end(request.url === '/pacer.js' ? source : html);
  }).listen(3118, '127.0.0.1', () => console.log('DISPLAY_PACING_PREVIEW http://127.0.0.1:3118/'));
}
