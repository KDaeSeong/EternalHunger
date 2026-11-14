const CATALOG_VERSION = 'site-achievements-v2';
const SECTIONS = Object.freeze([
  { id: 'simulation', label: '헝거게임·이터널 헝거' },
  { id: 'archive', label: '문명 아카이브' },
  { id: 'games', label: '여러 게임 도전' },
  { id: 'twenty', label: '스무고개' },
  { id: 'records', label: '캐릭터와 기록' },
  { id: 'economy', label: '특전과 수집' },
  { id: 'community', label: '커뮤니티' },
].map(Object.freeze));
const labels = Object.fromEntries(SECTIONS.map((row) => [row.id, row.label]));

const GAME_MILESTONES = Object.freeze([
  ['kivotos-autochess', '키보토스 오토체스', '첫 지휘 기록'],
  ['infinite-defense', '무한 디펜스', '방어선의 첫 기록'],
  ['dual-academy-tcg', '듀얼 아카데미 TCG', '듀얼리스트의 첫 기록'],
  ['ba-vanguard', '블루 아카이브 덱 빌더', '첫 덱의 여정'],
  ['tonkatsu-teacher', '돈까스 사장 선생님', '사장님의 첫 일지'],
  ['schale-idle-rpg', '샬레 방치형 RPG', '샬레의 첫 보고'],
  ['ba-srpg', '블루 아카이브 전술 RPG', '첫 전술 기록'],
  ['myanimecraft', '스타리그', '첫 리그 기록'],
  ['school-simulator', '학교 운영 시뮬레이터', '첫 학교 운영 일지'],
  ['si-coding-sim', 'SI 코딩 시뮬레이터', '첫 개발 일지'],
  ['rail3d-sim', '철도 시뮬레이터', '첫 노선 기록'],
  ['company-report', '회사 리포트 시뮬레이터', '첫 회사 보고서'],
  ['racing-logos-demo', '경마 시뮬레이터', '첫 경주 기록'],
].map(([slug, title, achievementTitle]) => Object.freeze({ slug, title, achievementTitle,
  href: slug === 'ba-srpg' ? '/srpg/ba-srpg/play' : `/myanime/${slug}/play` })));

function toNonNegativeInt(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.min(Number.MAX_SAFE_INTEGER, Math.floor(number)) : 0;
}

function define(id, section, title, description, metric, target, points, href) {
  return Object.freeze({ id, section, sectionLabel: labels[section], title, description, metric, target, points, href,
    reward: Object.freeze({ lp: points * 5, credits: points * 10 }) });
}

