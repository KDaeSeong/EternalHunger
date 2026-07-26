const RACE_ACTIONS = Object.freeze({
  P: 'starleague-race-protoss',
  PROTOSS: 'starleague-race-protoss',
  T: 'starleague-race-terran',
  TERRAN: 'starleague-race-terran',
  Z: 'starleague-race-zerg',
  ZERG: 'starleague-race-zerg',
});

const BUILD_ACTIONS = Object.freeze({
  balanced: 'starleague-build-balanced',
  harass: 'starleague-build-harass',
  macro: 'starleague-build-macro',
  rush: 'starleague-build-rush',
  tech: 'starleague-build-tech',
});

export function starleagueRaceAction(race, fallback = 'players') {
  const key = String(race || '').trim().toUpperCase();
  return RACE_ACTIONS[key] || fallback;
}

export function starleagueBuildAction(style, fallback = 'analysis') {
  const key = String(style || '').trim().toLowerCase();
  return BUILD_ACTIONS[key] || fallback;
}

const BROADCAST_LINE_CUES = Object.freeze({
  'starleague-ace': 'starleagueBroadcastFinal',
  'starleague-analysis': 'starleagueBroadcastAnalysis',
  'starleague-broadcast': 'starleagueBroadcastOpening',
  'starleague-build-harass': 'starleagueBroadcastStrategy',
  'starleague-build-macro': 'starleagueBroadcastStrategy',
  'starleague-build-rush': 'starleagueBroadcastRush',
  'starleague-build-tech': 'starleagueBroadcastStrategy',
  'starleague-caster': 'starleagueBroadcastOpening',
  'starleague-clash': 'starleagueBroadcastImpact',
  'starleague-clutch': 'starleagueBroadcastFinal',
  'starleague-comeback': 'starleagueBroadcastMomentum',
  'starleague-reverse-sweep': 'starleagueBroadcastMomentum',
  'starleague-sweep': 'starleagueBroadcastResult',
  'starleague-upset': 'starleagueBroadcastImpact',
});

export function starleagueBroadcastLineAction(caster, text) {
  const role = String(caster || '').trim().toLowerCase();
  const line = String(text || '').trim().toLowerCase();

  if (/에이스|ace/.test(line)) return 'starleague-ace';
  if (/역스윕|reverse sweep/.test(line)) return 'starleague-reverse-sweep';
  if (/셧아웃|완봉|스윕|sweep/.test(line)) return 'starleague-sweep';
  if (/최종 세트|마지막 세트|매치 포인트|끝장 승부|decider/.test(line)) return 'starleague-clutch';
  if (/이변|업셋|예측을? (?:뒤집|비튼)|upset/.test(line)) return 'starleague-upset';
  if (/역전|뒤집|따라잡|comeback/.test(line)) return 'starleague-comeback';
  if (/러시|올인|벙커|초반 압박|타이밍 공격/.test(line)) return 'starleague-build-rush';
  if (/견제|드랍|흔들|다크|뮤탈|벌처/.test(line)) return 'starleague-build-harass';
  if (/테크|전환|캐리어|아비터|하이브|디파일러|메카닉/.test(line)) return 'starleague-build-tech';
  if (/운영|확장|더블|트리플|멀티|자원/.test(line)) return 'starleague-build-macro';
  if (/교전|전투|싸움|공격|전면전|결정타/.test(line)) return 'starleague-clash';
  if (/해설|데이터|분석/.test(role)) return 'starleague-analysis';
  if (/캐스터/.test(role)) return 'starleague-caster';
  return 'starleague-broadcast';
}


export function starleagueBroadcastLineCue(caster, text) {
  const action = starleagueBroadcastLineAction(caster, text);
  return BROADCAST_LINE_CUES[action] || 'starleagueBroadcastOpening';
}
