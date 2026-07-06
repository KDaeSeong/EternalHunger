'use client';

import { SmallStat } from '../../_components/GamePlayPrimitives';
import { SIDE_LABELS, cardName, getCard } from '../_lib/baVanguardCatalog';

function unitPower(unit) {
  if (!unit) return 0;
  const card = getCard(unit.cardId);
  return Number(card?.power || 0) + Number(unit.powerMod || 0);
}

function typeLabel(type) {
  return {
    starter: '스타터',
    trigger: '트리거',
    sentinel: '센티넬',
    normal: '노멀',
    'g-unit': 'G 유닛',
    'g-guardian': 'G 가디언',
  }[type] || type;
}

export function roomConcurrencyAudit({ roomId, room, localRoomDirty, roomSyncMessage, roomBusy }) {
  const connected = Boolean(roomId);
  const revision = Number(room?.revision);
  const hasRevision = !connected || Number.isFinite(revision);
  const message = String(roomSyncMessage || '');
  const conflictDetected = /새 상태|새 매치|충돌|conflict|revision|409/i.test(message);
  const rows = [
    {
      id: 'room',
      label: '방 연결',
      status: connected ? '공유방' : '단독',
      detail: connected ? `roomId ${roomId}로 Vanguard 플레이테스트 상태를 공유합니다.` : '단독 플레이입니다. 방 저장 충돌 대상이 없습니다.',
      ok: true,
    },
    {
      id: 'revision',
      label: 'Revision 저장',
      status: hasRevision ? 'OK' : '대기',
      detail: connected ? `방 저장 요청에 revision ${Number.isFinite(revision) ? revision : '미수신'}을 함께 보냅니다.` : '단독 플레이에서는 revision 저장이 필요하지 않습니다.',
      ok: hasRevision,
    },
    {
      id: 'local',
      label: '로컬 변경',
      status: localRoomDirty ? '저장 필요' : 'OK',
      detail: localRoomDirty ? '로컬 변경이 방 상태에 아직 반영되지 않았습니다.' : '로컬 상태와 방 상태가 정리되어 있습니다.',
      ok: !localRoomDirty,
    },
    {
      id: 'conflict',
      label: '충돌 감지',
      status: conflictDetected ? '확인 필요' : 'OK',
      detail: conflictDetected ? message : '새 방 상태가 있으면 자동/수동 불러오기 메시지로 알려줍니다.',
      ok: !conflictDetected,
    },
    {
      id: 'busy',
      label: '저장 처리',
      status: roomBusy ? '처리 중' : 'OK',
      detail: roomBusy ? '방 저장/불러오기 요청을 처리 중입니다.' : '현재 방 요청 대기열이 비어 있습니다.',
      ok: !roomBusy,
    },
  ];
  const okRows = rows.filter((row) => row.ok);
  return {
    rows,
    ready: okRows.length === rows.length,
    completionPct: Math.round((okRows.length / rows.length) * 100),
    headline: connected
      ? `revision ${Number.isFinite(revision) ? revision : '대기'} · ${localRoomDirty ? '로컬 변경 있음' : '동기화됨'}`
      : '단독 플레이 · 충돌 없음',
  };
}

export function CardSummary({ cardId, right, active, onClick }) {
  const card = getCard(cardId);
  if (!card) return null;
  const content = (
    <>
      <div>
        <span>G{card.grade} · {typeLabel(card.type)}{card.trigger ? ` · ${card.trigger}` : ''}</span>
        <strong>{card.name}</strong>
        <small>{card.text}</small>
      </div>
      <strong>{right || Number(card.power || card.shield || 0).toLocaleString('ko-KR')}</strong>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className="game-save-row"
        onClick={onClick}
        style={{
          borderColor: active ? '#38bdf8' : undefined,
          boxShadow: active ? '0 0 0 2px rgba(56, 189, 248, 0.22)' : undefined,
          textAlign: 'left',
          width: '100%',
        }}
      >
        {content}
      </button>
    );
  }
  return <article className="game-save-row">{content}</article>;
}

