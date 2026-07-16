export const GAME_SLUG = 'ba-vanguard';
export const QUICK_SAVE_SLOT = 'ba-vanguard-main';
export const SAVE_VERSION = 'ba-vanguard-v2';

export const DEFAULT_RULES = {
  mainSize: 50,
  triggerSize: 16,
  starterSize: 1,
  gZoneMax: 16,
  maxCopies: 4,
  recommendedGrade3: 8,
  minGGuardians: 2,
  allowMixedClan: false,
  firstTurnNoDraw: true,
};

export function normalizeRules(value = {}) {
  const numberKeys = ['mainSize', 'triggerSize', 'starterSize', 'gZoneMax', 'maxCopies', 'recommendedGrade3', 'minGGuardians'];
  const next = { ...DEFAULT_RULES };
  numberKeys.forEach((key) => {
    const raw = Number(value?.[key]);
    if (Number.isFinite(raw) && raw > 0) next[key] = Math.round(raw);
  });
  next.allowMixedClan = value?.allowMixedClan === undefined ? DEFAULT_RULES.allowMixedClan : Boolean(value.allowMixedClan);
  next.firstTurnNoDraw = value?.firstTurnNoDraw === undefined ? DEFAULT_RULES.firstTurnNoDraw : Boolean(value.firstTurnNoDraw);
  return next;
}

export const CIRCLES = ['RC_BL', 'RC_BC', 'RC_BR', 'RC_FL', 'VC', 'RC_FR'];
export const REAR_CIRCLES = ['RC_FL', 'RC_FR', 'RC_BL', 'RC_BR', 'RC_BC'];
export const PHASES = ['STAND', 'DRAW', 'MAIN', 'BATTLE', 'END'];

export const SIDE_LABELS = {
  me: '나',
  opp: 'AI',
};

const TYPE_LABELS = {
  starter: '스타터',
  trigger: '트리거',
  sentinel: '센티넬',
  normal: '노멀',
  'g-unit': 'G 유닛',
  'g-guardian': 'G 가디언',
};

const TRIGGER_LABELS = {
  critical: '크리티컬',
  draw: '드로우',
  stand: '스탠드',
  heal: '힐',
};

const CLANS = [
  {
    key: 'gehenna',
    label: 'Gehenna',
    tone: 'red',
    lead: 'Hina',
    support: 'Makoto',
    style: 'pressure',
  },
  {
    key: 'trinity',
    label: 'Trinity',
    tone: 'blue',
    lead: 'Mika',
    support: 'Nagisa',
    style: 'guard',
  },
  {
    key: 'millennium',
    label: 'Millennium',
    tone: 'violet',
    lead: 'Yuuka',
    support: 'Noa',
    style: 'combo',
  },
];

const CARD_SKINS = {
  gehenna: {
    ST_001: { name: '게헨나의 시작', text: '【스타터】\n(자동): 처음으로 라이드를 할 때, 소울로 들어간다.' },
    TR_CRITICAL: { name: '게헨나 크리티컬 트리거', text: '【트리거: 크리티컬】\n(트리거): +10000 / +1 크리티컬(VC에 적용).' },
    TR_DRAW: { name: '게헨나 드로우 트리거', text: '【트리거: 드로우】\n(트리거): +10000 / 1장 드로우.' },
    TR_STAND: { name: '게헨나 스탠드 트리거', text: '【트리거: 스탠드】\n(트리거): +10000 / 리어가드 1장 스탠드.' },
    TR_HEAL: { name: '게헨나 힐 트리거', text: '【트리거: 힐】\n(트리거): +10000 / 조건 충족 시 1데미지 회복(샌드박스).' },
    PG_001: { name: "센티널: '만마전 방어선'", text: '【센티널】\n(자동): 가드에 배치될 때 코스트로 패 1장을 버리면, 이번 전투에서 퍼펙트 가드.' },
    G1_001: { name: '아코 - 작전 지원', text: '【G1】\n(자동): 콜되었을 때 1장 드로우.' },
    G1_002: { name: '이오리 - 돌격', text: '【G1】\n(지속): 이 유닛이 공격할 때, 파워 +2000.' },
    G1_003: { name: '하루나 - 저격', text: '【G1】\n(기동)(턴1회): 패 1장을 버리면, 이 유닛의 파워 +5000.' },
    G2_001: { name: '아루 - 총괄', text: '【G2】\n(자동): 이 유닛이 공격할 때, 당신의 리어가드가 2장 이상이면 파워 +3000.' },
    G2_002: { name: '무츠키 - 폭파', text: '【G2】\n(자동): VC를 공격할 때, 파워 +5000.' },
    G2_003: { name: '치나츠 - 구급 지원', text: '【G2】\n(자동): 이 유닛이 공격할 때, 당신의 리어가드 1장을 선택해 파워 +3000.' },
    G3_001: { name: '히나 - 징벌의 선도부장', text: '【G3】\n(지속)(VC): 당신의 리어가드 1장당 이 유닛의 파워 +1000.' },
    G3_002: { name: '마코토 - 만마전의 수장', text: '【G3】\n(기동)(VC)(턴1회): 소울 1장을 드롭에 두면, 1장 드로우.' },
    GU_001: { name: "스트라이드: '선도부 총공격'", text: '【G유닛】(스트라이드)\n(자동)(VC): 공격할 때, 당신의 리어가드 1장당 파워 +3000.' },
    GU_002: { name: "스트라이드: '만마전의 협상'", text: '【G유닛】(스트라이드)\n(기동)(턴1회): 패 1장을 버리면, 이 유닛의 파워 +10000.' },
    GG_001: { name: "G가디언: '응급처치'", text: '【G가디언】(가디언)\n(자동): 배치될 때, 이 유닛의 실드 +5000.' },
    GG_002: { name: "G가디언: '방탄 진료실'", text: '【G가디언】(가디언)\n(지속): 이 유닛의 실드 +5000.' },
  },
  trinity: {
    ST_001: { name: '트리니티의 시작', text: '【스타터】\n(자동): 처음으로 라이드를 할 때, 소울로 들어간다.' },
    TR_CRITICAL: { name: '트리니티 크리티컬 트리거', text: '【트리거: 크리티컬】\n(트리거): +10000 / +1 크리티컬.' },
    TR_DRAW: { name: '트리니티 드로우 트리거', text: '【트리거: 드로우】\n(트리거): +10000 / 1장 드로우.' },
    TR_STAND: { name: '트리니티 스탠드 트리거', text: '【트리거: 스탠드】\n(트리거): +10000 / 리어가드 1장 스탠드.' },
    TR_HEAL: { name: '트리니티 힐 트리거', text: '【트리거: 힐】\n(트리거): +10000 / 조건 충족 시 1데미지 회복(샌드박스).' },
    PG_001: { name: "센티널: '성당의 수호'", text: '【센티널】\n(자동): 가드에 배치될 때 코스트로 패 1장을 버리면, 이번 전투에서 퍼펙트 가드.' },
    G1_001: { name: '노노미 - 지원 사격', text: '【G1】\n(자동): 콜되었을 때 1장 드로우.' },
    G1_002: { name: '아즈사 - 결의', text: '【G1】\n(지속): 이 유닛이 공격할 때 파워 +2000.' },
    G1_003: { name: '세이아 - 통찰', text: '【G1】\n(기동)(턴1회): 패 1장을 버리면, 1장 드로우.' },
    G2_001: { name: '하나에 - 교단의 지원', text: '【G2】\n(자동): VC를 공격할 때 파워 +3000.' },
    G2_002: { name: '코하루 - 응급', text: '【G2】\n(자동): 콜되었을 때, 소울 1장을 드롭에 두면 1장 드로우.' },
    G2_003: { name: '아즈사 - 침투', text: '【G2】\n(자동): VC를 공격할 때, 이 유닛의 파워 +5000.' },
    G3_001: { name: '미카 - 찬란한 결단', text: '【G3】\n(기동)(VC)(턴1회): 패 1장을 버리면, 이 턴 동안 파워 +10000.' },
    G3_002: { name: '나기사 - 티파티의 균형', text: '【G3】\n(지속)(VC): 당신의 손패가 5장 이상이면 파워 +5000.' },
    GU_001: { name: "스트라이드: '성가대 돌격'", text: '【G유닛】(스트라이드)\n(자동)(VC): 공격할 때, 내 손패가 4장 이상이면 파워 +10000.' },
    GU_002: { name: "스트라이드: '정의실현의 맹세'", text: '【G유닛】(스트라이드)\n(기동)(VC)(턴1회): 패 1장을 버리면, 이 턴 동안 파워 +10000.\n(지속)(VC): 내 리어가드가 3장 이상이면, 이 유닛은 ★(크리티컬)+1.' },
    GG_001: { name: "G가디언: '성당의 방패'", text: '【G가디언】(가디언)\n(지속): 이 유닛의 실드 +5000.' },
    GG_002: { name: "G가디언: '성역의 반증'", text: '【G가디언】(가디언)\n(자동): 배치될 때, 내 드롭 1장을 소울로 두면, 이 유닛의 실드 +10000.' },
  },
  millennium: {
    ST_001: { name: '밀레니엄의 시작', text: '【스타터】\n(자동): 처음으로 라이드를 할 때, 소울로 들어간다.' },
    TR_CRITICAL: { name: '밀레니엄 크리티컬 트리거', text: '【트리거: 크리티컬】\n(트리거): +10000 / +1 크리티컬.' },
    TR_DRAW: { name: '밀레니엄 드로우 트리거', text: '【트리거: 드로우】\n(트리거): +10000 / 1장 드로우.' },
    TR_STAND: { name: '밀레니엄 스탠드 트리거', text: '【트리거: 스탠드】\n(트리거): +10000 / 리어가드 1장 스탠드.' },
    TR_HEAL: { name: '밀레니엄 힐 트리거', text: '【트리거: 힐】\n(트리거): +10000 / 조건 충족 시 1데미지 회복(샌드박스).' },
    PG_001: { name: "센티널: '방벽 알고리즘'", text: '【센티널】\n(자동): 가드에 배치될 때 코스트로 패 1장을 버리면, 이번 전투에서 퍼펙트 가드.' },
    G1_001: { name: '노아 - 데이터 분석', text: '【G1】\n(자동): 콜되었을 때 1장 드로우.' },
    G1_002: { name: '아리스 - 포격', text: '【G1】\n(지속): 공격할 때 파워 +2000.' },
    G1_003: { name: '코타마 - 버프', text: '【G1】\n(기동)(턴1회): 패 1장을 버리면, 이 턴 동안 VC의 파워 +5000(샌드박스: VC에 +5000).' },
    G2_001: { name: '히비키 - 지원 포격', text: '【G2】\n(자동): VC를 공격할 때 파워 +3000.' },
    G2_002: { name: '치히로 - 통제', text: '【G2】\n(자동): 공격이 히트했을 때, 1장 드로우(샌드박스: 로그만).' },
    G2_003: { name: '히마리 - 연구 주도', text: '【G2】\n(자동): 이 유닛이 공격할 때, 당신의 뱅가드 파워 +3000.' },
    G3_001: { name: '유우카 - 재무 집행', text: '【G3】\n(기동)(VC)(턴1회): 소울 1장을 드롭에 두면, 이 턴 동안 파워 +10000.' },
    G3_002: { name: '노아 - 베리타스의 기록', text: '【G3】\n(지속)(VC): 내 패가 5장 이상이면 파워 +5000.\n(자동)(VC): 이 유닛이 공격할 때, 1장 드로우(샌드박스: 로그만).' },
    GU_001: { name: "스트라이드: '전술 슈퍼컴퓨팅'", text: '【G유닛】(스트라이드)\n(자동)(VC): 드라이브 체크에서 트리거가 공개되면, 이 유닛의 파워 +5000.' },
    GU_002: { name: "스트라이드: '세미나 긴급 동원'", text: '【G유닛】(스트라이드)\n(기동)(VC)(턴1회): 소울 1장을 드롭에 두면, 이 턴 동안 파워 +10000.\n(자동)(VC): 공격이 히트했을 때, 1장 드로우(샌드박스: 로그만).' },
    GG_001: { name: "G가디언: '방벽 전개'", text: '【G가디언】(가디언)\n(자동): 배치될 때, 이 유닛의 실드 +5000.' },
    GG_002: { name: "G가디언: '응급 패치'", text: '【G가디언】(가디언)\n(자동): 배치될 때, 내 패 1장을 버리면, 이 유닛의 실드 +10000.' },
  },
};

function applyCardSkins(clan, cards) {
  const prefix = `${clan.key.slice(0, 3).toUpperCase()}_`;
  const skins = CARD_SKINS[clan.key] || {};
  return cards.map((card) => {
    const suffix = card.id.startsWith(prefix) ? card.id.slice(prefix.length) : '';
    const skin = skins[suffix];
    if (!skin) return card;
    return {
      ...card,
      ...skin,
      tags: Array.from(new Set([...(card.tags || []), ...(skin.tags || [])])),
    };
  });
}

