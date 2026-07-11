function recordSignature(record) {
  return Object.entries(record || {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${value}`)
    .join('|');
}

function packSignature(pack) {
  return [
    recordSignature(pack?.trackNames),
    recordSignature(pack?.eventNames),
    recordSignature(pack?.trackLogoKeyOverrides),
  ].join('::');
}

function packEntryCount(pack) {
  return Object.keys(pack?.trackNames || {}).length
    + Object.keys(pack?.eventNames || {}).length
    + Object.keys(pack?.trackLogoKeyOverrides || {}).length;
}

export function racingLogosFeedbackSnapshot(state) {
  const latestAudit = state?.auditHistory?.[0] || null;
  const latestCard = state?.raceCards?.[0] || null;
  return {
    runId: String(state?.runId || ''),
    auditCount: state?.auditHistory?.length || 0,
    auditCompleteness: Number(latestAudit?.completeness || 0),
    placeholderOnly: Number(latestAudit?.placeholderOnly || 0),
    cardCount: state?.raceCards?.length || 0,
    latestCardId: String(latestCard?.id || ''),
    latestCardSeason: Boolean(latestCard?.season),
    packSignature: packSignature(state?.localPack),
    packEntryCount: packEntryCount(state?.localPack),
  };
}

export function racingLogosFeedbackCue(previous, current) {
  if (!previous || previous.runId !== current.runId) return '';
  if (current.auditCount > previous.auditCount) {
    return current.auditCompleteness >= 100 && current.placeholderOnly === 0
      ? 'logoAuditPerfect'
      : 'logoAudit';
  }
  if (current.cardCount > previous.cardCount && current.latestCardId !== previous.latestCardId) {
    return current.latestCardSeason ? 'seasonCard' : 'raceCard';
  }
  if (current.packSignature !== previous.packSignature) {
    return current.packEntryCount ? 'packApply' : 'packClear';
  }
  return '';
}
