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

function zoneCardStats(cards = []) {
  const rows = cards.map(getCard).filter(Boolean);
  const totalPower = rows.reduce((sum, card) => sum + Number(card.power || 0), 0);
  const totalShield = rows.reduce((sum, card) => sum + Number(card.shield || 0), 0);
  const triggerBreakdown = rows.reduce((acc, card) => {
    if (card.trigger) acc[card.trigger] = (acc[card.trigger] || 0) + 1;
    return acc;
  }, {});
  const typeBreakdown = rows.reduce((acc, card) => {
    const key = card.type || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const gradeBreakdown = rows.reduce((acc, card) => {
    const key = `G${Number(card.grade || 0)}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return {
    rows,
    triggers: rows.filter((card) => card.type === 'trigger').length,
    sentinels: rows.filter((card) => card.type === 'sentinel').length,
    grade3Plus: rows.filter((card) => Number(card.grade || 0) >= 3).length,
    gUnits: rows.filter((card) => card.type === 'g-unit').length,
    gGuardians: rows.filter((card) => card.type === 'g-guardian').length,
    triggerBreakdown,
    typeBreakdown,
    gradeBreakdown,
    totalPower,
    totalShield,
  };
}

function formatBreakdown(entries, labeler = (key) => key) {
  const rows = Object.entries(entries || {})
    .filter(([, count]) => Number(count || 0) > 0)
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  if (!rows.length) return '-';
  return rows.map(([key, count]) => `${labeler(key)} ${count}`).join(' · ');
}

function triggerLabel(trigger) {
  return {
    critical: '크리',
    draw: '드로우',
    stand: '스탠드',
    heal: '힐',
  }[trigger] || trigger;
}

function typeBreakdownLabel(type) {
  return typeLabel(type);
}

function zoneBreakdownRows(zone, cards, filteredCards) {
  const stats = zoneCardStats(cards);
  const filtered = zoneCardStats(filteredCards);
  const rows = [
    { label: '그레이드', value: formatBreakdown(filtered.gradeBreakdown) },
    { label: '타입', value: formatBreakdown(filtered.typeBreakdown, typeBreakdownLabel) },
  ];
  if (stats.triggers || filtered.triggers) {
    rows.push({ label: '트리거', value: formatBreakdown(filtered.triggerBreakdown, triggerLabel) });
  }
  if (zone === 'gzone') {
    rows.push({ label: '전체 G존', value: `G유닛 ${stats.gUnits} · G가디언 ${stats.gGuardians}` });
  }
  return rows;
}

function zoneInsightRows(zone, cards, filteredCards, cbUsed) {
  const stats = zoneCardStats(cards);
  const filtered = zoneCardStats(filteredCards);
  if (zone === 'damage') {
    const cbAvailable = Math.max(0, cards.length - cbUsed);
    return [
      { label: '피해', value: `${cards.length}/6` },
      { label: 'CB 가능', value: cbAvailable },
      { label: 'CB 사용', value: cbUsed },
      { label: '트리거', value: stats.triggers },
    ];
  }
  if (zone === 'gzone') {
    return [
      { label: 'G 유닛', value: stats.gUnits },
      { label: 'G 가디언', value: stats.gGuardians },
      { label: '필터', value: filtered.rows.length },
      { label: '총 실드', value: filtered.totalShield.toLocaleString('ko-KR') },
    ];
  }
  if (zone === 'deck') {
    return [
      { label: '남은 덱', value: cards.length },
      { label: '트리거', value: stats.triggers },
      { label: '센티넬', value: stats.sentinels },
      { label: 'G3+', value: stats.grade3Plus },
    ];
  }
  if (zone === 'drop') {
    return [
      { label: '드롭', value: cards.length },
      { label: '실드 총합', value: stats.totalShield.toLocaleString('ko-KR') },
      { label: '트리거', value: stats.triggers },
      { label: 'G3+', value: stats.grade3Plus },
    ];
  }
  if (zone === 'soul') {
    return [
      { label: '소울', value: cards.length },
      { label: 'G3+', value: stats.grade3Plus },
      { label: '파워 합', value: stats.totalPower.toLocaleString('ko-KR') },
      { label: 'VC 비용', value: cards.length ? '가능' : '부족' },
    ];
  }
  return [
    { label: ZONE_LABELS[zone] || zone, value: cards.length },
    { label: '트리거', value: stats.triggers },
    { label: '실드 총합', value: stats.totalShield.toLocaleString('ko-KR') },
    { label: 'G3+', value: stats.grade3Plus },
  ];
}

function zoneInsightText(zone, cards, cbUsed) {
  if (zone === 'damage') {
    if (cards.length >= 5) return '다음 히트가 패배로 이어질 수 있습니다. 가드와 G가디언 우선순위를 높게 잡아야 합니다.';
    return `카운터블라스트 가능 수는 ${Math.max(0, cards.length - cbUsed)}장입니다. VC/G가디언 비용을 쓰기 전에 남은 피해를 확인하세요.`;
  }
  if (zone === 'gzone') {
    const stats = zoneCardStats(cards);
    if (!stats.gUnits) return '사용 가능한 G 유닛이 없습니다. 스트라이드 압박보다 일반 라이드/리어가드 전개를 봐야 합니다.';
    return `스트라이드 후보 ${stats.gUnits}장, G가디언 ${stats.gGuardians}장입니다. 공격 전환과 생존 자원을 같이 확인하세요.`;
  }
  if (zone === 'deck') {
    if (cards.length <= 8) return '덱이 얼마 남지 않았습니다. 장기전보다 빠른 마무리와 드라이브 체크 리스크 관리가 필요합니다.';
    return '남은 덱의 트리거와 센티넬 비율을 보고 공격 지속 여부를 판단하세요.';
  }
  if (zone === 'drop') return '드롭은 가디언 회수, 소울 이동, 후속 비용의 근거가 됩니다. G가디언/코스트 후보를 함께 확인하세요.';
  if (zone === 'soul') return '소울은 VC 스킬과 일부 G가디언 비용의 핵심 자원입니다. 비어 있으면 스킬 타이밍이 크게 줄어듭니다.';
  return `${ZONE_LABELS[zone] || zone}에 있는 카드와 자원 상태를 확인하세요.`;
}

function zoneAdviceRows(zone, cards, filteredCards, cbUsed) {
  const stats = zoneCardStats(cards);
  const filtered = zoneCardStats(filteredCards);
  const rows = [];
  if (zone === 'damage') {
    const cbAvailable = Math.max(0, cards.length - cbUsed);
    rows.push({
      title: cbAvailable > 0 ? '카운터블라스트 여유' : 'CB 고갈',
      detail: cbAvailable > 0
        ? `${cbAvailable}장 사용 가능합니다. VC 스킬 또는 G가디언 비용을 쓸 수 있습니다.`
        : '현재 데미지존에서 바로 쓸 수 있는 CB가 없습니다. 비용 스킬은 보수적으로 봐야 합니다.',
    });
    if (stats.triggers > 0) rows.push({ title: '공개 트리거', detail: `데미지에 트리거가 ${stats.triggers}장 빠졌습니다. 남은 덱 트리거 기대값을 낮춰 보세요.` });
    if (cards.length >= 5) rows.push({ title: '패배권', detail: '5데미지 이상입니다. 다음 공격은 숫자보다 완전가드/G가디언 우선입니다.' });
  } else if (zone === 'gzone') {
    rows.push({
      title: filtered.gUnits ? '공격 전환 가능' : '공격 G 유닛 부족',
      detail: filtered.gUnits ? `필터 내 스트라이드 후보 ${filtered.gUnits}장입니다.` : '현재 필터에는 스트라이드 후보가 없습니다.',
    });
    rows.push({
      title: filtered.gGuardians ? '방어 전환 가능' : 'G가디언 부족',
      detail: filtered.gGuardians ? `필터 내 G가디언 ${filtered.gGuardians}장, 실드 ${filtered.totalShield.toLocaleString('ko-KR')}입니다.` : 'G가디언 후보가 없으면 패 실드로 버텨야 합니다.',
    });
  } else if (zone === 'deck') {
    const triggerRate = cards.length ? Math.round((stats.triggers / cards.length) * 100) : 0;
    rows.push({ title: '트리거 기대값', detail: `남은 덱 트리거 ${stats.triggers}장, 비율 ${triggerRate}%입니다.` });
    if (cards.length <= 8) rows.push({ title: '덱 아웃 위험', detail: '드라이브 체크와 장기전을 줄이고 이번 턴 마무리 각을 우선하세요.' });
    if (stats.sentinels <= 1) rows.push({ title: '센티넬 부족', detail: `덱에 보이는 센티넬 후보가 ${stats.sentinels}장입니다. 방어 플랜을 과신하기 어렵습니다.` });
  } else if (zone === 'drop') {
    rows.push({ title: '재활용 후보', detail: `드롭의 G3+ ${stats.grade3Plus}장, 실드 총합 ${stats.totalShield.toLocaleString('ko-KR')}입니다.` });
    if (stats.sentinels > 0) rows.push({ title: '센티넬 회수 가치', detail: `센티넬 ${stats.sentinels}장이 드롭에 있습니다. 회수/재활용 효과의 우선 후보입니다.` });
  } else if (zone === 'soul') {
    rows.push({
      title: cards.length ? '스킬 비용 준비' : '소울 부족',
      detail: cards.length ? `${cards.length}장 보유 중입니다. VC 액트와 일부 방어 효과 비용을 확인하세요.` : '소울 비용 스킬은 아직 안정적으로 쓰기 어렵습니다.',
    });
    if (stats.grade3Plus > 0) rows.push({ title: '고등급 소울', detail: `G3+ ${stats.grade3Plus}장이 소울에 있습니다. 특정 조건형 스킬의 재료로 좋습니다.` });
  } else {
    rows.push({ title: '존 요약', detail: `${filtered.rows.length}장 표시 중, 실드 총합 ${filtered.totalShield.toLocaleString('ko-KR')}입니다.` });
  }
  return rows.slice(0, 4);
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
  const insightRows = zoneInsightRows(zoneView.zone, cards, filteredCards, cbUsed);
  const insightText = zoneInsightText(zoneView.zone, cards, cbUsed);
  const breakdownRows = zoneBreakdownRows(zoneView.zone, cards, filteredCards);
  const adviceRows = zoneAdviceRows(zoneView.zone, cards, filteredCards, cbUsed);

  return (
    <section className="games-panel">
      <div className="games-panel-title">
        <h2>{sideLabel} {zoneLabel}</h2>
        <span>{shownCards.length}/{cards.length}장</span>
      </div>
      <div className="games-rank-split games-rank-split--compact" style={{ marginBottom: 12 }}>
        {insightRows.map((row) => <SmallStat label={row.label} value={row.value} key={row.label} />)}
      </div>
      <div className="games-empty" style={{ textAlign: 'left', marginBottom: 12 }}>
        {insightText}
      </div>
      <div className="game-save-list" style={{ marginBottom: 12 }}>
        {breakdownRows.map((row) => (
          <article className="game-save-row" key={`${zoneView.zone}-${row.label}`}>
            <div>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </div>
          </article>
        ))}
      </div>
      <div className="game-save-list" style={{ marginBottom: 12 }}>
        {adviceRows.map((row) => (
          <article className="game-save-row" key={`${zoneView.zone}-${row.title}`}>
            <div>
              <span>판단 포인트</span>
              <strong>{row.title}</strong>
              <small>{row.detail}</small>
            </div>
          </article>
        ))}
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