function clanCards(clan) {
  const prefix = clan.key.slice(0, 3).toUpperCase();
  return applyCardSkins(clan, [
    {
      id: `${prefix}_ST_001`,
      name: `${clan.label} Starter`,
      clan: clan.label,
      type: 'starter',
      grade: 0,
      power: 6000,
      shield: 0,
      text: 'First vanguard. First ride 이후 소울로 들어가는 시작 카드입니다.',
      tone: clan.tone,
      tags: ['starter', clan.style],
    },
    ...[
      ['critical', 'Critical Trigger'],
      ['draw', 'Draw Trigger'],
      ['stand', 'Stand Trigger'],
      ['heal', 'Heal Trigger'],
    ].map(([trigger, label]) => ({
      id: `${prefix}_TR_${trigger.toUpperCase()}`,
      name: `${clan.label} ${label}`,
      clan: clan.label,
      type: 'trigger',
      trigger,
      grade: 0,
      power: 5000,
      shield: 10000,
      text: `${label}. Drive/Damage check에서 VC에 +10000을 부여하고 트리거 효과를 처리합니다.`,
      tone: clan.tone,
      tags: ['trigger', trigger],
    })),
    {
      id: `${prefix}_PG_001`,
      name: `${clan.label} Perfect Guard`,
      clan: clan.label,
      type: 'sentinel',
      grade: 1,
      power: 7000,
      shield: 0,
      text: 'Sentinel. 패에서 1장을 버리고 한 번의 VC 공격을 완전히 막습니다.',
      tone: clan.tone,
      tags: ['sentinel', 'guard'],
    },
    {
      id: `${prefix}_G1_001`,
      name: `${clan.support} Tactical Aide`,
      clan: clan.label,
      type: 'normal',
      grade: 1,
      power: 8000,
      shield: 5000,
      text: '콜하면 전열을 보조하는 안정적인 Grade 1 유닛입니다.',
      tone: clan.tone,
      tags: ['grade1', 'draw'],
    },
    {
      id: `${prefix}_G1_002`,
      name: `${clan.label} Field Operator`,
      clan: clan.label,
      type: 'normal',
      grade: 1,
      power: 8000,
      shield: 5000,
      text: '같은 세로줄의 앞열 유닛을 부스트하는 기본 Grade 1입니다.',
      tone: clan.tone,
      tags: ['grade1', 'boost'],
    },
    {
      id: `${prefix}_G1_003`,
      name: `${clan.label} Reserve Student`,
      clan: clan.label,
      type: 'normal',
      grade: 1,
      power: 7000,
      shield: 5000,
      text: '50장 프리셋 구성을 위한 유연한 Grade 1 슬롯입니다.',
      tone: clan.tone,
      tags: ['grade1'],
    },
    {
      id: `${prefix}_G2_001`,
      name: `${clan.label} Frontliner`,
      clan: clan.label,
      type: 'normal',
      grade: 2,
      power: 10000,
      shield: 5000,
      text: 'VC를 공격할 때 이번 전투 동안 +3000을 받습니다.',
      tone: clan.tone,
      tags: ['grade2', 'attack'],
    },
    {
      id: `${prefix}_G2_002`,
      name: `${clan.label} Interceptor`,
      clan: clan.label,
      type: 'normal',
      grade: 2,
      power: 9000,
      shield: 5000,
      text: '방어 시 가드 수치로 활용하기 좋은 Grade 2 유닛입니다.',
      tone: clan.tone,
      tags: ['grade2', 'intercept'],
    },
    {
      id: `${prefix}_G2_003`,
      name: `${clan.label} Tactical Reserve`,
      clan: clan.label,
      type: 'normal',
      grade: 2,
      power: 9000,
      shield: 5000,
      text: '라이드 라인을 안정화하는 보조 Grade 2 슬롯입니다.',
      tone: clan.tone,
      tags: ['grade2'],
    },
    {
      id: `${prefix}_G3_001`,
      name: `${clan.lead} Vanguard`,
      clan: clan.label,
      type: 'normal',
      grade: 3,
      power: 13000,
      shield: 0,
      text: '메인 Grade 3 라이드 타깃입니다. 스트라이드 플랜을 여는 핵심 유닛입니다.',
      tone: clan.tone,
      tags: ['grade3', 'vanguard', clan.style],
    },
    {
      id: `${prefix}_G3_002`,
      name: `${clan.support} Grade 3`,
      clan: clan.label,
      type: 'normal',
      grade: 3,
      power: 13000,
      shield: 0,
      text: '보조 Grade 3 라이드 타깃입니다. 라이드 실패 확률을 줄여줍니다.',
      tone: clan.tone,
      tags: ['grade3', 'backup'],
    },
    {
      id: `${prefix}_GU_001`,
      name: `${clan.label} Stride Unit`,
      clan: clan.label,
      type: 'g-unit',
      grade: 4,
      power: 15000,
      shield: 0,
      text: 'Stride. 공격 선언 시 리어가드 수에 따라 추가 파워를 얻습니다.',
      tone: clan.tone,
      tags: ['gzone', 'stride'],
    },
    {
      id: `${prefix}_GU_002`,
      name: `${clan.label} Finisher Stride`,
      clan: clan.label,
      type: 'g-unit',
      grade: 4,
      power: 15000,
      shield: 0,
      text: '결정력 높은 Stride. VC 공격 시 추가 파워를 받습니다.',
      tone: clan.tone,
      tags: ['gzone', 'finisher'],
    },
    {
      id: `${prefix}_GG_001`,
      name: `${clan.label} G Guardian`,
      clan: clan.label,
      type: 'g-guardian',
      grade: 4,
      power: 0,
      shield: 15000,
      text: 'G Guardian. 패 1장을 비용으로 높은 실드 값을 제공합니다.',
      tone: clan.tone,
      tags: ['gzone', 'guard'],
    },
    {
      id: `${prefix}_GG_002`,
      name: `${clan.label} Emergency Guard`,
      clan: clan.label,
      type: 'g-guardian',
      grade: 4,
      power: 0,
      shield: 15000,
      text: '두 번째 G Guardian 슬롯입니다. 고데미지 상황에서 우선 사용됩니다.',
      tone: clan.tone,
      tags: ['gzone', 'guard'],
    },
  ]);
}

export const CARDS = CLANS.flatMap(clanCards);
export const CARD_MAP = new Map(CARDS.map((card) => [card.id, card]));

const HANDLED_CARD_TYPES = {
  starter: '선발 배치와 첫 라이드 이후 소울 이동',
  trigger: '드라이브/데미지 체크 트리거 처리',
  sentinel: '패 비용 기반 퍼펙트 가드',
  normal: '라이드, 콜, 부스트, 공격, 가드 실드',
  'g-unit': '스트라이드, 드라이브 체크, G존 복귀',
  'g-guardian': 'G 가디언 호출과 클랜별 추가 실드',
};

const HANDLED_TAGS = {
  starter: '초기 뱅가드 배치',
  pressure: '공격 성향 AI/덱 프로필',
  guard: '센티넬/G가디언 방어 판단',
  combo: '드로우/스트라이드 성향 평가',
  trigger: '트리거 체크',
  critical: '크리티컬 +1',
  draw: '드로우 처리',
  stand: '리어가드 스탠드',
  heal: '데미지 회복',
  sentinel: '퍼펙트 가드',
  grade1: 'G1 라이드/부스트',
  grade2: 'G2 라이드/인터셉트 실드',
  grade3: 'G3 라이드/스트라이드 조건',
  boost: '후열 부스트',
  attack: 'VC 공격 보너스',
  intercept: '실드 자원 평가',
  vanguard: 'VC 스킬/스트라이드 기준',
  backup: '라이드 안정화',
  gzone: 'G존 검증',
  stride: '리어가드 수 기반 스트라이드 보너스',
  finisher: '피니셔 공격 보너스',
};

export function vanguardPortingCoverageReport(cards = CARDS) {
  const sourceCards = Array.isArray(cards) && cards.length ? cards : CARDS;
  const rows = sourceCards.map((card) => {
    const typeDetail = HANDLED_CARD_TYPES[card.type] || '';
    const tags = Array.isArray(card.tags) ? card.tags.filter(Boolean) : [];
    const handledTags = tags.filter((tag) => HANDLED_TAGS[tag]);
    const missingTags = tags.filter((tag) => !HANDLED_TAGS[tag]);
    const covered = Boolean(typeDetail) && missingTags.length === 0;
    const detailParts = [];
    if (typeDetail) detailParts.push(typeDetail);
    if (handledTags.length) {
      detailParts.push(`태그: ${handledTags.map((tag) => HANDLED_TAGS[tag]).join(', ')}`);
    }
    if (card.trigger) detailParts.push(`트리거: ${TRIGGER_LABELS[card.trigger] || card.trigger}`);
    if (missingTags.length) detailParts.push(`미처리 태그: ${missingTags.join(', ')}`);
    return {
      id: card.id,
      name: card.name || card.id,
      clan: card.clan || '',
      type: card.type || 'unknown',
      grade: Number(card.grade || 0),
      status: covered ? '처리됨' : '확인 필요',
      covered,
      detail: detailParts.join(' · ') || '처리 경로를 확인해야 합니다.',
      tone: covered ? 'green' : 'gold',
    };
  });
  const total = rows.length;
  const coveredRows = rows.filter((row) => row.covered);
  const unsupportedRows = rows.filter((row) => !row.covered);
  const typeRows = Object.entries(HANDLED_CARD_TYPES).map(([type, detail]) => {
    const cardsOfType = rows.filter((row) => row.type === type);
    const coveredOfType = cardsOfType.filter((row) => row.covered);
    return {
      type,
      label: TYPE_LABELS[type] || type,
      detail,
      total: cardsOfType.length,
      covered: coveredOfType.length,
      status: cardsOfType.length && cardsOfType.length === coveredOfType.length ? 'OK' : cardsOfType.length ? '확인 필요' : '대기',
    };
  });
  const tagRows = Object.entries(HANDLED_TAGS).map(([tag, detail]) => {
    const count = sourceCards.filter((card) => Array.isArray(card.tags) && card.tags.includes(tag)).length;
    return {
      tag,
      detail,
      count,
      status: count ? '활성' : '대기',
    };
  });
  return {
    completionPct: total ? Math.round((coveredRows.length / total) * 100) : 0,
    ready: unsupportedRows.length === 0,
    totalCards: total,
    coveredCards: coveredRows.length,
    unsupportedRows,
    typeRows,
    tagRows,
    rows,
    headline: `카드 ${coveredRows.length}/${total}장 처리 · 타입 ${typeRows.filter((row) => row.status === 'OK').length}/${typeRows.length}개 OK`,
    recommendations: unsupportedRows.length
      ? unsupportedRows.map((row) => `${row.name}: ${row.detail}`).slice(0, 4)
      : ['현재 카드 풀의 타입/태그가 플레이테스트 처리 경로에 모두 연결되어 있습니다.'],
  };
}

function idFor(clanKey, suffix) {
  return `${clanKey.slice(0, 3).toUpperCase()}_${suffix}`;
}

function presetFor(clan) {
  return {
    id: `preset_${clan.key}`,
    name: `${clan.label} P-G sample deck`,
    clan: clan.label,
    description: `${clan.lead}/${clan.support} 중심의 P-G 샘플 덱입니다. 50장 메인 덱, 16장 이하 G존, 트리거 16장 규칙을 기준으로 구성했습니다.`,
    main: [
      { cardId: idFor(clan.key, 'ST_001'), count: 1 },
      { cardId: idFor(clan.key, 'TR_CRITICAL'), count: 4 },
      { cardId: idFor(clan.key, 'TR_DRAW'), count: 4 },
      { cardId: idFor(clan.key, 'TR_STAND'), count: 4 },
      { cardId: idFor(clan.key, 'TR_HEAL'), count: 4 },
      { cardId: idFor(clan.key, 'PG_001'), count: 4 },
      { cardId: idFor(clan.key, 'G1_001'), count: 4 },
      { cardId: idFor(clan.key, 'G1_002'), count: 4 },
      { cardId: idFor(clan.key, 'G1_003'), count: 4 },
      { cardId: idFor(clan.key, 'G2_001'), count: 4 },
      { cardId: idFor(clan.key, 'G2_002'), count: 4 },
      { cardId: idFor(clan.key, 'G2_003'), count: 1 },
      { cardId: idFor(clan.key, 'G3_001'), count: 4 },
      { cardId: idFor(clan.key, 'G3_002'), count: 4 },
    ],
    gzone: [
      { cardId: idFor(clan.key, 'GU_001'), count: 4 },
      { cardId: idFor(clan.key, 'GU_002'), count: 4 },
      { cardId: idFor(clan.key, 'GG_001'), count: 2 },
      { cardId: idFor(clan.key, 'GG_002'), count: 2 },
    ],
  };
}

export const PRESET_DECKS = CLANS.map(presetFor);

export function expandEntries(entries) {
  const out = [];
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const count = Math.max(0, Number(entry.count || 0));
    for (let index = 0; index < count; index += 1) out.push(entry.cardId);
  });
  return out;
}

export function getCard(cardId) {
  return CARD_MAP.get(cardId) || null;
}

export function cardName(cardId) {
  return getCard(cardId)?.name || cardId;
}

export function getPreset(presetId) {
  return PRESET_DECKS.find((preset) => preset.id === presetId) || PRESET_DECKS[0];
}

export function countEntries(entries) {
  return (Array.isArray(entries) ? entries : []).reduce((sum, entry) => sum + Number(entry.count || 0), 0);
}