// Existing achievement identities and points are retained for migration.
const ACHIEVEMENTS = Object.freeze([
  define('first_sim', 'simulation', '첫 경기', '헝거게임 또는 이터널 헝거를 1회 완료합니다.', 'totalGames', 1, 10, '/eternalhunger'),
  define('ten_games', 'simulation', '적응 완료', '시뮬레이션 누적 10전을 달성합니다.', 'totalGames', 10, 30, '/records'),
  define('first_win', 'simulation', '첫 승리', '시뮬레이션에서 1승을 기록합니다.', 'totalWins', 1, 20, '/records'),
  define('hunter', 'simulation', '킬 로그가 말해준다', '시뮬레이션 누적 10킬을 달성합니다.', 'totalKills', 10, 25, '/records'),
  define('roster_builder', 'records', '로스터 빌더', '캐릭터 5명을 등록합니다.', 'characters', 5, 20, '/characters'),
  define('team_archivist', 'records', '팀 기록 수집가', '팀 전적 3개를 기록합니다.', 'teams', 3, 20, '/records'),
  define('replay_keeper', 'records', '리플레이 보관', '저장 경기 기록 5개를 남깁니다.', 'runs', 5, 25, '/records'),
  define('poster', 'community', '첫 게시글', '게시판에 글을 1개 작성합니다.', 'posts', 1, 10, '/board'),
  define('commentator', 'community', '토론 참여자', '댓글 5개를 작성합니다.', 'comments', 5, 15, '/board'),
  define('twenty_host', 'twenty', '방장 데뷔', '스무고개 방을 1개 만듭니다.', 'hostedRooms', 1, 10, '/twenty-questions?create=1'),
  define('twenty_solver', 'twenty', '정답 사냥꾼', '스무고개 정답을 1회 맞힙니다.', 'solvedRooms', 1, 20, '/twenty-questions'),
  define('wallet', 'economy', '자금 확보', '크레딧 1,000을 보유합니다.', 'credits', 1000, 20, '/perks'),
  define('lp_climber', 'economy', 'LP 상승세', 'LP 1,000을 달성합니다.', 'lp', 1000, 25, '/leaderboard'),
  define('badge_collector', 'economy', '배지 수집가', '배지 3개를 획득합니다.', 'badges', 3, 25, '/account'),
  define('fifty_games', 'simulation', '익숙한 전장', '시뮬레이션 누적 50전을 달성합니다.', 'totalGames', 50, 50, '/records'),
  define('hundred_games', 'simulation', '백 번의 이야기', '시뮬레이션 누적 100전을 달성합니다.', 'totalGames', 100, 100, '/records'),
  define('ten_wins', 'simulation', '승리의 감각', '시뮬레이션 누적 10승을 달성합니다.', 'totalWins', 10, 60, '/records'),
  define('hundred_kills', 'simulation', '전장의 기록자', '시뮬레이션 누적 100킬을 달성합니다.', 'totalKills', 100, 75, '/records'),
  define('large_roster', 'records', '우리만의 출연진', '캐릭터 20명을 등록합니다.', 'characters', 20, 40, '/characters'),
  define('replay_archive', 'records', '이야기 보관소', '저장 경기 기록 25개를 남깁니다.', 'runs', 25, 50, '/records'),
  define('first_game_record', 'games', '새로운 게임의 첫 장', '마이애니메 플레이 기록을 1개 남깁니다.', 'gameRecords', 1, 15, '/games'),
  define('ten_game_records', 'games', '쌓여 가는 플레이 일지', '마이애니메 플레이 기록 10개를 남깁니다.', 'gameRecords', 10, 40, '/games/records'),
  define('three_games', 'games', '세 가지 세계', '서로 다른 마이애니메 게임 3종의 기록을 남깁니다.', 'gameVariety', 3, 40, '/games'),
  define('six_games', 'games', '장르를 넘어서', '서로 다른 마이애니메 게임 6종의 기록을 남깁니다.', 'gameVariety', 6, 80, '/games'),
  define('first_game_clear', 'games', '첫 결실', '마이애니메에서 승리 또는 클리어 기록을 1회 남깁니다.', 'gameClears', 1, 30, '/games/records'),
  define('ten_game_clears', 'games', '꾸준한 완수', '마이애니메에서 승리 또는 클리어 기록을 10회 남깁니다.', 'gameClears', 10, 80, '/games/records'),
  define('archive_basic', 'archive', '문명의 첫 아카이브', '개발자 보정 없이 기초 완주한 런을 기록합니다.', 'archiveRuns', 1, 60, '/games/primitive-archive/play'),
  define('archive_full', 'archive', '모든 시대의 기록', '개발자 보정 없이 발전 전체를 완료하고 런을 기록합니다.', 'archiveFullRuns', 1, 100, '/games/primitive-archive/play'),
  define('archive_three', 'archive', '문명은 다시 이어진다', '개발자 보정 없는 완주 런 3개를 기록합니다.', 'archiveRuns', 3, 90, '/games/primitive-archive/play'),
  define('twenty_five_solved', 'twenty', '질문을 꿰뚫다', '스무고개 정답을 누적 5회 맞힙니다.', 'solvedRooms', 5, 40, '/twenty-questions'),
  define('twenty_twenty_solved', 'twenty', '스무 번의 정답', '스무고개 정답을 누적 20회 맞힙니다.', 'solvedRooms', 20, 80, '/twenty-questions'),
  define('twenty_five_hosted', 'twenty', '다시 모이는 방', '스무고개 방을 누적 5개 만듭니다.', 'hostedRooms', 5, 30, '/twenty-questions?create=1'),
  define('first_perk', 'economy', '나만의 첫 특전', '특전 1종을 보유합니다.', 'perks', 1, 20, '/perks'),
  define('five_perks', 'economy', '선택의 폭', '서로 다른 특전 5종을 보유합니다.', 'perks', 5, 50, '/perks'),
  ...GAME_MILESTONES.map((game) => define(`game_${game.slug}`, 'games', game.achievementTitle,
    `${game.title} 플레이 기록을 1개 남깁니다.`, `game:${game.slug}`, 1, 15, game.href)),
]);

function dateString(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function buildAchievementRows(totals = {}, records = []) {
  const unlocked = new Map(records.map((record) => [record.achievementId, record]));
  return ACHIEVEMENTS.map((definition) => {
    const record = unlocked.get(definition.id);
    const currentValue = toNonNegativeInt(totals[definition.metric]);
    const completed = Boolean(record);
    const value = completed ? Math.max(definition.target, currentValue, toNonNegativeInt(record.unlockValue)) : currentValue;
    const claimed = Boolean(record?.claimedAt);
    const reward = record ? { lp: toNonNegativeInt(record.rewardLp), credits: toNonNegativeInt(record.rewardCredits) } : definition.reward;
    return { ...definition, value, currentValue, progress: completed ? 1 : Math.min(1, value / definition.target), completed,
      points: record ? toNonNegativeInt(record.points) : definition.points, reward, claimed,
      claimable: completed && !claimed && (reward.lp > 0 || reward.credits > 0),
      unlockedAt: dateString(record?.unlockedAt), claimedAt: dateString(record?.claimedAt),
      awarded: { lp: toNonNegativeInt(record?.awardedLp), credits: toNonNegativeInt(record?.awardedCredits) } };
  });
}

function publicAchievementCatalog() {
  return { catalogVersion: CATALOG_VERSION, count: ACHIEVEMENTS.length, sections: SECTIONS,
    achievements: ACHIEVEMENTS.map(({ metric, ...definition }) => definition) };
}

module.exports = { CATALOG_VERSION, SECTIONS, GAME_MILESTONES, ACHIEVEMENTS, toNonNegativeInt, buildAchievementRows, publicAchievementCatalog };
