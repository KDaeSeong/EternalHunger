export function formatClock(totalSec) {
  const value = Number(totalSec || 0);
  // Display precision only: never feed rounded centiseconds back into the clock.
  const ticks = Math.round((Number.isFinite(value) ? Math.max(0, value) : 0) * 100);
  const minutes = Math.floor(ticks / 6000);
  const seconds = Math.floor(ticks / 100) % 60;
  const fraction = ticks % 100;
  const suffix = fraction ? `.${String(fraction).padStart(2, '0').replace(/0$/, '')}` : '';
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}${suffix}`;
}

export function waitMs(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, Math.max(0, Math.floor(Number(ms) || 0)));
  });
}

export function softenNonLethalBattleLog(s) {
  let t = String(s || '');
  t = t.split('💀').join('⚔️');
  t = t.replace(/완전히\s*분쇄했습니다!?/g, '압도적으로 제압했습니다!');
  t = t.replace(/을\(를\)\s*쓰러뜨리고\s*승리했습니다!?/g, '을(를) 제압하고 승리했습니다!');
  t = t.replace(/처치했습니다!?/g, '제압했습니다!');
  t = t.replace(/격파했습니다!?/g, '제압했습니다!');
  return t;
}