export function validateDeck(deck, rules = DEFAULT_RULES) {
  const activeRules = normalizeRules(rules);
  const errors = [];
  const warnings = [];
  const mainIds = expandEntries(deck?.main);
  const gIds = expandEntries(deck?.gzone);
  const mainCards = mainIds.map(getCard).filter(Boolean);
  const gCards = gIds.map(getCard).filter(Boolean);
  const allEntries = [...(deck?.main || []), ...(deck?.gzone || [])];

  if (mainIds.length !== activeRules.mainSize) errors.push(`메인 덱은 ${activeRules.mainSize}장이어야 합니다. 현재 ${mainIds.length}장입니다.`);
  if (gIds.length > activeRules.gZoneMax) errors.push(`G존은 최대 ${activeRules.gZoneMax}장입니다. 현재 ${gIds.length}장입니다.`);

  allEntries.forEach((entry) => {
    const card = getCard(entry.cardId);
    if (!card) errors.push(`존재하지 않는 카드: ${entry.cardId}`);
    if (Number(entry.count || 0) > activeRules.maxCopies) errors.push(`${card?.name || entry.cardId}는 ${activeRules.maxCopies}장까지만 넣을 수 있습니다.`);
    if (Number(entry.count || 0) < 0) errors.push(`${card?.name || entry.cardId}의 매수가 음수입니다.`);
  });

  const triggers = mainCards.filter((card) => card.type === 'trigger');
  const heals = triggers.filter((card) => card.trigger === 'heal');
  const starters = mainCards.filter((card) => card.type === 'starter');
  const sentinels = mainCards.filter((card) => card.type === 'sentinel');
  const grade3 = mainCards.filter((card) => card.type === 'normal' && Number(card.grade || 0) === 3);
  const clans = new Set([...mainCards, ...gCards].map((card) => card.clan));

  if (triggers.length !== activeRules.triggerSize) errors.push(`트리거는 ${activeRules.triggerSize}장이어야 합니다. 현재 ${triggers.length}장입니다.`);
  if (heals.length > activeRules.maxCopies) errors.push(`힐 트리거는 최대 ${activeRules.maxCopies}장입니다. 현재 ${heals.length}장입니다.`);
  if (starters.length !== activeRules.starterSize) errors.push(`스타터는 ${activeRules.starterSize}장이어야 합니다. 현재 ${starters.length}장입니다.`);
  if (sentinels.length > activeRules.maxCopies) errors.push(`센티넬은 최대 ${activeRules.maxCopies}장입니다. 현재 ${sentinels.length}장입니다.`);
  if (!activeRules.allowMixedClan && clans.size > 1) errors.push(`클랜이 섞여 있습니다: ${[...clans].join(', ')}`);
  if (grade3.length !== activeRules.recommendedGrade3) warnings.push(`권장 G3 매수는 ${activeRules.recommendedGrade3}장입니다. 현재 ${grade3.length}장입니다.`);

  gCards.forEach((card) => {
    if (card.type !== 'g-unit' && card.type !== 'g-guardian') errors.push(`G존에는 G 유닛/G 가디언만 들어갈 수 있습니다: ${card.name}`);
  });
  const guardians = gCards.filter((card) => card.type === 'g-guardian').length;
  if (gIds.length > 0 && guardians < activeRules.minGGuardians) warnings.push(`G 가디언은 최소 ${activeRules.minGGuardians}장 이상을 권장합니다. 현재 ${guardians}장입니다.`);

  return { errors, warnings };
}

export function summarizeDeck(deck) {
  const mainCards = expandEntries(deck?.main).map(getCard).filter(Boolean);
  const gCards = expandEntries(deck?.gzone).map(getCard).filter(Boolean);
  const gradeCounts = [0, 1, 2, 3, 4].map((grade) => ({
    grade,
    count: [...mainCards, ...gCards].filter((card) => Number(card.grade || 0) === grade).length,
  }));
  const shield = mainCards.reduce((sum, card) => sum + Number(card.shield || 0), 0);
  const power = mainCards.reduce((sum, card) => sum + Number(card.power || 0), 0);
  return {
    mainCount: mainCards.length,
    gCount: gCards.length,
    triggerCount: mainCards.filter((card) => card.type === 'trigger').length,
    grade3Count: mainCards.filter((card) => card.type === 'normal' && Number(card.grade || 0) === 3).length,
    clan: deck?.clan || mainCards[0]?.clan || '',
    gradeCounts,
    averagePower: mainCards.length ? Math.round(power / mainCards.length) : 0,
    totalShield: shield,
  };
}

export function shuffle(values, seed = Date.now()) {
  const next = [...values];
  let r = Number(seed || 1) >>> 0;
  const rand = () => {
    r = (r * 1664525 + 1013904223) % 4294967296;
    return r / 4294967296;
  };
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rand() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
}

export function drawOpeningHand(deck, seed = Date.now(), size = 5) {
  return shuffle(expandEntries(deck?.main), seed).slice(0, size);
}

