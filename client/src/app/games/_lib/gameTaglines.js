// One-line descriptions for players (home and game hub cards).
// The catalog `summary` fields describe porting scope for development; these say what the game is.
export const GAME_TAGLINES = Object.freeze({
  'eternal-hunger': '캐릭터를 꾸려 장비와 전술 스킬로 금지구역 속에서 끝까지 살아남는 배틀 시뮬레이션입니다.',
  'hunger-games': '좋아하는 캐릭터를 넣고 낮과 밤의 사건, 동맹과 배신 속에서 최후의 생존자를 지켜봅니다.',
  'twenty-questions': '방장이 낸 정답을 질문 스무 번 안에 맞히는 커뮤니티 게임입니다.',
  'dual-academy-tcg': '덱을 짜서 소환과 세트, 체인으로 겨루는 카드 배틀입니다.',
  'ba-vanguard': '라이드와 콜로 덱을 굴리는 덱빌딩 카드 배틀입니다.',
  'primitive-archive': '부족 생존에서 근대 문명까지 학생 파티를 이끄는 문명 시뮬레이션입니다.',
  'tonkatsu-teacher': '재료를 사고 메뉴를 만들어 돈까스 가게를 키우는 경영 게임입니다.',
  'schale-idle-rpg': '자리를 비워도 성장하는 방치형 RPG입니다.',
  'ba-srpg': '격자 위에서 엄폐와 사거리를 따져 싸우는 전술 SRPG입니다.',
  myanimecraft: '팀 리그와 포스트시즌을 한 시즌씩 운영하는 리그 시뮬레이터입니다.',
  'school-simulator': '학생과 교사, 시설을 관리하며 한 학기를 꾸리는 학교 경영 게임입니다.',
  'si-coding-sim': '과제를 받아 코드를 고치고 보고서를 내는 SI 개발자 시뮬레이션입니다.',
  'rail3d-sim': '노선과 시간표를 짜고 열차 지연을 잡는 철도 운행 시뮬레이션입니다.',
  'company-report': '주문부터 월말 결산, 공시까지 회사 장부를 굴리는 경영 시뮬레이션입니다.',
  'racing-logos-demo': '출전마의 작전과 체력을 관리해 결승선까지 이끄는 경주 시뮬레이션입니다.',
});

export function gameTagline(game) {
  const slug = String(game?.slug || game || '').trim();
  return GAME_TAGLINES[slug] || String(game?.subtitle || '');
}

// Names as the site menu says them (the catalog keeps the original English title for 이터널 헝거).
const GAME_DISPLAY_TITLES = Object.freeze({
  'eternal-hunger': '이터널 헝거',
});

export function gameDisplayTitle(game) {
  const slug = String(game?.slug || '').trim();
  return GAME_DISPLAY_TITLES[slug] || String(game?.title || slug);
}
