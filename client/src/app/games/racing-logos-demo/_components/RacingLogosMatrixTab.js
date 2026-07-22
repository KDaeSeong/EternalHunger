import { RacingLogosInfoRow, RacingLogosPanelTitle } from './RacingLogosVisuals';

export default function RacingLogosMatrixTab(props) {
  const {
    packMatrix,
  } = props;

  return (
              <section className="games-panel">
                <RacingLogosPanelTitle action="tactics" title="로컬팩 매트릭스" meta={`${packMatrix.totals.completed}/${packMatrix.totals.rows}`} />
                <div className="game-save-list">
                  {packMatrix.rows.map((row) => (
                    <RacingLogosInfoRow
                      action={row.complete ? 'complete' : 'draft'}
                      className={row.complete ? 'is-good' : 'is-warning'}
                      label={row.name}
                      key={row.id}
                    >
                      <div>
                        <span>{row.kindLabel} / {row.requiredKey}</span>
                        <strong>{row.name}</strong>
                        <small>{row.logoKeyPath} · logoKey: {row.logoKey}</small>
                        <small>{row.candidateText}</small>
                      </div>
                      <span className="game-save-chip">{row.status}</span>
                    </RacingLogosInfoRow>
                  ))}
                </div>
              </section>
  );
}
