import { applyCompanySupportAction, selectProjectSeedAction } from '../_lib/siCodingSimEngine';
import { GameControlButton } from '../../_components/GamePlayPrimitives';
import { SiCodingIconRow, SiCodingPanelTitle } from './SiCodingVisuals';

export default function SiCodingCareerTab({
  profileSummary,
  seedRoadmap,
  setState,
  support,
  task,
}) {
  return (
    <section className="games-detail-grid">
                        <section className="games-panel">
                          <SiCodingPanelTitle action="growth" title="플레이어 성장" meta={profileSummary.career.reputationLabel} />
                          <div className="game-save-list">
                            {profileSummary.statRows.map((item) => (
                              <SiCodingIconRow action="growth" key={`tab-stat-${item.key}`}>
                                <div>
                                  <span>{item.summary}</span>
                                  <strong>{item.label}</strong>
                                </div>
                                <strong>Lv.{item.level}</strong>
                              </SiCodingIconRow>
                            ))}
                          </div>
                        </section>
        
                        <section className="games-panel">
                          <SiCodingPanelTitle action="support" title="회사 지원" meta={`예비비 ${support.cashReserve}pt`} />
                          <div className="game-save-list">
                            {(support.actions || []).map((item) => (
                              <SiCodingIconRow action={item.key === 'hint' ? 'support-hint' : 'support-risk'} key={`tab-support-${item.key}`}>
                                <div>
                                  <span>{item.detail}</span>
                                  <strong>{item.title}</strong>
                                </div>
                                <GameControlButton
                                  action="sponsor"
                                  className="tcg-primary-action"
                                  disabled={item.disabled}
                                  onClick={() => setState((current) => applyCompanySupportAction(current, task.id, item.key))}
                                >
                                  {item.key === 'hint' ? '지식 지원' : 'QA 지원'} · {item.cost}pt
                                </GameControlButton>
                              </SiCodingIconRow>
                            ))}
                          </div>
                        </section>
        
                        <section className="games-panel">
                          <SiCodingPanelTitle action="project-select" title="후속 현장" meta={`${seedRoadmap.generatedSeeds.length}종`} />
                          {seedRoadmap.followUpPlan ? (
                            <div className="game-save-list">
                              {seedRoadmap.generatedSeeds.slice(0, 4).map((seed) => (
                                <SiCodingIconRow action={seed.id === seedRoadmap.selectedSeed?.id ? 'project-select' : 'project'} key={`tab-seed-${seed.id}`} style={seed.id === seedRoadmap.selectedSeed?.id ? { borderColor: '#2673a6' } : null}>
                                  <div>
                                    <span>{seed.recommendation} · 적합도 {seed.fitScore}점</span>
                                    <strong>{seed.projectName}</strong>
                                    <span>{seed.client} · {seed.module}</span>
                                  </div>
                                  <GameControlButton action="target" className="tcg-primary-action" onClick={() => setState((current) => selectProjectSeedAction(current, seed.id))}>
                                    {seed.id === seedRoadmap.selectedSeed?.id ? '선택됨' : `선택 · ${seed.rewardScore}pt`}
                                  </GameControlButton>
                                </SiCodingIconRow>
                              ))}
                            </div>
                          ) : <div className="games-empty">프로젝트 종료 판정 후 차기 현장 후보가 생성됩니다.</div>}
                        </section>
                      </section>
  );
}
