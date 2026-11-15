export function primitiveArchiveSuccessionGuidance({ state, lineage } = {}) {
  const needsPreparation = [], blockedHandover = [];
  if (state?.ended || !lineage?.enabled || lineage.mode === 'legacy') {
    return { needsPreparation, blockedHandover };
  }
  for (const member of lineage.rows || []) {
    const active = ['active', 'elder'].includes(member.stage)
      && state?.party?.some(actor => actor.id === member.actorId && Number(actor.hp) > 0);
    const warning = state?.calendar?.mode === 'annual' ? member.annual?.warning : member.warning;
    if (!active || !warning) continue;
    if (!member.successorId) needsPreparation.push(member);
    else if (lineage.communityReady === false && lineage.prepared?.some(candidate =>
      candidate.mentorId === member.actorId && candidate.actor?.id === member.successorId)) {
      blockedHandover.push(member);
    }
  }
  return { needsPreparation, blockedHandover };
}
