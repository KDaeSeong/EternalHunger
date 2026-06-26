const DEFAULT_PUBLIC_PERKS = [
  {
    code: 'COS_TITLE_ROOKIE',
    name: '루미아 신입 생존자',
    description: '프로필과 결과 화면에서 사용할 수 있는 기본 칭호입니다. 게임 밸런스에는 영향을 주지 않습니다.',
    lpCost: 120,
    category: 'title',
    effects: { cosmeticKind: 'title', title: '루미아 신입 생존자', balanceAffecting: false },
    isActive: true,
  },
  {
    code: 'COS_TITLE_NIGHT_RUNNER',
    name: '야간 루퍼',
    description: '밤 페이즈를 좋아하는 유저용 칭호입니다. 순수 치장 특전입니다.',
    lpCost: 220,
    category: 'title',
    effects: { cosmeticKind: 'title', title: '야간 루퍼', balanceAffecting: false },
    isActive: true,
  },
  {
    code: 'COS_FRAME_SKYLINE',
    name: '스카이라인 초상화 프레임',
    description: '캐릭터 카드에 어울리는 파란 계열 초상화 프레임 콘셉트입니다.',
    lpCost: 350,
    category: 'portrait_frame',
    effects: { cosmeticKind: 'portraitFrame', frame: 'skyline', balanceAffecting: false },
    isActive: true,
  },
  {
    code: 'COS_FRAME_GOLDLINE',
    name: '골드 라인 초상화 프레임',
    description: '우승자 화면에 잘 어울리는 금색 프레임 콘셉트입니다.',
    lpCost: 700,
    category: 'portrait_frame',
    effects: { cosmeticKind: 'portraitFrame', frame: 'goldline', balanceAffecting: false },
    isActive: true,
  },
  {
    code: 'COS_BADGE_ALPHA',
    name: '알파 추적자 배지',
    description: '알파 오브젝트를 노리는 플레이어를 위한 수집형 배지입니다.',
    lpCost: 300,
    category: 'badge',
    effects: { cosmeticKind: 'badge', badge: 'alpha_tracker', balanceAffecting: false },
    isActive: true,
  },
  {
    code: 'COS_BADGE_WEAKLINE',
    name: '위클라인 감시자 배지',
    description: '위클라인 타이밍을 사랑하는 유저용 수집형 배지입니다.',
    lpCost: 480,
    category: 'badge',
    effects: { cosmeticKind: 'badge', badge: 'weakline_watcher', balanceAffecting: false },
    isActive: true,
  },
  {
    code: 'COS_LOG_CYAN',
    name: '청록 로그 하이라이트',
    description: '향후 로그/결과창 꾸미기에 사용할 수 있는 청록색 하이라이트 특전입니다.',
    lpCost: 260,
    category: 'log_style',
    effects: { cosmeticKind: 'logStyle', color: 'cyan', balanceAffecting: false },
    isActive: true,
  },
  {
    code: 'COS_VICTORY_SPOTLIGHT',
    name: '승리 스포트라이트',
    description: '승리 결과창 연출용 스포트라이트 콘셉트입니다. 전투 성능은 변하지 않습니다.',
    lpCost: 900,
    category: 'victory_effect',
    effects: { cosmeticKind: 'victoryEffect', effect: 'spotlight', balanceAffecting: false },
    isActive: true,
  },
];

let seedPromise = null;

function normalizePublicPerk(perk) {
  const code = String(perk?.code || '').trim();
  return {
    code,
    ownerUserId: null,
    name: String(perk?.name || code),
    description: String(perk?.description || ''),
    lpCost: Math.max(0, Math.round(Number(perk?.lpCost || 0))),
    category: String(perk?.category || 'cosmetic'),
    effects: perk?.effects && typeof perk.effects === 'object' ? perk.effects : {},
    isActive: perk?.isActive !== false,
  };
}

async function ensureDefaultPublicPerks(PerkModel) {
  if (!PerkModel) return;
  if (!seedPromise) {
    seedPromise = Promise.all(
      DEFAULT_PUBLIC_PERKS.map((raw) => {
        const perk = normalizePublicPerk(raw);
        return PerkModel.updateOne(
          { ownerUserId: null, code: perk.code },
          { $setOnInsert: perk },
          { upsert: true }
        );
      })
    ).catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  await seedPromise;
}

function isOwnedBy(perk, userId) {
  if (!perk?.ownerUserId || !userId) return false;
  return String(perk.ownerUserId) === String(userId);
}

function dedupeScopedPerks(perks, userId) {
  const rows = Array.isArray(perks) ? perks : [];
  const byCode = new Map();
  for (const perk of rows) {
    const code = String(perk?.code || '').trim();
    if (!code) continue;
    const priority = isOwnedBy(perk, userId) ? 2 : 1;
    const prev = byCode.get(code);
    if (!prev || priority > prev.priority) byCode.set(code, { priority, perk });
  }
  return [...byCode.values()]
    .map((x) => x.perk)
    .sort((a, b) => {
      const ca = String(a?.category || '');
      const cb = String(b?.category || '');
      if (ca !== cb) return ca.localeCompare(cb);
      const costDiff = Number(a?.lpCost || 0) - Number(b?.lpCost || 0);
      if (costDiff) return costDiff;
      return String(a?.name || a?.code || '').localeCompare(String(b?.name || b?.code || ''));
    });
}

module.exports = {
  DEFAULT_PUBLIC_PERKS,
  ensureDefaultPublicPerks,
  dedupeScopedPerks,
};
