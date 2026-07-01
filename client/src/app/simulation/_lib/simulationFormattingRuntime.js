export function formatClock(totalSec) {
  const s = Math.max(0, Number(totalSec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
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
