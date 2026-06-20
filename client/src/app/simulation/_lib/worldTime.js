const TIME_OF_DAY_ORDER = { day: 0, night: 1 };

export function getTimeOfDayFromPhase(ph) {
  return ph === 'morning' ? 'day' : 'night';
}

export function worldTimeText(d, ph) {
  const tod = getTimeOfDayFromPhase(ph);
  const icon = tod === 'day' ? '🌞' : '🌙';
  const ko = tod === 'day' ? '낮' : '밤';
  return `${icon} ${d}일차 ${ko}`;
}

// 예) 2일차 낮 이후: isAtOrAfterWorldTime(day, phase, 2, 'day')
export function isAtOrAfterWorldTime(curDay, curPhase, reqDay, reqTimeOfDay = 'day') {
  const cd = Number(curDay || 0);
  const rd = Number(reqDay || 0);
  const cOrder = TIME_OF_DAY_ORDER[getTimeOfDayFromPhase(curPhase)] ?? 0;
  const rOrder = TIME_OF_DAY_ORDER[String(reqTimeOfDay)] ?? 0;
  if (cd > rd) return true;
  if (cd < rd) return false;
  return cOrder >= rOrder;
}

export function worldPhaseIndex(d, ph) {
  const dd = Math.max(0, Number(d || 0));
  const tod = getTimeOfDayFromPhase(ph);
  const base = Math.max(0, dd - 1) * 2;
  return base + (tod === 'night' ? 1 : 0);
}