function roundOne(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function percent(hits, total) {
  return total ? roundOne((hits / total) * 100) : 0;
}

export function deckCompositionRows(deck) {
  const rows = new Map();
  const zones = [
    { key: 'main', label: '메인', entries: deck?.main || [] },
    { key: 'gzone', label: 'G존', entries: deck?.gzone || [] },
  ];

  zones.forEach((zone) => {
    zone.entries.forEach((entry) => {
      const card = getCard(entry.cardId);
      const count = Math.max(0, Number(entry.count || 0));
      if (!card || count <= 0) return;
      const grade = Number(card.grade || 0);
      const trigger = card.trigger || '';
      const key = `${zone.key}:${grade}:${card.type}:${trigger}`;
      const current = rows.get(key) || {
        key,
        zone: zone.key,
        zoneLabel: zone.label,
        grade,
        type: card.type,
        trigger,
        count: 0,
        powerTotal: 0,
        shieldTotal: 0,
      };
      current.count += count;
      current.powerTotal += Number(card.power || 0) * count;
      current.shieldTotal += Number(card.shield || 0) * count;
      rows.set(key, current);
    });
  });

  return [...rows.values()]
    .map((row) => ({
      ...row,
      label: `${row.zoneLabel} G${row.grade} ${TYPE_LABELS[row.type] || row.type}${row.trigger ? `(${TRIGGER_LABELS[row.trigger] || row.trigger})` : ''}`,
      averagePower: row.count ? Math.round(row.powerTotal / row.count) : 0,
    }))
    .sort((a, b) => {
      if (a.zone !== b.zone) return a.zone === 'main' ? -1 : 1;
      if (a.grade !== b.grade) return a.grade - b.grade;
      return a.label.localeCompare(b.label, 'ko-KR');
    });
}

export function openingHandStats(deck, seed = Date.now(), samples = 160, handSize = 5) {
  const ids = expandEntries(deck?.main);
  const sampleTotal = Math.max(1, Number(samples || 1));
  const totals = {
    grade1: 0,
    grade2: 0,
    grade3: 0,
    rideLine: 0,
    sentinel: 0,
    triggers: 0,
    shield: 0,
    power: 0,
  };

  for (let index = 0; index < sampleTotal; index += 1) {
    const hand = shuffle(ids, (Number(seed || 1) + index * 2654435761) >>> 0).slice(0, handSize);
    const cards = hand.map(getCard).filter(Boolean);
    const hasGrade1 = cards.some((card) => Number(card.grade || 0) === 1);
    const hasGrade2 = cards.some((card) => Number(card.grade || 0) === 2);
    const hasGrade3 = cards.some((card) => Number(card.grade || 0) === 3);
    if (hasGrade1) totals.grade1 += 1;
    if (hasGrade2) totals.grade2 += 1;
    if (hasGrade3) totals.grade3 += 1;
    if (hasGrade1 && hasGrade2 && hasGrade3) totals.rideLine += 1;
    if (cards.some((card) => card.type === 'sentinel')) totals.sentinel += 1;
    totals.triggers += cards.filter((card) => card.type === 'trigger').length;
    totals.shield += cards.reduce((sum, card) => sum + Number(card.shield || 0), 0);
    totals.power += cards.reduce((sum, card) => sum + Number(card.power || 0), 0);
  }

  return {
    samples: sampleTotal,
    handSize,
    grade1Rate: percent(totals.grade1, sampleTotal),
    grade2Rate: percent(totals.grade2, sampleTotal),
    grade3Rate: percent(totals.grade3, sampleTotal),
    rideLineRate: percent(totals.rideLine, sampleTotal),
    sentinelRate: percent(totals.sentinel, sampleTotal),
    triggerAverage: roundOne(totals.triggers / sampleTotal),
    shieldAverage: Math.round(totals.shield / sampleTotal),
    powerAverage: Math.round(totals.power / sampleTotal),
  };
}

export function deckConsistencyReport(deck, seed = Date.now(), rules = DEFAULT_RULES) {
  const validation = validateDeck(deck, rules);
  const summary = summarizeDeck(deck);
  const composition = deckCompositionRows(deck);
  const opening = openingHandStats(deck, seed);
  const recommendations = [];

  if (validation.errors.length) recommendations.push('필수 규칙 오류가 있습니다. 메인 덱/G존/트리거 매수부터 맞춰 주세요.');
  if (opening.grade1Rate < 75) recommendations.push('오프닝 G1 확보율이 낮습니다. G1 라인을 늘리면 라이드 사고가 줄어듭니다.');
  if (opening.grade2Rate < 70) recommendations.push('오프닝 G2 확보율이 낮습니다. 초중반 필드 전개가 끊길 수 있습니다.');
  if (opening.grade3Rate < 55) recommendations.push('G3 접근률이 낮습니다. 스트라이드 전환이 늦어질 수 있습니다.');
  if (opening.rideLineRate < 25) recommendations.push('G1/G2/G3 동시 확보율이 낮습니다. 멀리건 기준을 보수적으로 잡는 편이 좋습니다.');
  if (opening.sentinelRate < 30) recommendations.push('센티넬 접근률이 낮습니다. 방어 안정성이 떨어질 수 있습니다.');
  if (summary.totalShield < 220000) recommendations.push('총 실드가 낮은 편입니다. 방어용 G1/G2 또는 트리거 비중을 점검해 주세요.');
  if (!recommendations.length) recommendations.push('오프닝과 방어 수치가 안정권입니다. 현재 프리셋으로 바로 테스트해도 됩니다.');

  return {
    validation,
    summary,
    composition,
    opening,
    recommendations,
  };
}

export function scoreDeck(deck, rules = DEFAULT_RULES) {
  const validation = validateDeck(deck, rules);
  const summary = summarizeDeck(deck);
  return Math.max(0, Math.round(
    1000
    + summary.mainCount * 8
    + summary.gCount * 12
    + summary.triggerCount * 20
    + summary.grade3Count * 16
    - validation.errors.length * 220
    - validation.warnings.length * 55
  ));
}

function opponent(side) {
  return side === 'me' ? 'opp' : 'me';
}

function emptyCircles() {
  return {
    VC: null,
    RC_FL: null,
    RC_FR: null,
    RC_BL: null,
    RC_BR: null,
    RC_BC: null,
  };
}

function createUnit(cardId) {
  return {
    uid: `${cardId}-${Math.random().toString(36).slice(2, 8)}`,
    cardId,
    isRest: false,
    powerMod: 0,
    critMod: 0,
  };
}

function pushLog(duel, side, message) {
  const label = SIDE_LABELS[side] || side;
  duel.log = [`[${label}] ${message}`, ...(duel.log || [])].slice(0, 200);
}

function pushBattleNote(duel, message) {
  if (duel.battle) duel.battle.note.push(message);
}

function initPlayerState(deckMain, deckG, seed) {
  return {
    deck: shuffle(deckMain, seed),
    hand: [],
    soul: [],
    damage: [],
    drop: [],
    removed: [],
    gzone: shuffle(deckG, seed + 1337),
    circles: emptyCircles(),
    heart: null,
    isStrided: false,
    rideTurn: 0,
    usedAct: {},
    cbUsedTotal: 0,
  };
}

function placeStarterFromDeck(duel, side) {
  const player = duel.players[side];
  if (player.circles.VC) return false;
  let index = player.deck.findIndex((cardId) => getCard(cardId)?.type === 'starter');
  if (index < 0) index = 0;
  const cardId = player.deck.splice(index, 1)[0];
  if (!cardId) return false;
  player.circles.VC = createUnit(cardId);
  pushLog(duel, side, `${cardName(cardId)}를 시작 VC에 배치했습니다.`);
  return true;
}

export function initDuelState({
  meDeck,
  oppDeck,
  seed = Date.now(),
  first = 'me',
  firstTurnNoDraw = DEFAULT_RULES.firstTurnNoDraw,
}) {
  const duel = {
    players: {
      me: initPlayerState(expandEntries(meDeck?.main), expandEntries(meDeck?.gzone), Number(seed || 1)),
      opp: initPlayerState(expandEntries(oppDeck?.main), expandEntries(oppDeck?.gzone), Number(seed || 1) + 777),
    },
    active: first,
    first,
    firstTurnNoDraw,
    turn: 1,
    phase: 'STAND',
    battle: null,
    log: [],
    winner: null,
    mulliganDone: { me: false, opp: false },
  };

  placeStarterFromDeck(duel, 'me');
  placeStarterFromDeck(duel, 'opp');
  draw(duel, 'me', 5);
  draw(duel, 'opp', 5);
  pushLog(duel, 'me', '듀얼을 시작했습니다.');
  pushLog(duel, 'opp', '상대가 준비되었습니다.');
  return duel;
}

export function draw(duel, side, count = 1) {
  if (duel.winner) return false;
  const player = duel.players[side];
  let drawn = 0;
  for (let index = 0; index < count; index += 1) {
    const top = player.deck.shift();
    if (!top) {
      duel.winner = opponent(side);
      pushLog(duel, side, '덱이 비어 패배했습니다.');
      return false;
    }
    player.hand.push(top);
    drawn += 1;
  }
  if (drawn > 0) pushLog(duel, side, `${drawn}장 드로우했습니다.`);
  return true;
}

export function mulliganAll(duel, side) {
  if (duel.winner || duel.turn !== 1 || duel.phase !== 'STAND' || duel.battle || duel.mulliganDone?.[side]) return false;
  const player = duel.players[side];
  const count = player.hand.length;
  player.deck = shuffle([...player.hand, ...player.deck], duel.turn * 1000 + count + (side === 'me' ? 17 : 31));
  player.hand = [];
  draw(duel, side, count);
  duel.mulliganDone[side] = true;
  pushLog(duel, side, `멀리건으로 ${count}장을 교체했습니다.`);
  return true;
}

function removeFromHand(player, cardId) {
  const index = player.hand.indexOf(cardId);
  if (index < 0) return false;
  player.hand.splice(index, 1);
  return true;
}

function standAll(player) {
  Object.values(player.circles).forEach((unit) => {
    if (unit) unit.isRest = false;
  });
}

function resetMods(player) {
  Object.values(player.circles).forEach((unit) => {
    if (!unit) return;
    unit.powerMod = 0;
    unit.critMod = 0;
  });
  if (player.heart) {
    player.heart.powerMod = 0;
    player.heart.critMod = 0;
  }
}

export function advancePhase(duel, firstTurnNoDraw = DEFAULT_RULES.firstTurnNoDraw) {
  if (duel.winner || (duel.battle && duel.battle.step !== 'DONE')) return false;
  const index = PHASES.indexOf(duel.phase);
  const next = PHASES[Math.min(index + 1, PHASES.length - 1)] || 'STAND';
  const side = duel.active;
  duel.phase = next;

  if (next === 'STAND') {
    standAll(duel.players[side]);
    pushLog(duel, side, '스탠드 페이즈에 진입했습니다.');
  }
  if (next === 'DRAW') {
    const skip = firstTurnNoDraw && duel.turn === 1 && side === duel.first;
    if (skip) pushLog(duel, side, '선공 첫 턴 드로우를 생략했습니다.');
    else draw(duel, side, 1);
  }
  if (next === 'MAIN') pushLog(duel, side, '메인 페이즈에 진입했습니다.');
  if (next === 'BATTLE') {
    const skip = firstTurnNoDraw && duel.turn === 1 && side === duel.first;
    if (skip) {
      duel.phase = 'END';
      pushLog(duel, side, '선공 첫 턴 배틀 페이즈를 생략했습니다.');
    } else {
      pushLog(duel, side, '배틀 페이즈에 진입했습니다.');
    }
  }
  if (next === 'END') pushLog(duel, side, '엔드 페이즈에 진입했습니다.');
  return true;
}

export function endTurn(duel) {
  if (duel.winner || (duel.battle && duel.battle.step !== 'DONE')) return false;
  const player = duel.players[duel.active];
  if (player.isStrided && player.heart && player.circles.VC) {
    const gUnit = player.circles.VC.cardId;
    player.gzone.push(gUnit);
    player.circles.VC = player.heart;
    player.heart = null;
    player.isStrided = false;
    pushLog(duel, duel.active, `${cardName(gUnit)}가 G존으로 돌아갔습니다.`);
  }
  resetMods(player);
  player.usedAct = {};

  duel.active = opponent(duel.active);
  duel.turn += 1;
  duel.phase = 'STAND';
  standAll(duel.players[duel.active]);
  pushLog(duel, duel.active, `턴 ${duel.turn}을 시작합니다.`);
  return true;
}

function rideContextReadiness(duel, side) {
  const player = duel?.players?.[side];
  if (!player) return { canRide: false, reason: '플레이어 상태를 찾을 수 없습니다.' };
  if (duel.winner) return { canRide: false, reason: '종료된 듀얼에서는 라이드할 수 없습니다.' };
  if (duel.active !== side) return { canRide: false, reason: '현재 차례의 플레이어만 라이드할 수 있습니다.' };
  if (duel.phase !== 'MAIN') return { canRide: false, reason: '메인 페이즈에만 라이드할 수 있습니다.' };
  if (duel.battle) return { canRide: false, reason: '진행 중인 배틀을 먼저 해결해야 합니다.' };
  if (player.isStrided) return { canRide: false, reason: '스트라이드 중에는 라이드할 수 없습니다.' };
  if (Number(player.rideTurn || 0) === Number(duel.turn || 0)) {
    return { canRide: false, reason: '이번 턴에는 이미 라이드했습니다.' };
  }
  return { canRide: true, player };
}

export function rideReadiness(duel, side, cardId) {
  const context = rideContextReadiness(duel, side);
  if (!context.canRide) return context;

  const { player } = context;
  if (!cardId) return { canRide: false, reason: '패에서 라이드할 카드를 선택하세요.' };
  if (!player.hand.includes(cardId)) return { canRide: false, reason: '선택한 카드가 패에 없습니다.' };

  const card = getCard(cardId);
  if (!card || card.type !== 'normal') {
    return { canRide: false, reason: '노멀 유닛만 뱅가드에 라이드할 수 있습니다.' };
  }

  const currentGrade = Number(getCard(player.circles.VC?.cardId)?.grade ?? -1);
  const cardGrade = Number(card.grade ?? -1);
  const canMatchGrade = cardGrade === currentGrade;
  const canAdvanceGrade = cardGrade === currentGrade + 1;
  if (!canMatchGrade && !canAdvanceGrade) {
    const gradeLabel = currentGrade >= 3
      ? `Grade ${currentGrade}`
      : `Grade ${currentGrade} 또는 ${currentGrade + 1}`;
    return {
      canRide: false,
      reason: `현재 VC에는 ${gradeLabel} 노멀 유닛만 라이드할 수 있습니다.`,
      currentGrade,
      cardGrade,
    };
  }

  return {
    canRide: true,
    card,
    cardId,
    cardGrade,
    currentGrade,
    detail: `${card.name} (Grade ${cardGrade}) 라이드 가능`,
  };
}

function rideAssistSwapIndex(player, wantGrade) {
  return player.hand
    .map((cardId, index) => {
      const card = getCard(cardId);
      const grade = Number(card?.grade ?? -1);
      const priority = card?.type === 'normal' && grade > wantGrade
        ? 0
        : card?.type === 'normal'
          ? 10
          : card?.type === 'trigger'
            ? 20
            : 30;
      return { grade, index, priority };
    })
    .sort((a, b) => (a.priority - b.priority) || (b.grade - a.grade) || (a.index - b.index))[0]?.index ?? -1;
}

export function autoRideReadiness(duel, side) {
  const context = rideContextReadiness(duel, side);
  if (!context.canRide) return context;

  const { player } = context;
  const currentGrade = Number(getCard(player.circles.VC?.cardId)?.grade ?? -1);
  const wantGrade = Math.min(Math.max(currentGrade + 1, 0), 3);
  const handCandidate = player.hand.find((cardId) => {
    const card = getCard(cardId);
    return card?.type === 'normal' && Number(card.grade) === wantGrade;
  });
  if (handCandidate) {
    return {
      canRide: true,
      candidateId: handCandidate,
      currentGrade,
      wantGrade,
      source: 'hand',
      detail: `${cardName(handCandidate)} (Grade ${wantGrade}) 자동 라이드 가능`,
    };
  }

  const deckIndex = player.deck.findIndex((cardId) => {
    const card = getCard(cardId);
    return card?.type === 'normal' && Number(card.grade) === wantGrade;
  });
  const swapIndex = rideAssistSwapIndex(player, wantGrade);
  if (deckIndex >= 0 && swapIndex >= 0) {
    const candidateId = player.deck[deckIndex];
    return {
      canRide: true,
      candidateId,
      currentGrade,
      deckIndex,
      swapIndex,
      wantGrade,
      source: 'assist',
      detail: `라이드 어시스트로 ${cardName(candidateId)} (Grade ${wantGrade}) 확보 가능`,
    };
  }

  return {
    canRide: false,
    currentGrade,
    wantGrade,
    reason: `Grade ${wantGrade} 노멀 유닛이 패와 덱에 없습니다.`,
  };
}

export function rideFromHand(duel, side, cardId) {
  const readiness = rideReadiness(duel, side, cardId);
  if (!readiness.canRide) {
    if (duel?.players?.[side]) pushLog(duel, side, `라이드 실패: ${readiness.reason}`);
    return false;
  }

  const player = duel.players[side];
  if (!removeFromHand(player, cardId)) return false;
  const prev = player.circles.VC;
  if (prev) player.soul.push(prev.cardId);
  player.circles.VC = createUnit(cardId);
  player.isStrided = false;
  player.heart = null;
  player.rideTurn = duel.turn;
  pushLog(duel, side, `${cardName(cardId)}에 라이드했습니다.`);
  return true;
}

export function autoRide(duel, side) {
  const readiness = autoRideReadiness(duel, side);
  if (!readiness.canRide) {
    if (duel?.players?.[side]) pushLog(duel, side, `자동 라이드 실패: ${readiness.reason}`);
    return false;
  }

  const player = duel.players[side];
  if (readiness.source === 'assist') {
    const replacedCardId = player.hand[readiness.swapIndex];
    player.hand[readiness.swapIndex] = readiness.candidateId;
    player.deck[readiness.deckIndex] = replacedCardId;
    pushLog(duel, side, `라이드 어시스트로 ${cardName(readiness.candidateId)}을 확보했습니다.`);
  }
  return rideFromHand(duel, side, readiness.candidateId);
}

export function callFromHand(duel, side, cardId, circle) {
  if (duel.winner || duel.phase !== 'MAIN' || duel.active !== side || circle === 'VC') return false;
  const player = duel.players[side];
  if (player.circles[circle]) return false;
  if (!removeFromHand(player, cardId)) return false;
  player.circles[circle] = createUnit(cardId);
  pushLog(duel, side, `${cardName(cardId)}를 ${circle}에 콜했습니다.`);
  return true;
}

export function retireCircle(duel, side, circle) {
  if (duel.winner || duel.phase !== 'MAIN' || duel.active !== side || circle === 'VC') return false;
  const player = duel.players[side];
  const unit = player.circles[circle];
  if (!unit) return false;
  player.drop.push(unit.cardId);
  player.circles[circle] = null;
  pushLog(duel, side, `${cardName(unit.cardId)}를 퇴각시켰습니다.`);
  return true;
}

function gradeOf(cardId) {
  return getCard(cardId)?.grade ?? 0;
}

export function strideWithAutoCost(duel, side) {
  if (duel.winner || duel.phase !== 'MAIN' || duel.active !== side) return false;
  const player = duel.players[side];
  const vc = player.circles.VC;
  const vcCard = getCard(vc?.cardId);
  if (!vc || !vcCard || vcCard.grade < 3 || player.isStrided) {
    pushLog(duel, side, '스트라이드 조건을 만족하지 못했습니다.');
    return false;
  }

  const gIndex = player.gzone.findIndex((cardId) => getCard(cardId)?.type === 'g-unit');
  if (gIndex < 0) {
    pushLog(duel, side, 'G존에 사용할 G 유닛이 없습니다.');
    return false;
  }

  const costs = [...player.hand].sort((a, b) => gradeOf(a) - gradeOf(b));
  const discard = [];
  let totalGrade = 0;
  for (const cardId of costs) {
    discard.push(cardId);
    totalGrade += gradeOf(cardId);
    if (totalGrade >= 3) break;
  }
  if (totalGrade < 3) {
    pushLog(duel, side, '스트라이드 비용이 부족합니다.');
    return false;
  }

  discard.forEach((cardId) => {
    removeFromHand(player, cardId);
    player.drop.push(cardId);
  });

  const gUnit = player.gzone.splice(gIndex, 1)[0];
  player.heart = vc;
  player.circles.VC = createUnit(gUnit);
  player.isStrided = true;
  pushLog(duel, side, `${cardName(gUnit)}로 스트라이드했습니다. 비용 ${discard.length}장을 버렸습니다.`);
  return true;
}

export function activateVCAct(duel, side, costCardId) {
  if (duel.winner || duel.phase !== 'MAIN' || duel.active !== side) return false;
  const player = duel.players[side];
  const vc = player.circles.VC;
  const card = getCard(vc?.cardId);
  if (!vc || !card) return false;
  const key = `${vc.cardId}-ACT`;
  if (player.usedAct[key] === duel.turn) {
    pushLog(duel, side, '이번 턴에 이미 VC 스킬을 사용했습니다.');
    return false;
  }

  let paid = false;
  if (costCardId && player.hand.includes(costCardId)) {
    removeFromHand(player, costCardId);
    player.drop.push(costCardId);
    paid = true;
  } else if (player.soul.length > 0) {
    const soul = player.soul.pop();
    player.drop.push(soul);
    paid = true;
  }

  if (!paid) {
    pushLog(duel, side, 'VC 스킬 비용으로 사용할 패 또는 소울이 없습니다.');
    return false;
  }

  player.usedAct[key] = duel.turn;
  if (card.clan === 'Gehenna') {
    draw(duel, side, 1);
    pushLog(duel, side, `${card.name} 스킬: 비용을 지불하고 1장 드로우했습니다.`);
  } else {
    vc.powerMod += card.type === 'g-unit' ? 10000 : 5000;
    pushLog(duel, side, `${card.name} 스킬: 이번 턴 VC 파워가 상승했습니다.`);
  }
  return true;
}

function boosterFor(circle) {
  if (circle === 'RC_FL') return 'RC_BL';
  if (circle === 'RC_FR') return 'RC_BR';
  if (circle === 'VC') return 'RC_BC';
  return null;
}

function powerOfUnit(unit) {
  if (!unit) return 0;
  return Number(getCard(unit.cardId)?.power || 0) + Number(unit.powerMod || 0);
}

function battleAttackPower(duel, battle) {
  const attacker = duel.players[battle.attackerSide].circles[battle.attackerCircle];
  return powerOfUnit(attacker) + Number(battle.boostPower || 0) + Number(battle.attackBonus || 0);
}

function driveCount(unit) {
  const card = getCard(unit?.cardId);
  if (!card) return 0;
  return card.type === 'g-unit' || card.grade >= 3 ? 2 : 1;
}

function applyTrigger(duel, side, trigger, source) {
  const player = duel.players[side];
  const vc = player.circles.VC;
  if (vc) vc.powerMod += 10000;
  pushLog(
    duel,
    side,
    `${TRIGGER_LABELS[trigger] || trigger} 트리거가 발동했습니다. (${source === 'drive' ? '드라이브' : '데미지'} 체크)`,
  );
  pushBattleNote(duel, `[${source}] ${trigger} trigger: VC +10000`);

  if (trigger === 'critical' && vc) {
    vc.critMod += 1;
    pushBattleNote(duel, `[${source}] Critical: VC Critical +1`);
  }
  if (trigger === 'draw') draw(duel, side, 1);
  if (trigger === 'stand') {
    const restRear = REAR_CIRCLES.find((circle) => player.circles[circle]?.isRest);
    if (restRear) {
      player.circles[restRear].isRest = false;
      pushBattleNote(duel, `[${source}] Stand: ${restRear}를 스탠드했습니다.`);
    }
  }
  if (trigger === 'heal') {
    const other = duel.players[opponent(side)];
    if (player.damage.length >= other.damage.length && player.damage.length > 0) {
      const healed = player.damage.pop();
      player.drop.push(healed);
      player.cbUsedTotal = Math.min(player.cbUsedTotal || 0, player.damage.length);
      pushBattleNote(duel, `[${source}] Heal: 데미지 1장을 회복했습니다.`);
    }
  }
}

function addAttackBonuses(duel, battle) {
  const player = duel.players[battle.attackerSide];
  const unit = player.circles[battle.attackerCircle];
  const card = getCard(unit?.cardId);
  if (!unit || !card) return;

  if (card.tags?.includes('attack') && battle.defenderCircle === 'VC') {
    battle.attackBonus += 3000;
    battle.note.push(`${card.name}: VC 공격 보너스 +3000`);
  }
  if (battle.attackerCircle === 'VC' && card.type === 'g-unit') {
    const rearCount = REAR_CIRCLES.filter((circle) => Boolean(player.circles[circle])).length;
    if (card.tags?.includes('stride') && rearCount > 0) {
      const add = rearCount * 3000;
      battle.attackBonus += add;
      battle.note.push(`${card.name}: 리어가드 ${rearCount}장으로 +${add}`);
    }
    if (card.tags?.includes('finisher')) {
      battle.attackBonus += 5000;
      battle.note.push(`${card.name}: 피니셔 보너스 +5000`);
    }
  }
}

export function canAttack(duel, side, circle) {
  const unit = duel.players[side]?.circles?.[circle];
  return Boolean(unit && !unit.isRest && !duel.battle && duel.phase === 'BATTLE' && duel.active === side && !duel.winner);
}

export function declareAttack(duel, attackerCircle, defenderCircle = 'VC') {
  if (duel.winner || duel.phase !== 'BATTLE' || duel.battle) return false;
  if (duel.firstTurnNoDraw && duel.turn === 1 && duel.active === duel.first) {
    pushLog(duel, duel.active, '선공 첫 턴에는 공격할 수 없습니다.');
    return false;
  }

  const attackerSide = duel.active;
  const defenderSide = opponent(attackerSide);
  const attacker = duel.players[attackerSide].circles[attackerCircle];
  const defender = duel.players[defenderSide].circles[defenderCircle];
  if (!attacker || !defender || attacker.isRest) return false;

  attacker.isRest = true;
  const boosterCircle = boosterFor(attackerCircle);
  let boostPower = 0;
  if (boosterCircle) {
    const booster = duel.players[attackerSide].circles[boosterCircle];
    if (booster && !booster.isRest) {
      booster.isRest = true;
      boostPower = powerOfUnit(booster);
    }
  }

  duel.battle = {
    attackerSide,
    attackerCircle,
    defenderSide,
    defenderCircle,
    boosterCircle: boostPower ? boosterCircle : null,
    boostPower,
    attackBonus: 0,
    guardCards: [],
    guardShield: 0,
    perfectGuard: false,
    driveChecks: [],
    damageChecks: [],
    note: [],
    step: 'GUARD',
  };

  if (boostPower) duel.battle.note.push(`부스트: ${boosterCircle} +${boostPower}`);
  addAttackBonuses(duel, duel.battle);
  pushLog(duel, attackerSide, `${cardName(attacker.cardId)}가 ${defenderCircle}를 공격했습니다.`);
  return true;
}

function lowestShieldCard(hand, excludeCardId) {
  return [...hand]
    .filter((cardId) => cardId !== excludeCardId)
    .map((cardId) => ({ cardId, shield: Number(getCard(cardId)?.shield || 0), trigger: getCard(cardId)?.type === 'trigger' }))
    .sort((a, b) => (a.shield === b.shield ? Number(a.trigger) - Number(b.trigger) : a.shield - b.shield))[0]?.cardId || null;
}

function cardSuffix(cardId) {
  return String(cardId || '').replace(/^[A-Z]{3}_/, '');
}

function estimateGGuardianShield(player, guardianId) {
  const card = getCard(guardianId);
  if (!card || card.type !== 'g-guardian') return 0;
  const suffix = cardSuffix(guardianId);
  const base = Number(card.shield || 0);
  if (suffix === 'GG_001') return base + 5000;
  if (guardianId.startsWith('GEH_') && suffix === 'GG_002') return base + 5000;
  if (guardianId.startsWith('TRI_') && suffix === 'GG_002') return base + (player.drop.length > 0 || player.hand.length > 0 ? 10000 : 0);
  if (guardianId.startsWith('MIL_') && suffix === 'GG_002') return base + (player.hand.length >= 2 ? 10000 : 0);
  return base;
}

function bestGGuardian(player) {
  return player.gzone
    .map((cardId, index) => ({ cardId, index, shield: estimateGGuardianShield(player, cardId) }))
    .filter((row) => getCard(row.cardId)?.type === 'g-guardian')
    .sort((a, b) => b.shield - a.shield)[0] || null;
}

function applyGGuardianShield(player, guardianId, battle) {
  const card = getCard(guardianId);
  const suffix = cardSuffix(guardianId);
  let shield = Number(card?.shield || 0);
  const notes = [];

  if (suffix === 'GG_001') {
    shield += 5000;
    notes.push('bonus +5000');
  } else if (guardianId.startsWith('GEH_') && suffix === 'GG_002') {
    shield += 5000;
    notes.push('bonus +5000');
  } else if (guardianId.startsWith('TRI_') && suffix === 'GG_002') {
    const moved = player.drop.pop();
    if (moved) {
      player.soul.push(moved);
      shield += 10000;
      notes.push(`${cardName(moved)} soul +10000`);
    }
  } else if (guardianId.startsWith('MIL_') && suffix === 'GG_002') {
    const extraCost = lowestShieldCard(player.hand);
    if (extraCost && removeFromHand(player, extraCost)) {
      player.drop.push(extraCost);
      shield += 10000;
      notes.push(`${cardName(extraCost)} extra cost +10000`);
    }
  }

  battle.guardShield += shield;
  return { shield, notes };
}

export function guardAddFromHand(duel, defenderSide, cardId) {
  const battle = duel.battle;
  if (!battle || battle.step !== 'GUARD' || battle.defenderSide !== defenderSide || battle.defenderCircle !== 'VC') return false;
  const player = duel.players[defenderSide];
  const card = getCard(cardId);
  if (!card || !removeFromHand(player, cardId)) return false;

  if (card.type === 'sentinel') {
    const cost = lowestShieldCard(player.hand, cardId);
    if (!cost || !removeFromHand(player, cost)) {
      player.hand.push(cardId);
      return false;
    }
    player.drop.push(cost);
    battle.perfectGuard = true;
    battle.guardCards.push(cardId);
    battle.note.push(`${card.name}: ${cardName(cost)}를 버리고 완전 가드`);
  } else {
    battle.guardShield += Number(card.shield || 0);
    battle.guardCards.push(cardId);
    battle.note.push(`${card.name}: 실드 +${Number(card.shield || 0)}`);
  }

  pushLog(duel, defenderSide, `${card.name}를 가드에 사용했습니다.`);
  return true;
}

export function guardGGuardian(duel, defenderSide, costCardId) {
  const battle = duel.battle;
  if (!battle || battle.step !== 'GUARD' || battle.defenderSide !== defenderSide || battle.defenderCircle !== 'VC') return false;
  const player = duel.players[defenderSide];
  const guardian = bestGGuardian(player);
  if (!guardian) return false;

  const cost = costCardId && player.hand.includes(costCardId) ? costCardId : lowestShieldCard(player.hand);
  if (!cost || !removeFromHand(player, cost)) return false;
  player.drop.push(cost);

  const guardianId = player.gzone.splice(guardian.index, 1)[0];
  const { shield, notes } = applyGGuardianShield(player, guardianId, battle);
  battle.guardCards.push(guardianId);
  battle.note.push(`${cardName(guardianId)}: G 가디언 실드 +${shield} / 비용 ${cardName(cost)}${notes.length ? ` / ${notes.join(', ')}` : ''}`);
  pushLog(duel, defenderSide, `${cardName(guardianId)}를 G 가디언으로 사용했습니다.`);
  return true;
}

export function guardEnd(duel) {
  const battle = duel.battle;
  if (!battle || battle.step !== 'GUARD') return false;
  battle.step = 'RESOLVE';
  resolveBattle(duel);
  battle.step = 'DONE';

  const defender = duel.players[battle.defenderSide];
  battle.guardCards.forEach((cardId) => {
    if (getCard(cardId)?.type === 'g-guardian') defender.gzone.push(cardId);
    else defender.drop.push(cardId);
  });
  duel.battle = null;
  return true;
}

function resolveBattle(duel) {
  const battle = duel.battle;
  const attackerPlayer = duel.players[battle.attackerSide];
  const defenderPlayer = duel.players[battle.defenderSide];
  const attacker = attackerPlayer.circles[battle.attackerCircle];
  const defender = defenderPlayer.circles[battle.defenderCircle];
  if (!attacker || !defender) return;

  if (battle.attackerCircle === 'VC') {
    const checks = driveCount(attacker);
    for (let index = 0; index < checks; index += 1) {
      const top = attackerPlayer.deck.shift();
      if (!top) {
        duel.winner = battle.defenderSide;
        pushLog(duel, battle.attackerSide, '드라이브 체크 중 덱이 비었습니다.');
        return;
      }
      attackerPlayer.hand.push(top);
      battle.driveChecks.push(top);
      const trigger = getCard(top)?.trigger;
      if (trigger) applyTrigger(duel, battle.attackerSide, trigger, 'drive');
    }
  }

  const attackPower = battleAttackPower(duel, battle);
  const defenderPower = powerOfUnit(defender) + (battle.defenderCircle === 'VC' ? battle.guardShield : 0);
  const hit = battle.defenderCircle === 'VC' && battle.perfectGuard ? false : attackPower >= defenderPower;
  battle.note.push(`파워 비교: 공격 ${attackPower} vs 방어 ${defenderPower}`);

  if (!hit) {
    pushLog(duel, battle.attackerSide, '공격이 막혔습니다.');
    return;
  }

  pushLog(duel, battle.attackerSide, '공격이 히트했습니다.');
  if (battle.defenderCircle !== 'VC') {
    defenderPlayer.drop.push(defender.cardId);
    defenderPlayer.circles[battle.defenderCircle] = null;
    pushLog(duel, battle.defenderSide, `${cardName(defender.cardId)}가 퇴각했습니다.`);
    return;
  }

  const critical = 1 + Number(attacker.critMod || 0);
  for (let index = 0; index < critical; index += 1) {
    const top = defenderPlayer.deck.shift();
    if (!top) {
      duel.winner = battle.attackerSide;
      pushLog(duel, battle.defenderSide, '데미지 체크 중 덱이 비었습니다.');
      return;
    }
    defenderPlayer.damage.push(top);
    battle.damageChecks.push(top);
    const trigger = getCard(top)?.trigger;
    if (trigger) applyTrigger(duel, battle.defenderSide, trigger, 'damage');
    if (defenderPlayer.damage.length >= 6) {
      duel.winner = battle.attackerSide;
      pushLog(duel, battle.attackerSide, '6데미지로 승리했습니다.');
      return;
    }
  }
}

function emptyRearCircle(player) {
  return REAR_CIRCLES.find((circle) => !player.circles[circle]) || null;
}

function bestCallFromHand(player) {
  return [...player.hand]
    .map((cardId) => {
      const card = getCard(cardId);
      if (!card || card.type === 'sentinel') return null;
      const triggerPenalty = card.type === 'trigger' ? 1 : 0;
      return { cardId, grade: card.grade, power: Number(card.power || 0), triggerPenalty };
    })
    .filter(Boolean)
    .sort((a, b) => (a.triggerPenalty - b.triggerPenalty) || (b.power - a.power) || (b.grade - a.grade))[0]?.cardId || null;
}

function aiMainPhase(duel) {
  const side = 'opp';
  const player = duel.players[side];
  autoRide(duel, side);
  strideWithAutoCost(duel, side);
  for (let index = 0; index < 2; index += 1) {
    const circle = emptyRearCircle(player);
    const cardId = bestCallFromHand(player);
    if (!circle || !cardId) break;
    callFromHand(duel, side, cardId, circle);
  }
  activateVCAct(duel, side);
}

function autoMainPhaseForSide(duel, side) {
  const player = duel.players[side];
  autoRide(duel, side);
  strideWithAutoCost(duel, side);
  for (let index = 0; index < 2; index += 1) {
    const circle = emptyRearCircle(player);
    const cardId = bestCallFromHand(player);
    if (!circle || !cardId) break;
    callFromHand(duel, side, cardId, circle);
  }
  activateVCAct(duel, side);
}

function canGGuardianBlock(player, defenseTotal, attackPower) {
  const guardian = bestGGuardian(player);
  return Boolean(guardian && player.hand.length > 0 && defenseTotal + guardian.shield > attackPower);
}

function aiGuard(duel) {
  const battle = duel.battle;
  if (!battle || battle.step !== 'GUARD' || battle.defenderSide !== 'opp' || battle.defenderCircle !== 'VC') return false;
  const player = duel.players.opp;
  const defender = player.circles.VC;
  const attackPower = battleAttackPower(duel, battle);
  const baseDefense = powerOfUnit(defender);

  if (baseDefense + battle.guardShield > attackPower) return true;
  const sentinel = player.hand.find((cardId) => getCard(cardId)?.type === 'sentinel');
  const highDamage = player.damage.length >= 4;
  if (highDamage && canGGuardianBlock(player, baseDefense + battle.guardShield, attackPower) && guardGGuardian(duel, 'opp')) return true;
  if (sentinel && player.hand.length >= 2) return guardAddFromHand(duel, 'opp', sentinel);
  if (canGGuardianBlock(player, baseDefense + battle.guardShield, attackPower) && guardGGuardian(duel, 'opp')) return true;

  const guards = [...player.hand]
    .map((cardId) => ({ cardId, shield: Number(getCard(cardId)?.shield || 0), sentinel: getCard(cardId)?.type === 'sentinel' }))
    .filter((row) => row.shield > 0 && !row.sentinel)
    .sort((a, b) => b.shield - a.shield);

  for (const guard of guards) {
    if (baseDefense + battle.guardShield > attackPower) break;
    guardAddFromHand(duel, 'opp', guard.cardId);
  }
  return true;
}

function aiBattlePhase(duel, autoGuardMe = false) {
  if (duel.active !== 'opp' || duel.phase !== 'BATTLE' || duel.battle) return false;
  const attackers = ['RC_FL', 'RC_FR', 'VC', 'RC_BL', 'RC_BR', 'RC_BC'];
  for (const circle of attackers) {
    if (!canAttack(duel, 'opp', circle)) continue;
    if (!duel.players.me.circles.VC) return false;
    if (!declareAttack(duel, circle, 'VC')) continue;
    if (autoGuardMe) {
      autoGuardPlayer(duel, 'me');
      guardEnd(duel);
    }
    return true;
  }
  return false;
}

function autoBattlePhaseForSide(duel, side) {
  if (duel.active !== side || duel.phase !== 'BATTLE' || duel.battle) return false;
  const attackers = ['RC_FL', 'RC_FR', 'VC', 'RC_BL', 'RC_BR', 'RC_BC'];
  for (const circle of attackers) {
    if (!canAttack(duel, side, circle)) continue;
    if (!duel.players[opponent(side)].circles.VC) return false;
    if (!declareAttack(duel, circle, 'VC')) continue;
    return true;
  }
  return false;
}

export function autoGuardPlayer(duel, side) {
  const battle = duel.battle;
  if (!battle || battle.step !== 'GUARD' || battle.defenderSide !== side || battle.defenderCircle !== 'VC') return false;
  const player = duel.players[side];
  const defender = player.circles.VC;
  const attackPower = battleAttackPower(duel, battle);
  const baseDefense = powerOfUnit(defender);
  if (baseDefense + battle.guardShield > attackPower) return true;

  const sentinel = player.hand.find((cardId) => getCard(cardId)?.type === 'sentinel');
  const highDamage = player.damage.length >= 4;
  if (highDamage && canGGuardianBlock(player, baseDefense + battle.guardShield, attackPower) && guardGGuardian(duel, side)) return true;
  if (sentinel && player.hand.length >= 2 && guardAddFromHand(duel, side, sentinel)) return true;
  if (canGGuardianBlock(player, baseDefense + battle.guardShield, attackPower) && guardGGuardian(duel, side)) return true;

  const guards = [...player.hand]
    .map((cardId) => ({ cardId, shield: Number(getCard(cardId)?.shield || 0), sentinel: getCard(cardId)?.type === 'sentinel' }))
    .filter((row) => row.shield > 0 && !row.sentinel)
    .sort((a, b) => b.shield - a.shield);
  for (const guard of guards) {
    if (baseDefense + battle.guardShield > attackPower) break;
    guardAddFromHand(duel, side, guard.cardId);
  }
  return true;
}

export function aiStep(duel, firstTurnNoDraw = DEFAULT_RULES.firstTurnNoDraw, autoGuardMe = false) {
  if (duel.winner) return false;

  if (duel.battle && duel.battle.step === 'GUARD') {
    if (duel.battle.defenderSide === 'opp') {
      aiGuard(duel);
      guardEnd(duel);
      return true;
    }
    if (duel.battle.defenderSide === 'me' && autoGuardMe) {
      autoGuardPlayer(duel, 'me');
      guardEnd(duel);
      return true;
    }
    return false;
  }

  if (duel.active !== 'opp') return false;
  if (duel.phase === 'STAND' || duel.phase === 'DRAW') return advancePhase(duel, firstTurnNoDraw);
  if (duel.phase === 'MAIN') {
    aiMainPhase(duel);
    return advancePhase(duel, firstTurnNoDraw);
  }
  if (duel.phase === 'BATTLE') {
    const attacked = aiBattlePhase(duel, autoGuardMe);
    if (!attacked && !duel.battle) return advancePhase(duel, firstTurnNoDraw);
    return true;
  }
  if (duel.phase === 'END') return endTurn(duel);
  return false;
}

export function summarizeDuel(duel) {
  return {
    turn: duel.turn,
    phase: duel.phase,
    active: duel.active,
    winner: duel.winner,
    meDamage: duel.players.me.damage.length,
    oppDamage: duel.players.opp.damage.length,
    meHand: duel.players.me.hand.length,
    oppHand: duel.players.opp.hand.length,
    meDeck: duel.players.me.deck.length,
    oppDeck: duel.players.opp.deck.length,
    logHead: duel.log?.[0] || '',
  };
}

function zoneUnits(player) {
  return Object.entries(player?.circles || {})
    .filter(([, unit]) => Boolean(unit))
    .map(([circle, unit]) => ({ circle, unit, card: getCard(unit.cardId) }))
    .filter((row) => row.card);
}

function handShieldProfile(player) {
  const cards = Array.isArray(player?.hand) ? player.hand.map(getCard).filter(Boolean) : [];
  return cards.reduce((profile, card) => {
    profile.totalShield += Number(card.shield || 0);
    if (card.type === 'sentinel') profile.sentinels += 1;
    if (card.type === 'trigger') profile.triggers += 1;
    if (card.type === 'normal') profile.normalUnits += 1;
    return profile;
  }, { totalShield: 0, sentinels: 0, triggers: 0, normalUnits: 0 });
}

function bestRideCandidate(player) {
  const vcGrade = getCard(player?.circles?.VC?.cardId)?.grade ?? -1;
  const wantGrade = Math.min(vcGrade + 1, 3);
  return (player?.hand || [])
    .map((cardId) => getCard(cardId))
    .find((card) => card && card.type === 'normal' && card.grade === wantGrade) || null;
}

function bestCallCandidate(player) {
  const vcGrade = getCard(player?.circles?.VC?.cardId)?.grade ?? 0;
  return (player?.hand || [])
    .map((cardId) => getCard(cardId))
    .filter((card) => card && card.type !== 'sentinel' && card.type !== 'trigger' && Number(card.grade || 0) <= vcGrade)
    .sort((a, b) => Number(b.power || 0) - Number(a.power || 0))[0] || null;
}

function attackCandidatesFor(duel, side) {
  return CIRCLES
    .filter((circle) => canAttack(duel, side, circle))
    .map((circle) => {
      const unit = duel.players[side].circles[circle];
      const booster = boosterFor(circle);
      const boostPower = booster && duel.players[side].circles[booster] && !duel.players[side].circles[booster].isRest
        ? powerOfUnit(duel.players[side].circles[booster])
        : 0;
      return {
        circle,
        cardName: cardName(unit.cardId),
        power: powerOfUnit(unit) + boostPower,
        boostPower,
      };
    })
    .sort((a, b) => b.power - a.power);
}

function reportAction(id, title, detail, priority = 'normal') {
  return { id, title, detail, priority };
}

export function duelTacticalReport(duel, perspective = 'me') {
  const side = perspective === 'opp' ? 'opp' : 'me';
  const rival = opponent(side);
  const player = duel?.players?.[side] || initPlayerState([], [], 1);
  const enemy = duel?.players?.[rival] || initPlayerState([], [], 2);
  const playerUnits = zoneUnits(player);
  const enemyUnits = zoneUnits(enemy);
  const playerPower = playerUnits.reduce((sum, row) => sum + powerOfUnit(row.unit), 0);
  const enemyPower = enemyUnits.reduce((sum, row) => sum + powerOfUnit(row.unit), 0);
  const fieldDelta = playerUnits.length - enemyUnits.length;
  const powerDelta = playerPower - enemyPower;
  const damageDelta = enemy.damage.length - player.damage.length;
  const shield = handShieldProfile(player);
  const rideCandidate = Number(player.rideTurn || 0) === Number(duel?.turn || 0)
    ? null
    : bestRideCandidate(player);
  const callCandidate = bestCallCandidate(player);
  const attackCandidates = attackCandidatesFor(duel, side);
  const recommendations = [];

  let guard = null;
  if (duel?.battle && duel.battle.defenderSide === side) {
    const attackPower = battleAttackPower(duel, duel.battle);
    const baseDefense = powerOfUnit(player.circles[duel.battle.defenderCircle]);
    const guardNeeded = Math.max(0, attackPower - baseDefense + 1 - Number(duel.battle.guardShield || 0));
    guard = {
      attackPower,
      baseDefense,
      currentShield: Number(duel.battle.guardShield || 0),
      guardNeeded,
      availableShield: shield.totalShield,
      perfectGuard: Boolean(duel.battle.perfectGuard),
    };
    recommendations.push(reportAction(
      'guard',
      guardNeeded > 0 ? '가드 보강' : '가드 종료',
      guardNeeded > 0
        ? `추가 실드가 약 ${guardNeeded.toLocaleString('ko-KR')} 필요합니다. 센티넬 ${shield.sentinels}장, 총 실드 ${shield.totalShield.toLocaleString('ko-KR')}을 확인하세요.`
        : '현재 가드 수치로 공격을 막을 수 있습니다. 가드 종료를 진행하세요.',
      'high',
    ));
  } else if (duel?.winner) {
    recommendations.push(reportAction('record', '결과 기록', `${SIDE_LABELS[duel.winner]} 승리입니다. 전적 저장과 로그 확인을 진행하세요.`, 'high'));
  } else if (duel?.active !== side) {
    recommendations.push(reportAction('wait', '상대 진행', `${SIDE_LABELS[rival]} 차례입니다. AI 진행으로 다음 판단 지점까지 넘기세요.`, 'normal'));
  } else if (duel.phase === 'STAND' || duel.phase === 'DRAW') {
    recommendations.push(reportAction('phase', '다음 페이즈', '스탠드/드로우 처리를 마치고 메인 페이즈로 넘어가세요.', 'normal'));
  } else if (duel.phase === 'MAIN') {
    if (rideCandidate) {
      recommendations.push(reportAction('ride', `${rideCandidate.name} 라이드`, `현재 라이드 라인을 이어갈 Grade ${rideCandidate.grade} 후보입니다.`, 'high'));
    }
    const vcCard = getCard(player.circles.VC?.cardId);
    const canStride = vcCard?.grade >= 3 && !player.isStrided && (player.gzone || []).some((cardId) => getCard(cardId)?.type === 'g-unit');
    if (canStride) {
      recommendations.push(reportAction('stride', '스트라이드', 'G3 이상 VC와 G존 후보가 있습니다. 스트라이드로 공격 압박을 높이세요.', 'high'));
    }
    const emptyRear = REAR_CIRCLES.filter((circle) => !player.circles[circle]).length;
    if (callCandidate && emptyRear > 0) {
      recommendations.push(reportAction('call', `${callCandidate.name} 콜`, `빈 리어가드 서클 ${emptyRear}칸이 있습니다. 전열/후열 전개를 보강하세요.`, 'normal'));
    }
    recommendations.push(reportAction('battle', '배틀 준비', '라이드/콜/스킬 처리가 끝났다면 배틀 페이즈로 넘어가 공격 순서를 잡으세요.', 'low'));
  } else if (duel.phase === 'BATTLE') {
    if (attackCandidates.length) {
      const first = attackCandidates[0];
      recommendations.push(reportAction('attack', `${first.circle} 공격`, `${first.cardName} 라인이 ${first.power.toLocaleString('ko-KR')} 파워로 가장 강합니다.`, 'high'));
    } else {
      recommendations.push(reportAction('end-battle', '페이즈 종료', '공격 가능한 유닛이 없습니다. 엔드 페이즈로 진행하세요.', 'normal'));
    }
  } else {
    recommendations.push(reportAction('end', '턴 종료', '처리할 행동이 적습니다. 다음 턴으로 넘기세요.', 'normal'));
  }

  if (!duel?.winner && player.damage.length >= 5) {
    recommendations.push(reportAction('danger-damage', '5데미지 위험', '다음 히트가 패배로 이어질 수 있습니다. 센티넬과 G가디언을 아끼지 마세요.', 'high'));
  }
  if (!duel?.winner && player.deck.length <= 8) {
    recommendations.push(reportAction('deckout', '덱 부족', '덱이 얼마 남지 않았습니다. 장기전보다 빠른 마무리를 노리세요.', 'high'));
  }

  const riskScore = (player.damage.length >= 5 ? 3 : player.damage.length >= 4 ? 2 : 0)
    + (damageDelta < -1 ? 2 : damageDelta < 0 ? 1 : 0)
    + (fieldDelta < -1 ? 1 : 0)
    + (shield.totalShield < 15000 && player.damage.length >= 3 ? 1 : 0)
    + (player.deck.length <= 8 ? 1 : 0);
  const riskLabel = duel?.winner
    ? '종료'
    : riskScore >= 4
      ? '위험'
      : riskScore >= 2
        ? '주의'
        : '안정';
  const readinessPct = Math.max(0, Math.min(100, Math.round(
    58
    + Math.max(-16, Math.min(16, damageDelta * 7))
    + Math.max(-12, Math.min(12, fieldDelta * 5))
    + Math.max(-12, Math.min(12, powerDelta / 3000))
    + Math.min(8, shield.sentinels * 4)
    + (attackCandidates.length ? 6 : 0)
    - (guard?.guardNeeded > 0 ? 10 : 0)
  )));
  const firstAction = recommendations[0] || reportAction('check', '상태 확인', '전장과 패를 확인하세요.', 'normal');

  return {
    side,
    rival,
    phase: duel?.phase || 'STAND',
    active: duel?.active || side,
    riskLabel,
    readinessPct,
    recommendedAction: firstAction.title,
    headline: `${riskLabel} · ${firstAction.title}`,
    fieldDelta,
    powerDelta,
    damageDelta,
    playerDamage: player.damage.length,
    enemyDamage: enemy.damage.length,
    playerDeck: player.deck.length,
    enemyDeck: enemy.deck.length,
    shield,
    guard,
    attackCandidates: attackCandidates.slice(0, 4),
    recommendations: recommendations.slice(0, 6),
  };
}

function replaySideFromLog(line) {
  const match = String(line || '').match(/^\[([^\]]+)\]\s*(.*)$/);
  if (!match) return { side: '', text: String(line || '') };
  const label = match[1];
  const side = Object.entries(SIDE_LABELS).find(([, value]) => value === label)?.[0] || '';
  return { side, text: match[2] || '' };
}