export function DeckEntryLine({ cardId, count }) {
  const card = getCard(cardId);
  if (!card) return null;
  return (
    <article className="game-save-row">
      <div>
        <span>G{card.grade} · {typeLabel(card.type)}</span>
        <strong>{card.name}</strong>
      </div>
      <strong>{count}</strong>
    </article>
  );
}

const ZONE_LABELS = {
  deck: '덱',
  hand: '패',
  soul: '소울',
  damage: '데미지',
  drop: '드롭',
  removed: '제외',
  gzone: 'G존',
};

function ZonePill({ label, value, active, onClick }) {
  if (onClick) {
    return (
      <button
        type="button"
        className="games-filter-chip"
        onClick={onClick}
        aria-pressed={active}
        style={{
          borderColor: active ? '#38bdf8' : undefined,
          color: active ? '#e0f2fe' : undefined,
          cursor: 'pointer',
        }}
      >
        {label} {value}
      </button>
    );
  }
  return <span className="games-filter-chip">{label} {value}</span>;
}

function zoneCardIds(player, zoneKey) {
  const cards = player?.[zoneKey];
  return Array.isArray(cards) ? cards : [];
}

export function ZoneExplorer({ duel, zoneView, gzoneFilter, onFilterChange, onClose }) {
  if (!zoneView) return null;
  const player = duel.players[zoneView.side];
  const cards = zoneCardIds(player, zoneView.zone);
  const filteredCards = zoneView.zone === 'gzone' && gzoneFilter !== 'all'
    ? cards.filter((cardId) => {
      const type = getCard(cardId)?.type;
      return gzoneFilter === 'unit' ? type === 'g-unit' : type === 'g-guardian';
    })
    : cards;
  const shownCards = [...filteredCards].reverse();
  const damageCards = zoneCardIds(player, 'damage');
  const cbUsed = zoneView.zone === 'damage' ? Math.max(0, Math.min(damageCards.length, Number(player.cbUsedTotal || 0))) : 0;
  const sideLabel = SIDE_LABELS[zoneView.side];
  const zoneLabel = ZONE_LABELS[zoneView.zone] || zoneView.zone;

  return (
    <section className="games-panel">
      <div className="games-panel-title">
        <h2>{sideLabel} {zoneLabel}</h2>
        <span>{shownCards.length}/{cards.length}장</span>
      </div>
      <div className="game-save-actions" style={{ marginBottom: 12 }}>
        {zoneView.zone === 'gzone' ? (
          <>
            <button type="button" onClick={() => onFilterChange('all')} disabled={gzoneFilter === 'all'}>전체</button>
            <button type="button" onClick={() => onFilterChange('unit')} disabled={gzoneFilter === 'unit'}>G 유닛</button>
            <button type="button" onClick={() => onFilterChange('guardian')} disabled={gzoneFilter === 'guardian'}>G 가디언</button>
          </>
        ) : null}
        <button type="button" onClick={onClose}>닫기</button>
      </div>
      <div className="game-save-list">
        {shownCards.length ? shownCards.map((cardId, index) => {
          const originalIndex = zoneView.zone === 'damage' ? cards.length - 1 - index : -1;
          const right = zoneView.zone === 'damage' && originalIndex < cbUsed ? 'CB' : undefined;
          return <CardSummary cardId={cardId} right={right} key={`${zoneView.side}-${zoneView.zone}-${cardId}-${index}`} />;
        }) : (
          <div className="game-save-row">
            <div><strong>표시할 카드가 없습니다.</strong></div>
            <strong>-</strong>
          </div>
        )}
      </div>
    </section>
  );
}

