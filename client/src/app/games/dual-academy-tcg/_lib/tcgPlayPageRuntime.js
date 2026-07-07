import { cardAtk, cardKind } from '../_components/TcgPlayBoard';

export function afterRender(task) {
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(task);
    return;
  }
  setTimeout(task, 0);
}

function zoneList(player, zone) {
  return Array.isArray(player?.[zone]) ? player[zone].filter(Boolean) : [];
}

function openSlotCount(player, zone) {
  return Array.isArray(player?.[zone]) ? player[zone].filter((card) => !card).length : 0;
}

function monsterScore(card) {
  if (!card) return 0;
  const health = Number(card.currentHealth ?? card.health ?? 0);
  return cardAtk(card) + health * 70 + Number(card.shield ? 180 : 0) + Number(card.hasAttacked ? -80 : 0);
}

function zonePreview(cards, hidden = false) {
  if (hidden) return '비공개 카드';
  const shown = cards.slice(0, 3).map((card) => card?.name || card?.id || '카드');
  return shown.length ? shown.join(' · ') : '표시할 카드 없음';
}

function inspectSide(player, label) {
  const monsters = zoneList(player, 'monster');
  const backrow = zoneList(player, 'spellTrap');
  const strongest = monsters.reduce((best, card) => (monsterScore(card) > monsterScore(best) ? card : best), null);
  const hand = zoneList(player, 'hand');
  const handProfile = hand.reduce((profile, card) => {
    const kind = cardKind(card);
    if (kind === 'Monster') profile.monsters += 1;
    if (kind === 'Spell') profile.spells += 1;
    if (kind === 'Trap') profile.traps += 1;
    return profile;
  }, { monsters: 0, spells: 0, traps: 0 });
  const power = Math.round(
    monsters.reduce((sum, card) => sum + monsterScore(card), 0)
    + backrow.length * 160
    + Number(player?.field ? 220 : 0)
    + Number(player?.lp || 0) / 35
  );
  return {
    label,
    lp: Number(player?.lp || 0),
    deck: zoneList(player, 'deck').length,
    hand: hand.length,
    grave: zoneList(player, 'grave').length,
    banished: zoneList(player, 'banished').length,
    monsters: monsters.length,
    backrow: backrow.length,
    fieldName: player?.field?.name || '필드 없음',
    strongestName: strongest?.name || '전투 몬스터 없음',
    openMonster: openSlotCount(player, 'monster'),
    openSpellTrap: openSlotCount(player, 'spellTrap'),
    handProfile,
    power,
  };
}

export function buildZoneInspection(state, turnAdvisor) {
  const player = state.players.player;
  const enemy = state.players.enemy;
  const playerSide = inspectSide(player, '내 필드');
  const enemySide = inspectSide(enemy, 'AI 필드');
  const boardDelta = playerSide.power - enemySide.power;
  const focusRows = [
    state.chain.length ? {
      id: 'chain',
      kind: '체인',
      title: `${state.chain.length}개 효과 대기`,
      detail: '체인 해결 전에는 보드 판단이 흔들립니다. 응답 또는 해결을 먼저 보세요.',
      level: 'high',
    } : null,
    state.prompt.kind !== 'NONE' ? {
      id: 'prompt',
      kind: '선택',
      title: state.prompt.title || state.prompt.kind,
      detail: '대상 선택이나 트리거 확인이 남아 있습니다. 전장 클릭 가능 표시를 먼저 확인하세요.',
      level: 'high',
    } : null,
    turnAdvisor.lethal?.lethal ? {
      id: 'lethal',
      kind: '킬각',
      title: `${turnAdvisor.lethal.damage} 피해 마무리 가능`,
      detail: `${turnAdvisor.lethal.attackerName || '공격 가능 몬스터'}로 직접 공격 각을 확인하세요.`,
      level: 'high',
    } : null,
    enemySide.monsters > playerSide.monsters ? {
      id: 'monster-gap',
      kind: '필드',
      title: `몬스터 수 열세 ${playerSide.monsters}:${enemySide.monsters}`,
      detail: '제거 효과, 세트 카드, 수비 표시 전환을 우선 검토하세요.',
      level: 'normal',
    } : null,
    playerSide.deck <= 5 ? {
      id: 'deck-low',
      kind: '덱',
      title: `덱 ${playerSide.deck}장 남음`,
      detail: '장기전보다 이번 턴 또는 다음 턴 마무리 루트를 우선 보세요.',
      level: 'normal',
    } : null,
    {
      id: 'advisor',
      kind: '권장',
      title: turnAdvisor.recommendedAction,
      detail: turnAdvisor.headline,
      level: turnAdvisor.riskLabel === '위험' ? 'high' : 'low',
    },
  ].filter(Boolean).slice(0, 6);
  const archiveRows = [
    { id: 'player-deck', label: '내 덱', player: 'player', zone: 'deck', reveal: true, count: playerSide.deck, preview: zonePreview(zoneList(player, 'deck')) },
    { id: 'player-grave', label: '내 묘지', player: 'player', zone: 'grave', reveal: true, count: playerSide.grave, preview: zonePreview([...zoneList(player, 'grave')].reverse()) },
    { id: 'player-banished', label: '내 제외', player: 'player', zone: 'banished', reveal: true, count: playerSide.banished, preview: zonePreview([...zoneList(player, 'banished')].reverse()) },
    { id: 'enemy-deck', label: 'AI 덱', player: 'enemy', zone: 'deck', reveal: false, count: enemySide.deck, preview: zonePreview(zoneList(enemy, 'deck'), true) },
    { id: 'enemy-grave', label: 'AI 묘지', player: 'enemy', zone: 'grave', reveal: true, count: enemySide.grave, preview: zonePreview([...zoneList(enemy, 'grave')].reverse()) },
    { id: 'enemy-banished', label: 'AI 제외', player: 'enemy', zone: 'banished', reveal: true, count: enemySide.banished, preview: zonePreview([...zoneList(enemy, 'banished')].reverse()) },
  ];
  return {
    boardDelta,
    badge: boardDelta > 250 ? '우세' : boardDelta < -250 ? '열세' : '균형',
    headline: boardDelta > 250
      ? '내 보드가 앞섭니다. 체인과 반격 카드만 조심하면 됩니다.'
      : boardDelta < -250
        ? 'AI 보드가 앞섭니다. 제거 효과나 수비 전환을 먼저 보세요.'
        : '보드가 팽팽합니다. 패/체인/묘지 자원이 승부를 가릅니다.',
    sideRows: [playerSide, enemySide],
    focusRows,
    archiveRows,
  };
}