function replayTurnRow(turn) {
  return {
    turn,
    lines: 0,
    meActions: 0,
    oppActions: 0,
    rides: 0,
    calls: 0,
    strides: 0,
    attacks: 0,
    hits: 0,
    guards: 0,
    checks: 0,
    decisive: 0,
    highlights: [],
  };
}

function replayPriority(text) {
  if (/승리|패배|6데미지|덱이 비었습니다/.test(text)) return 'decisive';
  if (/히트|막혔|G 가디언|완전 가드/.test(text)) return 'swing';
  if (/공격|스트라이드|VC 스킬/.test(text)) return 'tempo';
  if (/라이드|콜|가드/.test(text)) return 'normal';
  return 'low';
}

function replayLabel(line, turn) {
  const parsed = replaySideFromLog(line);
  const sideLabel = parsed.side ? SIDE_LABELS[parsed.side] : '시스템';
  return `T${turn} · ${sideLabel} · ${parsed.text}`;
}

export function vanguardReplayReport(duel) {
  const safe = duel && typeof duel === 'object' ? duel : {};
  const chronological = (Array.isArray(safe.log) ? safe.log : []).slice().reverse();
  const rowMap = new Map();
  let currentTurn = 1;
  let meGuardCount = 0;
  let oppGuardCount = 0;
  let meAttackCount = 0;
  let oppAttackCount = 0;
  let decisiveLine = '';

  const ensureRow = (turn) => {
    const safeTurn = Math.max(1, Math.floor(Number(turn || 1)));
    if (!rowMap.has(safeTurn)) rowMap.set(safeTurn, replayTurnRow(safeTurn));
    return rowMap.get(safeTurn);
  };

  chronological.forEach((line) => {
    const parsed = replaySideFromLog(line);
    const turnMatch = parsed.text.match(/턴\s*(\d+)/);
    if (turnMatch) currentTurn = Math.max(1, Number(turnMatch[1] || currentTurn));
    const row = ensureRow(currentTurn);
    row.lines += 1;
    if (parsed.side === 'me') row.meActions += 1;
    if (parsed.side === 'opp') row.oppActions += 1;

    if (/라이드/.test(parsed.text)) row.rides += 1;
    if (/콜/.test(parsed.text)) row.calls += 1;
    if (/스트라이드/.test(parsed.text)) row.strides += 1;
    if (/공격/.test(parsed.text)) {
      row.attacks += 1;
      if (parsed.side === 'me') meAttackCount += 1;
      if (parsed.side === 'opp') oppAttackCount += 1;
    }
    if (/히트/.test(parsed.text)) row.hits += 1;
    if (/가드/.test(parsed.text)) {
      row.guards += 1;
      if (parsed.side === 'me') meGuardCount += 1;
      if (parsed.side === 'opp') oppGuardCount += 1;
    }
    if (/체크/.test(parsed.text)) row.checks += 1;
    if (/승리|패배|6데미지|덱이 비었습니다/.test(parsed.text)) {
      row.decisive += 1;
      decisiveLine = replayLabel(line, currentTurn);
    }

    const priority = replayPriority(parsed.text);
    if (priority !== 'low' || row.highlights.length < 2) {
      row.highlights.push({
        label: replayLabel(line, currentTurn),
        priority,
      });
    }
  });

  const turnRows = [...rowMap.values()].map((row) => {
    const tempoDelta = row.meActions - row.oppActions + row.strides + row.hits;
    const guardPressure = row.attacks - row.guards;
    return {
      ...row,
      tempoDelta,
      guardPressure,
      summary: `공격 ${row.attacks} · 히트 ${row.hits} · 가드 ${row.guards} · 전개 ${row.rides + row.calls + row.strides}`,
      highlights: row.highlights.slice(-4).reverse(),
    };
  }).sort((a, b) => b.turn - a.turn);

  const battle = safe.battle || null;
  let guardAudit = null;
  if (battle?.step === 'GUARD') {
    const defender = safe.players?.[battle.defenderSide]?.circles?.[battle.defenderCircle] || null;
    const attackPower = battleAttackPower(safe, battle);
    const baseDefense = powerOfUnit(defender);
    const guardShield = Number(battle.guardShield || 0);
    const guardNeeded = Math.max(0, attackPower - baseDefense - guardShield + 1);
    const defenderHand = safe.players?.[battle.defenderSide]?.hand || [];
    const shield = handShieldProfile(safe.players?.[battle.defenderSide] || {});
    guardAudit = {
      defenderSide: battle.defenderSide,
      defenderLabel: SIDE_LABELS[battle.defenderSide] || battle.defenderSide,
      attackerCircle: battle.attackerCircle,
      attackPower,
      baseDefense,
      guardShield,
      guardNeeded,
      perfectGuard: Boolean(battle.perfectGuard),
      handCount: defenderHand.length,
      availableShield: shield.totalShield,
      sentinels: shield.sentinels,
      canGuard: Boolean(battle.perfectGuard || guardNeeded <= 0 || shield.totalShield >= guardNeeded || shield.sentinels > 0),
    };
  }

  const meDamage = safe.players?.me?.damage?.length || 0;
  const oppDamage = safe.players?.opp?.damage?.length || 0;
  const damageSwing = oppDamage - meDamage;
  const latest = turnRows[0] || null;
  const headline = latest
    ? `T${latest.turn}까지 ${chronological.length}개 로그 · 데미지 차이 ${damageSwing >= 0 ? '+' : ''}${damageSwing}`
    : '아직 리플레이 로그가 없습니다.';
  const recommendations = [
    guardAudit?.guardNeeded > 0 ? `현재 가드 필요량 ${guardAudit.guardNeeded.toLocaleString('ko-KR')}입니다. 센티넬/G가디언/패 실드를 먼저 계산하세요.` : '',
    damageSwing < 0 ? '데미지 레이스가 밀립니다. 다음 턴에는 가드 기준을 높이고 킬각보다 생존을 우선하세요.' : '',
    damageSwing > 1 ? '데미지 레이스가 앞섭니다. 스트라이드나 전열 라인으로 마무리 압박을 유지하세요.' : '',
    meAttackCount < oppAttackCount ? '내 공격 횟수가 적습니다. 리어가드 전개와 부스트 라인을 보강하세요.' : '',
    decisiveLine ? `결정 로그: ${decisiveLine}` : '',
  ].filter(Boolean);
  if (!recommendations.length) recommendations.push('흐름은 안정적입니다. 최근 턴의 공격 순서와 가드 사용량만 점검하면 됩니다.');

  const exportText = turnRows
    .slice()
    .reverse()
    .map((row) => `T${row.turn} | ${row.summary} | 템포 ${row.tempoDelta >= 0 ? '+' : ''}${row.tempoDelta} | ${row.highlights.map((item) => item.label).join(' / ')}`)
    .join('\n');

  return {
    headline,
    logCount: chronological.length,
    turnCount: turnRows.length,
    damageSwing,
    meDamage,
    oppDamage,
    meGuardCount,
    oppGuardCount,
    meAttackCount,
    oppAttackCount,
    decisiveLine,
    guardAudit,
    turnRows,
    exportText,
    recommendations,
  };
}