export function Field({ title, player, side, selectedAttacker, zoneView, onCircleClick, onZoneClick }) {
  const rows = [
    ['RC_BL', 'RC_BC', 'RC_BR'],
    ['RC_FL', 'VC', 'RC_FR'],
  ];
  const zoneActive = (zone) => zoneView?.side === side && zoneView?.zone === zone;
  return (
    <section className="games-panel">
      <div className="games-panel-title">
        <h2>{title}</h2>
        <span>{player.isStrided ? 'STRIDE' : 'NORMAL'}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <ZonePill label="덱" value={zoneCardIds(player, 'deck').length} active={zoneActive('deck')} onClick={() => onZoneClick(side, 'deck')} />
        <ZonePill label="패" value={zoneCardIds(player, 'hand').length} />
        <ZonePill label="소울" value={zoneCardIds(player, 'soul').length} active={zoneActive('soul')} onClick={() => onZoneClick(side, 'soul')} />
        <ZonePill label="데미지" value={zoneCardIds(player, 'damage').length} active={zoneActive('damage')} onClick={() => onZoneClick(side, 'damage')} />
        <ZonePill label="드롭" value={zoneCardIds(player, 'drop').length} active={zoneActive('drop')} onClick={() => onZoneClick(side, 'drop')} />
        <ZonePill label="제외" value={zoneCardIds(player, 'removed').length} active={zoneActive('removed')} onClick={() => onZoneClick(side, 'removed')} />
        <ZonePill label="G존" value={zoneCardIds(player, 'gzone').length} active={zoneActive('gzone')} onClick={() => onZoneClick(side, 'gzone')} />
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {rows.map((row) => (
          <div key={row.join('-')} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            {row.map((circle) => {
              const unit = player.circles[circle];
              const card = getCard(unit?.cardId);
              const selected = selectedAttacker === circle && side === 'me';
              const actionable = side === 'me' ? Boolean(unit) : true;
              return (
                <button
                  key={circle}
                  type="button"
                  onClick={() => actionable && onCircleClick(circle)}
                  className="game-save-row"
                  style={{
                    minHeight: 104,
                    alignItems: 'stretch',
                    borderColor: selected ? '#38bdf8' : undefined,
                    boxShadow: selected ? '0 0 0 2px rgba(56, 189, 248, 0.24)' : undefined,
                    textAlign: 'left',
                  }}
                >
                  <div>
                    <span>{circle} · {unit?.isRest ? 'REST' : 'STAND'}</span>
                    <strong>{card?.name || '빈 서클'}</strong>
                    {card ? <small>G{card.grade} · {typeLabel(card.type)} · P{unitPower(unit).toLocaleString('ko-KR')}</small> : null}
                  </div>
                  {circle === 'VC' && unit ? <strong>C{1 + Number(unit.critMod || 0)}</strong> : <strong>{unit ? '' : '-'}</strong>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

export function BattlePanel({ battle, selectedHandId, onGuardAdd, onGGuard, onGuardEnd }) {
  if (!battle) return null;
  return (
    <section className="games-panel">
      <div className="games-panel-title">
        <h2>배틀 처리</h2>
        <span>{SIDE_LABELS[battle.attackerSide]} 공격</span>
      </div>
      <div className="games-rank-split">
        <SmallStat label="공격" value={`${battle.attackerCircle}${battle.boosterCircle ? ` + ${battle.boosterCircle}` : ''}`} />
        <SmallStat label="방어" value={`${battle.defenderCircle}`} />
        <SmallStat label="가드 실드" value={battle.guardShield.toLocaleString('ko-KR')} />
        <SmallStat label="완전 가드" value={battle.perfectGuard ? 'YES' : 'NO'} />
      </div>
      {battle.defenderSide === 'me' ? (
        <div className="game-save-actions" style={{ marginTop: 12 }}>
          <button type="button" onClick={onGGuard}>G 가디언</button>
          <button type="button" onClick={onGuardAdd} disabled={!selectedHandId}>선택 카드 가드</button>
          <button type="button" onClick={onGuardEnd}>가드 종료</button>
        </div>
      ) : <p style={{ color: '#cbd5e1', fontWeight: 800 }}>AI가 자동으로 가드를 처리합니다.</p>}
      <div className="games-activity-list" style={{ marginTop: 12 }}>
        {battle.note.length ? battle.note.map((row, index) => <div key={`${row}-${index}`}><strong>{row}</strong></div>) : <div><strong>아직 처리 메모가 없습니다.</strong></div>}
        {battle.driveChecks.length ? <div><strong>드라이브 체크: {battle.driveChecks.map(cardName).join(', ')}</strong></div> : null}
        {battle.damageChecks.length ? <div><strong>데미지 체크: {battle.damageChecks.map(cardName).join(', ')}</strong></div> : null}
      </div>
    </section>
  );
}
