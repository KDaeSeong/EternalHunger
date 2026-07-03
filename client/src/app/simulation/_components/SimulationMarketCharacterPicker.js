'use client';

import { normalizeSatiety } from '../_lib/satietyRuntime';

export default function SimulationMarketCharacterPicker({
  selectedChar,
  selectedCharId,
  setSelectedCharId,
  survivors,
}) {
  return (
    <div className="market-row" style={{ marginTop: 10 }}>
      <div className="market-small">사용 캐릭터</div>
      <select value={selectedCharId} onChange={(e) => setSelectedCharId(e.target.value)} style={{ width: '100%' }}>
        <option value="">(선택)</option>
        {survivors.map((c) => (
          <option key={c._id} value={c._id}>{c.name}</option>
        ))}
      </select>
      {selectedChar ? (
        <div className="market-small" style={{ marginTop: 4 }}>
          HP {Math.round(Number(selectedChar.hp || 0))}/{Math.round(Number(selectedChar.maxHp || 100))}
          {' · '}포만감 {normalizeSatiety(selectedChar.satiety)}/100
        </div>
      ) : null}
    </div>
  );
}