function cardExportSnapshot(cardId) {
  const card = getCard(cardId);
  if (!card) return { id: cardId || '', name: cardId || 'Unknown' };
  return {
    id: card.id,
    name: card.name,
    clan: card.clan,
    type: card.type,
    grade: Number(card.grade || 0),
    power: Number(card.power || 0),
    shield: Number(card.shield || 0),
    trigger: card.trigger || '',
    tags: Array.isArray(card.tags) ? card.tags.slice(0, 8) : [],
  };
}

function unitExportSnapshot(unit) {
  if (!unit) return null;
  return {
    cardId: unit.cardId || '',
    card: cardExportSnapshot(unit.cardId),
    isRest: Boolean(unit.isRest),
    powerMod: Number(unit.powerMod || 0),
    critMod: Number(unit.critMod || 0),
  };
}

function playerExportSnapshot(player = {}) {
  return {
    damage: Array.isArray(player.damage) ? player.damage.map(cardExportSnapshot) : [],
    damageCount: Array.isArray(player.damage) ? player.damage.length : 0,
    deckCount: Array.isArray(player.deck) ? player.deck.length : 0,
    hand: Array.isArray(player.hand) ? player.hand.map(cardExportSnapshot) : [],
    handCount: Array.isArray(player.hand) ? player.hand.length : 0,
    dropCount: Array.isArray(player.drop) ? player.drop.length : 0,
    removedCount: Array.isArray(player.removed) ? player.removed.length : 0,
    soulCount: Array.isArray(player.soul) ? player.soul.length : 0,
    gzoneCount: Array.isArray(player.gzone) ? player.gzone.length : 0,
    circles: Object.fromEntries(
      CIRCLES.map((circle) => [circle, unitExportSnapshot(player.circles?.[circle])]),
    ),
    isStrided: Boolean(player.isStrided),
    heart: unitExportSnapshot(player.heart),
    cbUsedTotal: Number(player.cbUsedTotal || 0),
  };
}

