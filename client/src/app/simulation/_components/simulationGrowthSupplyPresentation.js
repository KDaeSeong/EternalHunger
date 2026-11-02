const legacyFieldSupplyNote = '필드 공급처 없음 · 다른 조달 판단 필요';
const scopedFieldSupplyNote = '일반 필드 파밍 공급처 없음 · 자연 자원·거래 경로는 별도 판단';

// Compatibility presentation for existing observer notes. Keep model/replay text
// intact and retain any following issue warnings without interpreting supply.
export function presentGrowthSupplyNote(note) {
  if (typeof note !== 'string' || (note !== legacyFieldSupplyNote && !note.startsWith(legacyFieldSupplyNote + ' · '))) return note;
  return scopedFieldSupplyNote + note.slice(legacyFieldSupplyNote.length);
}
