import { SmallStat } from '../../_components/GamePlayPrimitives';
import { BaSrpgIconRow, BaSrpgPanelTitle } from './BaSrpgVisuals';

export default function BaSrpgCampaignExpansionTab(props) {
  const {
    campaignExpansion,
  } = props;

  return (
    <>
              <>

      <section className="games-detail-grid">
        <section className="games-panel">
          <BaSrpgPanelTitle action="analysis" title="확장 리포트" meta={campaignExpansion.headline} />
          <div className="games-rank-split">
            <SmallStat label="준비도" value={`${campaignExpansion.readinessPct}%`} />
            <SmallStat label="챕터" value={`${campaignExpansion.chapterRows.length}개`} />
            <SmallStat label="적 패턴" value={`${campaignExpansion.enemyPatterns.length}종`} />
            <SmallStat label="점검" value={`${campaignExpansion.balanceRows.filter((row) => row.tone === 'warn').length}건`} />
          </div>
          <div className="game-save-list" style={{ marginTop: 12 }}>
            {campaignExpansion.recommendations.map((line, index) => (
              <BaSrpgIconRow action="advisor" label={`${index + 1}순위`} key={`${line}-${index}`}>
                <div>
                  <span>{index + 1}순위</span>
                  <strong>{line}</strong>
                </div>
              </BaSrpgIconRow>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <BaSrpgPanelTitle action="map" title="챕터 현황" meta="CH.3 포함" />
          <div className="game-save-list">
            {campaignExpansion.chapterRows.map((row) => (
              <BaSrpgIconRow action={row.cleared === row.missions.length ? 'complete' : 'map'} label={`CH.${row.chapter}`} key={row.chapter}>
                <div>
                  <span>CH.{row.chapter} · {row.status} · {row.difficultyText}</span>
                  <strong>{row.cleared}/{row.missions.length} 클리어 · ★{row.stars}/{row.starMax}</strong>
                  <small>다음: {row.nextMissionName} · 최고 권장 {row.recommendedPowerMax} · 전투력 차이 {row.powerGap}</small>
                </div>
                <strong>{row.progressPct}%</strong>
              </BaSrpgIconRow>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <BaSrpgPanelTitle action="srpg-enemy-command" title="적 패턴" meta={`${campaignExpansion.enemyPatterns.length}종`} />
          <div className="game-save-list">
            {campaignExpansion.enemyPatterns.map((pattern) => (
              <BaSrpgIconRow action="srpg-enemy-assault" label={pattern.label} key={pattern.label}>
                <div>
                  <span>{pattern.chapterText} · {pattern.count}개체</span>
                  <strong>{pattern.label}</strong>
                  <small>{pattern.examplesText}</small>
                  <small>최대 사거리 {pattern.maxRange} · 이동 {pattern.maxMove} · 방어 {pattern.maxDef}</small>
                </div>
                <strong>{pattern.count}</strong>
              </BaSrpgIconRow>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <BaSrpgPanelTitle
            action="analysis"
            title="밸런스 점검"
            meta={campaignExpansion.balanceRows.filter((row) => row.tone === 'warn').length ? '점검 필요' : '안정'}
          />
          <div className="game-save-list">
            {campaignExpansion.balanceRows.map((row) => (
              <BaSrpgIconRow action={row.tone === 'warn' ? 'warning' : row.tone === 'good' ? 'complete' : 'analysis'} label={row.label} key={row.id}>
                <div>
                  <span>{row.tone === 'warn' ? '경고' : row.tone === 'good' ? '양호' : '관찰'}</span>
                  <strong>{row.label} · {row.value}</strong>
                  <small>{row.detail}</small>
                </div>
                <strong>{row.tone === 'warn' ? '점검' : 'OK'}</strong>
              </BaSrpgIconRow>
            ))}
          </div>
        </section>
      </section>
              </>
    </>
  );
}
