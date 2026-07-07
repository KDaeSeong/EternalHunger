export function createBaVanguardPlaytestSummary({
  autoGuardMe,
  concurrencyAudit,
  deck,
  duelSummary,
  opponentDeck,
  opponentPresetId,
  portingCoverage,
  presetId,
  replayExport,
  replayReport,
  rules,
  score,
  tacticalReport,
}) {
  return {
    presetId,
    opponentPresetId,
    deckName: deck.name,
    opponentDeckName: opponentDeck.name,
    clan: deck.clan,
    rules,
    autoGuardMe,
    score,
    duel: duelSummary,
    tacticalReport: {
      riskLabel: tacticalReport.riskLabel,
      recommendedAction: tacticalReport.recommendedAction,
      readinessPct: tacticalReport.readinessPct,
      damageDelta: tacticalReport.damageDelta,
    },
    replayReport: {
      headline: replayReport.headline,
      damageSwing: replayReport.damageSwing,
      logCount: replayReport.logCount,
      turnCount: replayReport.turnCount,
      guardAudit: replayReport.guardAudit
        ? {
          guardNeeded: replayReport.guardAudit.guardNeeded,
          canGuard: replayReport.guardAudit.canGuard,
        }
        : null,
    },
    replayExport: {
      fileName: replayExport.fileName,
      sizeLabel: replayExport.sizeLabel,
      statusLabel: replayExport.statusLabel,
      ready: replayExport.ready,
      auditRows: replayExport.auditRows.map((row) => ({
        id: row.id,
        label: row.label,
        status: row.status,
      })),
    },
    portingAudit: {
      cardCoveragePct: portingCoverage.completionPct,
      roomSyncPct: concurrencyAudit.completionPct,
      ready: portingCoverage.ready && concurrencyAudit.ready,
      coverageHeadline: portingCoverage.headline,
      roomHeadline: concurrencyAudit.headline,
    },
  };
}
