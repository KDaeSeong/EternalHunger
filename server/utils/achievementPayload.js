const { ACHIEVEMENTS, CATALOG_VERSION, SECTIONS, buildAchievementRows, toNonNegativeInt } = require('../../shared/achievementCatalog.cjs');

function buildAchievementPayload({ user, totals, records, claim }) {
  const achievements = buildAchievementRows(totals, records);
  const completed = achievements.filter((row) => row.completed);
  const score = completed.reduce((sum, row) => sum + row.points, 0);
  const maxScore = achievements.reduce((sum, row) => sum + row.points, 0);
  const unclaimedRewards = achievements.filter((row) => row.claimable).reduce((sum, row) => ({
    count: sum.count + 1, lp: sum.lp + row.reward.lp, credits: sum.credits + row.reward.credits,
  }), { count: 0, lp: 0, credits: 0 });
  const sections = SECTIONS.map((section) => {
    const rows = achievements.filter((row) => row.section === section.id);
    return { section: section.id, label: section.label, totalCount: rows.length,
      completedCount: rows.filter((row) => row.completed).length,
      score: rows.filter((row) => row.completed).reduce((sum, row) => sum + row.points, 0),
      maxScore: rows.reduce((sum, row) => sum + row.points, 0) };
  });
  const has = (id) => achievements.some((row) => row.id === id && row.completed);
  const steps = [
    { id: 'profile', title: '표시 이름 정하기', description: '다른 플레이어에게 보일 닉네임을 설정합니다.',
      completed: Boolean(String(user?.nickname || '').trim()), href: '/account', cta: '계정 설정' },
    { id: 'first_character', title: '나만의 캐릭터', description: '헝거게임에 사용할 캐릭터를 등록합니다.',
      completed: totals.characters >= 1 || has('roster_builder'), href: '/characters', cta: '캐릭터 설정' },
    { id: 'first_match', title: '게임의 첫 기록', description: '마음에 드는 게임을 플레이하고 기록을 남깁니다.',
      completed: totals.sitePlays >= 1 || has('first_sim') || has('first_game_record'), href: '/games', cta: '게임 고르기' },
    { id: 'first_record', title: '기록소 확인', description: '내 플레이 기록과 전적을 살펴봅니다.',
      completed: totals.runs >= 1 || totals.sitePlays >= 1 || has('replay_keeper'), href: '/games/records', cta: '기록소' },
    { id: 'community', title: '경험 나누기', description: '플레이 후기나 공략을 게시판에 남깁니다.',
      completed: totals.posts + totals.comments >= 1 || has('poster') || has('commentator'), href: '/board', cta: '게시판' },
    { id: 'twenty_questions', title: '함께 하는 스무고개', description: '문제를 만들거나 정답에 도전합니다.',
      completed: totals.hostedRooms + totals.solvedRooms >= 1 || has('twenty_host') || has('twenty_solver'), href: '/twenty-questions', cta: '방 목록' },
    { id: 'first_perk', title: '특전 고르기', description: '모은 LP로 원하는 특전을 선택합니다.',
      completed: totals.perks >= 1 || has('first_perk'), href: '/perks', cta: '특전 상점' },
  ];
  const nickname = String(user?.nickname || '').trim();
  const username = String(user?.username || '').trim();
  return {
    catalogVersion: CATALOG_VERSION,
    user: user ? { _id: String(user._id), displayName: nickname || username || '플레이어', nickname, username,
      lp: toNonNegativeInt(user.lp), credits: toNonNegativeInt(user.credits) } : null,
    userProgress: user ? { lp: toNonNegativeInt(user.lp), credits: toNonNegativeInt(user.credits) } : null,
    season: { id: CATALOG_VERSION, name: '평생 업적', title: '사이트 성장 기록',
      summary: '여러 게임의 기록과 활동을 모읍니다. 한 번 달성한 업적은 계속 유지됩니다.',
      score, maxScore, completedCount: completed.length, totalCount: ACHIEVEMENTS.length },
    totals, achievements, sections, unclaimedRewards,
    onboarding: { completedCount: steps.filter((row) => row.completed).length, totalCount: steps.length,
      steps, next: steps.filter((row) => !row.completed).slice(0, 3) },
    next: achievements.filter((row) => !row.completed)
      .sort((a, b) => b.progress - a.progress || a.target - b.target || a.points - b.points).slice(0, 3),
    ...(claim ? { claim } : {}),
  };
}

module.exports = { buildAchievementPayload };
