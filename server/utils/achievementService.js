const { ACHIEVEMENTS, CATALOG_VERSION, toNonNegativeInt } = require('../../shared/achievementCatalog.cjs');

const recordKey = (userId, achievementId) => `${String(userId)}:${achievementId}`;

function achievementError(code, status = 500) {
  return Object.assign(new Error(code), { code, status });
}

async function lean(query, session) {
  if (session && typeof query.session === 'function') query = query.session(session);
  return typeof query.lean === 'function' ? query.lean() : query;
}

function createAchievementService({ User, AchievementRecord, loadTotals, now = () => new Date() }) {
  async function recordsFor(userId, session) {
    return lean(AchievementRecord.find({ userId }), session);
  }

  async function unlockEligible(userId, totals, records, at, session) {
    const existing = new Set(records.map((row) => row.achievementId));
    for (const achievement of ACHIEVEMENTS) {
      const value = toNonNegativeInt(totals[achievement.metric]);
      if (existing.has(achievement.id) || value < achievement.target) continue;
      await AchievementRecord.updateOne(
        { _id: recordKey(userId, achievement.id) },
        { $setOnInsert: {
          userId, achievementId: achievement.id, catalogVersion: CATALOG_VERSION,
          unlockedAt: at, unlockValue: value, points: achievement.points,
          rewardLp: achievement.reward.lp, rewardCredits: achievement.reward.credits,
          claimedAt: null, awardedLp: 0, awardedCredits: 0,
        } },
        { upsert: true, session },
      );
    }
    return recordsFor(userId, session);
  }

  async function snapshot(userId, { session, at = now() } = {}) {
    const { user, totals } = await loadTotals(userId, session);
    if (!user) throw achievementError('ACHIEVEMENT_USER_NOT_FOUND', 404);
    const records = await unlockEligible(userId, totals, await recordsFor(userId, session), at, session);
    return { user, totals, records };
  }

  async function claim(userId, request) {
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
      throw achievementError('ACHIEVEMENT_INVALID_SELECTION', 400);
    }
    const known = new Set(ACHIEVEMENTS.map((row) => row.id));
    const all = request.all === true;
    const ids = request.achievementIds;
    if (!all && (!Array.isArray(ids) || ids.length === 0 || ids.length > ACHIEVEMENTS.length
      || ids.some((id) => typeof id !== 'string' || !known.has(id)))) {
      throw achievementError('ACHIEVEMENT_INVALID_SELECTION', 400);
    }
    const selected = all ? known : new Set(ids);
    const at = now();
    // The ledger and account balance commit together. There is deliberately no
    // non-transactional fallback when the database cannot provide transactions.
    return User.db.transaction(async (session) => {
      const locked = await User.updateOne(
        { _id: userId }, { $inc: { achievementMutationVersion: 1 } }, { session },
      );
      if (locked.matchedCount !== 1) throw achievementError('ACHIEVEMENT_USER_NOT_FOUND', 404);
      const before = await snapshot(userId, { session, at });
      const relevant = before.records.filter((row) => selected.has(row.achievementId));
      if (!all && relevant.length !== selected.size) {
        throw achievementError('ACHIEVEMENT_NOT_UNLOCKED', 409);
      }
      const pending = relevant.filter((row) => !row.claimedAt);
      const reward = pending.reduce((sum, row) => ({
        lp: sum.lp + toNonNegativeInt(row.rewardLp),
        credits: sum.credits + toNonNegativeInt(row.rewardCredits),
      }), { lp: 0, credits: 0 });
      const previous = relevant.filter((row) => row.claimedAt).reduce((sum, row) => ({
        lp: sum.lp + toNonNegativeInt(row.awardedLp),
        credits: sum.credits + toNonNegativeInt(row.awardedCredits),
      }), { lp: 0, credits: 0 });
      for (const row of pending) {
        const updated = await AchievementRecord.updateOne(
          { _id: row._id, userId, claimedAt: null },
          { $set: { claimedAt: at, awardedLp: toNonNegativeInt(row.rewardLp), awardedCredits: toNonNegativeInt(row.rewardCredits) } },
          { session },
        );
        if (updated.matchedCount !== 1) throw achievementError('ACHIEVEMENT_CLAIM_CONFLICT', 409);
      }
      if (pending.length > 0) {
        const updated = await User.updateOne(
          { _id: userId }, { $inc: { lp: reward.lp, credits: reward.credits } }, { session },
        );
        if (updated.matchedCount !== 1) throw achievementError('ACHIEVEMENT_USER_NOT_FOUND', 404);
      }
      const user = await lean(User.findById(userId).select('username nickname lp credits badges perks statistics'), session);
      if (!user) throw achievementError('ACHIEVEMENT_USER_NOT_FOUND', 404);
      const totals = { ...before.totals, lp: toNonNegativeInt(user.lp), credits: toNonNegativeInt(user.credits) };
      const records = await unlockEligible(userId, totals, await recordsFor(userId, session), at, session);
      return {
        user, totals, records,
        claim: { count: pending.length, lp: reward.lp, credits: reward.credits,
          alreadyClaimedCount: relevant.length - pending.length, previouslyAwarded: previous,
          achievementIds: pending.map((row) => row.achievementId) },
      };
    });
  }

  return { snapshot, claim };
}

module.exports = { createAchievementService, achievementError, recordKey };