function deckExportSnapshot(deck, rules = DEFAULT_RULES) {
  const safeDeck = deck && typeof deck === 'object' ? deck : {};
  return {
    id: safeDeck.id || '',
    name: safeDeck.name || 'Deck',
    clan: safeDeck.clan || '',
    score: scoreDeck(safeDeck, rules),
    summary: summarizeDeck(safeDeck),
    validation: validateDeck(safeDeck, rules),
    main: Array.isArray(safeDeck.main) ? safeDeck.main : [],
    gzone: Array.isArray(safeDeck.gzone) ? safeDeck.gzone : [],
  };
}

function battleExportSnapshot(duel) {
  const battle = duel?.battle;
  if (!battle) return null;
  return {
    attackerSide: battle.attackerSide,
    attackerCircle: battle.attackerCircle,
    defenderSide: battle.defenderSide,
    defenderCircle: battle.defenderCircle,
    step: battle.step,
    attackPower: battleAttackPower(duel, battle),
    boostPower: Number(battle.boostPower || 0),
    attackBonus: Number(battle.attackBonus || 0),
    guardShield: Number(battle.guardShield || 0),
    perfectGuard: Boolean(battle.perfectGuard),
    guardCards: Array.isArray(battle.guardCards) ? battle.guardCards.map(cardExportSnapshot) : [],
    driveChecks: Array.isArray(battle.driveChecks) ? battle.driveChecks.map(cardExportSnapshot) : [],
    damageChecks: Array.isArray(battle.damageChecks) ? battle.damageChecks.map(cardExportSnapshot) : [],
    note: Array.isArray(battle.note) ? battle.note : [],
  };
}

function replayExportAuditRows({ duel, replayReport, matchupReport, validation, opponentValidation, jsonText }) {
  const logCount = Array.isArray(duel?.log) ? duel.log.length : 0;
  const hasDeckErrors = validation.errors.length > 0 || opponentValidation.errors.length > 0;
  const sizeKb = Math.max(1, Math.ceil(String(jsonText || '').length / 1024));
  const matchupSamples = Number(matchupReport?.samples || 0);
  return [
    {
      id: 'payload',
      label: '패키지',
      status: duel?.players?.me && duel?.players?.opp ? 'OK' : '확인 필요',
      detail: duel?.players?.me && duel?.players?.opp ? '양쪽 플레이어 상태를 포함했습니다.' : '듀얼 상태가 비어 있습니다.',
      tone: duel?.players?.me && duel?.players?.opp ? 'green' : 'gold',
    },
    {
      id: 'deck',
      label: '덱 검증',
      status: hasDeckErrors ? '오류' : 'OK',
      detail: `내 덱 오류 ${validation.errors.length}건 / AI 덱 오류 ${opponentValidation.errors.length}건입니다.`,
      tone: hasDeckErrors ? 'red' : 'green',
    },
    {
      id: 'replay',
      label: '리플레이',
      status: replayReport.turnCount ? 'OK' : '대기',
      detail: `턴 ${replayReport.turnCount}개, 로그 ${replayReport.logCount}개, 데미지 차이 ${replayReport.damageSwing >= 0 ? '+' : ''}${replayReport.damageSwing}입니다.`,
      tone: replayReport.turnCount ? 'green' : 'gold',
    },
    {
      id: 'guard',
      label: '가드 감사',
      status: replayReport.guardAudit ? (replayReport.guardAudit.canGuard ? '방어 가능' : '방어 부족') : 'OK',
      detail: replayReport.guardAudit
        ? `필요 실드 ${replayReport.guardAudit.guardNeeded.toLocaleString('ko-KR')} / 가용 ${replayReport.guardAudit.availableShield.toLocaleString('ko-KR')}입니다.`
        : '현재 열린 가드 창이 없습니다.',
      tone: replayReport.guardAudit ? (replayReport.guardAudit.canGuard ? 'green' : 'gold') : 'green',
    },
    {
      id: 'matchup',
      label: '매치업 실험',
      status: matchupSamples ? 'OK' : '대기',
      detail: `${matchupSamples}판 실험, 승률 ${Number(matchupReport?.winRate || 0)}%입니다.`,
      tone: matchupSamples ? 'green' : 'gold',
    },
    {
      id: 'log',
      label: '로그',
      status: logCount ? 'OK' : '대기',
      detail: `${logCount}개 로그를 최신 상태 스냅샷과 함께 보관합니다.`,
      tone: logCount ? 'green' : 'gold',
    },
    {
      id: 'size',
      label: '크기',
      status: sizeKb <= 512 ? 'OK' : '큼',
      detail: `약 ${sizeKb.toLocaleString('ko-KR')}KB JSON입니다.`,
      tone: sizeKb <= 512 ? 'green' : 'gold',
    },
  ];
}

export function vanguardReplayExportForState({
  duel,
  deck,
  opponentDeck,
  rules = DEFAULT_RULES,
  seed = Date.now(),
  matchupReport = null,
} = {}) {
  const safeDuel = duel && typeof duel === 'object'
    ? duel
    : initDuelState({ meDeck: deck, oppDeck: opponentDeck, seed, firstTurnNoDraw: normalizeRules(rules).firstTurnNoDraw });
  const normalizedRules = normalizeRules(rules);
  const replayReport = vanguardReplayReport(safeDuel);
  const tacticalReport = duelTacticalReport(safeDuel, 'me');
  const validation = validateDeck(deck, normalizedRules);
  const opponentValidation = validateDeck(opponentDeck, normalizedRules);
  const safeMatchupReport = matchupReport || playtestMatchupReport(deck, opponentDeck, seed, normalizedRules, 20);
  const exportId = `ba-vanguard-${Number(seed || 0)}-t${Number(safeDuel.turn || 1)}-${safeDuel.phase || 'STAND'}`;
  const safeExportId = String(exportId).replace(/[^a-zA-Z0-9_-]/g, '-');
  const payload = {
    format: 'ba-vanguard-replay-v1',
    gameSlug: GAME_SLUG,
    saveVersion: SAVE_VERSION,
    exportedAt: new Date().toISOString(),
    seed: Number(seed || 0),
    rules: normalizedRules,
    duel: {
      turn: Number(safeDuel.turn || 1),
      phase: safeDuel.phase || 'STAND',
      active: safeDuel.active || 'me',
      first: safeDuel.first || 'me',
      winner: safeDuel.winner || '',
      battle: battleExportSnapshot(safeDuel),
      players: {
        me: playerExportSnapshot(safeDuel.players?.me),
        opp: playerExportSnapshot(safeDuel.players?.opp),
      },
    },
    decks: {
      me: deckExportSnapshot(deck, normalizedRules),
      opp: deckExportSnapshot(opponentDeck, normalizedRules),
    },
    tacticalReport,
    replayReport,
    matchupReport: safeMatchupReport,
    log: Array.isArray(safeDuel.log) ? safeDuel.log.slice().reverse() : [],
    serializedDuel: safeDuel,
  };
  const jsonText = JSON.stringify(payload, null, 2);
  const auditRows = replayExportAuditRows({
    duel: safeDuel,
    replayReport,
    matchupReport: safeMatchupReport,
    validation,
    opponentValidation,
    jsonText,
  });
  const blockingRows = auditRows.filter((row) => row.status === '오류' || row.status === '확인 필요');
  const pendingRows = auditRows.filter((row) => row.status !== 'OK');
  const sizeKb = Math.max(1, Math.ceil(jsonText.length / 1024));

  return {
    format: payload.format,
    fileName: `${safeExportId}.json`,
    payload,
    jsonText,
    previewText: jsonText.length > 4200 ? `${jsonText.slice(0, 4200)}\n...` : jsonText,
    sizeLabel: `${sizeKb.toLocaleString('ko-KR')}KB`,
    byteSize: jsonText.length,
    auditRows,
    ready: blockingRows.length === 0,
    statusLabel: pendingRows.length ? `${pendingRows.length}건 확인` : '내보내기 가능',
    replayReport,
    matchupReport: safeMatchupReport,
  };
}

function runAutoPlaytestDuel(meDeck, oppDeck, seed, rules = DEFAULT_RULES, first = 'me') {
  const duel = initDuelState({
    meDeck,
    oppDeck,
    seed,
    first,
    firstTurnNoDraw: rules.firstTurnNoDraw,
  });
  for (let step = 0; step < 260 && !duel.winner; step += 1) {
    if (duel.battle?.step === 'GUARD') {
      autoGuardPlayer(duel, duel.battle.defenderSide);
      guardEnd(duel);
      continue;
    }
    if (duel.phase === 'STAND' || duel.phase === 'DRAW') {
      advancePhase(duel, rules.firstTurnNoDraw);
      continue;
    }
    if (duel.phase === 'MAIN') {
      autoMainPhaseForSide(duel, duel.active);
      advancePhase(duel, rules.firstTurnNoDraw);
      continue;
    }
    if (duel.phase === 'BATTLE') {
      if (!autoBattlePhaseForSide(duel, duel.active)) advancePhase(duel, rules.firstTurnNoDraw);
      continue;
    }
    if (duel.phase === 'END') {
      endTurn(duel);
      continue;
    }
    break;
  }
  return duel;
}

export function playtestMatchupReport(meDeck, oppDeck, seed = Date.now(), rules = DEFAULT_RULES, samples = 20) {
  const meValidation = validateDeck(meDeck, rules);
  const oppValidation = validateDeck(oppDeck, rules);
  const safeSamples = Math.max(4, Math.min(40, Math.floor(Number(samples || 20))));
  if (meValidation.errors.length || oppValidation.errors.length) {
    return {
      samples: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winRate: 0,
      averageTurn: 0,
      averageMeDamage: 0,
      averageOppDamage: 0,
      firstWinRate: 0,
      secondWinRate: 0,
      rows: [],
      recommendations: ['규칙 오류가 있는 덱은 매치업 실험을 진행할 수 없습니다. 먼저 덱 검증을 통과해 주세요.'],
    };
  }

  const rows = [];
  for (let index = 0; index < safeSamples; index += 1) {
    const first = index % 2 === 0 ? 'me' : 'opp';
    const duel = runAutoPlaytestDuel(meDeck, oppDeck, Number(seed || 1) + index * 97, rules, first);
    rows.push({
      index: index + 1,
      first,
      winner: duel.winner || '',
      turn: Number(duel.turn || 0),
      meDamage: duel.players.me.damage.length,
      oppDamage: duel.players.opp.damage.length,
      meDeck: duel.players.me.deck.length,
      oppDeck: duel.players.opp.deck.length,
    });
  }

  const wins = rows.filter((row) => row.winner === 'me').length;
  const losses = rows.filter((row) => row.winner === 'opp').length;
  const draws = rows.length - wins - losses;
  const firstRows = rows.filter((row) => row.first === 'me');
  const secondRows = rows.filter((row) => row.first === 'opp');
  const average = (values) => (values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length : 0);
  const recommendations = [];
  const winRate = Math.round((wins / Math.max(1, rows.length)) * 100);
  if (winRate < 45) recommendations.push('매치업 승률이 낮습니다. G3 접근률, 센티넬 수, G가디언 구성을 다시 점검하세요.');
  else if (winRate >= 60) recommendations.push('현재 상대 프리셋 기준 승률이 우세합니다. 실전에서는 선후공과 방어 기준을 더 빡빡하게 테스트하세요.');
  else recommendations.push('매치업 승률은 접전권입니다. 오프닝 안정성과 후반 방어력을 함께 조정해 보세요.');
  if (average(rows.map((row) => row.meDamage)) >= 4.2) recommendations.push('내 평균 데미지가 높습니다. 실드 총량과 자동 가드 기준을 강화하는 편이 좋습니다.');
  if (average(rows.map((row) => row.oppDamage)) <= 3.2) recommendations.push('상대 데미지 압박이 낮습니다. 리어가드 전개와 스트라이드 피니셔 비중을 늘려 보세요.');
  if (draws > 0) recommendations.push('일부 샘플이 제한 턴 안에 끝나지 않았습니다. 자동 실험의 턴 제한을 감안해 해석하세요.');

  return {
    samples: rows.length,
    wins,
    losses,
    draws,
    winRate,
    averageTurn: Math.round(average(rows.map((row) => row.turn)) * 10) / 10,
    averageMeDamage: Math.round(average(rows.map((row) => row.meDamage)) * 10) / 10,
    averageOppDamage: Math.round(average(rows.map((row) => row.oppDamage)) * 10) / 10,
    firstWinRate: Math.round((firstRows.filter((row) => row.winner === 'me').length / Math.max(1, firstRows.length)) * 100),
    secondWinRate: Math.round((secondRows.filter((row) => row.winner === 'me').length / Math.max(1, secondRows.length)) * 100),
    rows: rows.slice(0, 8),
    recommendations: [...new Set(recommendations)].slice(0, 5),
  };
}
