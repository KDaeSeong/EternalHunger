import { ActionButton, SmallStat } from '../../_components/GamePlayPrimitives';
import {
  MAX_FORMATION_SIZE,
  applyFormationPresetAction,
  attackSelectedAction,
  autoPlayerTurnAction,
  consumeBandageAction,
  endTurnAction,
  executeSkillAction,
  moveSelectedAction,
  restAction,
  startMissionAction,
  setFormationAction,
  waitSelectedUnitAction,
} from '../_lib/baSrpgEngine';

export default function BaSrpgMissionTab(props) {
  const {
    battle,
    campaignReport,
    formation,
    formationCount,
    formationPresets,
    mission,
    missionId,
    operationBriefing,
    runAutoBattle,
    selectedCanAct,
    selectedMission,
    selectedMissionBrief,
    selectedMissionProgress,
    selectedMissionRewards,
    selectedSkill,
    selectedUnit,
    setMissionId,
    setSkillId,
    setState,
    skillId,
    skills,
    state,
    targetEnemy,
  } = props;
  const activeSkillId = selectedSkill?.id || skillId;

  return (
    <>
              <>
      <section className="games-detail-grid">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>작전 선택</h2>
            <span>{mission.region}</span>
          </div>
          <label className="game-save-json-field">
            <span>임무</span>
            <select value={missionId} onChange={(event) => setMissionId(event.target.value)}>
              {campaignReport.missionRows.map((item) => (
                <option value={item.id} key={item.id}>
                  [{item.difficultyLabel}] {item.name}{item.locked ? ' (잠김)' : ''}
                </option>
              ))}
            </select>
          </label>
          <p style={{ color: '#64717d', fontWeight: 800, lineHeight: 1.55 }}>{selectedMission.objective}</p>
          <div className="games-rank-split">
            <SmallStat label="난이도" value={selectedMissionProgress?.difficultyLabel || selectedMission.difficulty} />
            <SmallStat label="권장 전투력" value={selectedMission.recommendedPower} />
            <SmallStat label="상태" value={selectedMissionProgress?.locked ? '잠김' : selectedMissionProgress?.powerGap >= 0 ? '출정 가능' : '전력 부족'} />
            <SmallStat label="예상 승산" value={`${selectedMissionBrief?.successPct ?? 0}%`} />
            <SmallStat label="크레딧" value={`${selectedMission.creditMin}-${selectedMission.creditMax}`} />
          </div>
          {selectedMissionProgress?.locked ? (
            <p style={{ color: '#9f5f00', fontWeight: 900, lineHeight: 1.55 }}>
              잠금 사유: {selectedMissionProgress.lockReason}
            </p>
          ) : null}
          <p style={{ color: '#64717d', fontWeight: 800, lineHeight: 1.55 }}>{selectedMissionRewards}</p>
          <p style={{ color: '#64717d', fontWeight: 800, lineHeight: 1.55 }}>{selectedMission.caution}</p>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton action="deploy" cue="off" disabled={!formationCount || selectedMissionProgress?.locked} onClick={() => setState((current) => startMissionAction(current, missionId))}>선택 임무 시작</ActionButton>
            <ActionButton action="rest" cue="off" onClick={() => setState((current) => restAction(current))}>여관 휴식</ActionButton>
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>작전 브리핑</h2>
            <span>{operationBriefing.headline}</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="준비도" value={`${operationBriefing.readinessPct}%`} />
            <SmallStat label="전투력" value={operationBriefing.power.toLocaleString('ko-KR')} />
            <SmallStat label="붕대" value={`${operationBriefing.bandages}개`} />
            <SmallStat label="무기" value={operationBriefing.weaponEquipped ? '장착' : '미장착'} />
            <SmallStat label="보고 가능" value={`${operationBriefing.readyQuests}건`} />
          </div>
          <div className="games-empty" style={{ textAlign: 'left', marginBottom: 12 }}>
            <strong>다음 액션</strong> · {operationBriefing.nextAction}
          </div>
          <div className="game-save-list">
            {operationBriefing.missionRows.slice(0, 4).map((row) => (
              <article className="game-save-row" key={row.id}>
                <div>
                  <span>CH.{row.chapter} · {row.difficultyLabel} · {row.riskLabel} · 평균 {row.avgCredit}Cr</span>
                  <strong>{row.name}</strong>
                  <small>승산 {row.successPct}% · {row.repeatValue} · {row.prepText}</small>
                  <small>{row.rewardText}</small>
                </div>
                <ActionButton
                  action="target"
                  onClick={() => setMissionId(row.id)}
                  disabled={row.locked}
                >
                  선택
                </ActionButton>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>캠페인 진행</h2>
            <span>{campaignReport.progressPct}% · ★{campaignReport.starTotal}/{campaignReport.starMax}</span>
          </div>
          <p style={{ color: '#64717d', fontWeight: 800, lineHeight: 1.55, margin: 0 }}>
            {campaignReport.headline}
          </p>
          <div className="games-rank-split">
            <SmallStat label="클리어" value={`${campaignReport.clearedCount}/${campaignReport.totalMissions}`} />
            <SmallStat label="다음 임무" value={campaignReport.nextMissionName} />
            <SmallStat label="CH1 별" value={`${campaignReport.chapterOneStars}/9`} />
            <SmallStat label="Hard" value={campaignReport.hardUnlocked ? '해금' : '잠김'} />
            <SmallStat label="VeryHard" value={campaignReport.veryHardUnlocked ? '해금' : campaignReport.veryHardRequirementText} />
          </div>
          <div className="game-save-list">
            {campaignReport.missionRows.map((row) => (
              <article className="game-save-row" key={row.id}>
                <div>
                  <span>CH.{row.chapter} · {row.difficultyLabel} · {row.statusLabel} · 권장 {row.recommendedPower}</span>
                  <strong>{row.name}</strong>
                  <small>
                    {row.cleared
                      ? `최고 ★${row.bestStars}/3 · 최단 ${row.bestTurn || '-'}턴 · 전원 생존 ${row.allSurvived ? '성공' : '미달'}`
                      : row.locked
                        ? row.lockReason
                        : campaignReport.recommendations.join(' / ')}
                  </small>
                </div>
                <ActionButton
                  action="target"
                  onClick={() => setMissionId(row.id)}
                  disabled={row.locked}
                >
                  선택
                </ActionButton>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>출전 편성</h2>
            <span>{formationCount}/{MAX_FORMATION_SIZE}</span>
          </div>
          {Array.isArray(formationPresets) && formationPresets.length ? (
            <div className="game-save-list" style={{ marginBottom: 12 }}>
              {formationPresets.slice(0, 4).map((preset) => (
                <article className="game-save-row" key={preset.id}>
                  <div>
                    <span>{preset.recommended ? '추천' : preset.badge} · 적합도 {preset.fitScore} · 예상 {preset.successPct}%</span>
                    <strong>{preset.name}</strong>
                    <small>{preset.reason}</small>
                    <small>{preset.orderText}</small>
                    <small>{preset.threatText} · 전투력 {preset.power.toLocaleString('ko-KR')} ({preset.powerGap >= 0 ? '+' : ''}{preset.powerGap})</small>
                  </div>
                  <ActionButton
                    action="formation"
                    cue="off"
                    onClick={() => setState((current) => applyFormationPresetAction(current, preset.id, missionId))}
                  >
                    적용
                  </ActionButton>
                </article>
              ))}
            </div>
          ) : null}
          <div className="game-save-list">
            {formation.map((student) => (
              <article className="game-save-row" key={student.id}>
                <div>
                  <span>{student.role} · 전투력 {student.power}{student.selected ? ` · ${student.order}번` : ''}</span>
                  <strong>{student.name}</strong>
                  <small>HP {student.hp} · 공격 {student.atk} · 방어 {student.def} · 사거리 {student.range} · 이동 {student.move}</small>
                  <small>전술 스킬: {student.skillText || '-'}</small>
                  <small>{student.tacticalProfile}</small>
                </div>
                <ActionButton
                  action="formation"
                  cue="off"
                  onClick={() => setState((current) => setFormationAction(current, student.id, !student.selected))}
                >
                  {student.selected ? '제외' : '편성'}
                </ActionButton>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>선택 유닛</h2>
            <span>{selectedUnit?.name || '-'}</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="HP" value={selectedUnit ? `${selectedUnit.hp}/${selectedUnit.maxHp}` : '-'} />
            <SmallStat label="AP" value={selectedUnit?.ap ?? 0} />
            <SmallStat label="공격" value={selectedUnit?.atk ?? 0} />
            <SmallStat label="사거리" value={selectedUnit?.range ?? 0} />
          </div>
          <div className="srpg-pad">
            <button type="button" aria-label="위로 이동" title="위로 이동" data-game-sfx="off" disabled={!selectedCanAct} onClick={() => setState((current) => moveSelectedAction(current, 0, -1))}>↑</button>
            <button type="button" aria-label="왼쪽으로 이동" title="왼쪽으로 이동" data-game-sfx="off" disabled={!selectedCanAct} onClick={() => setState((current) => moveSelectedAction(current, -1, 0))}>←</button>
            <button type="button" aria-label="오른쪽으로 이동" title="오른쪽으로 이동" data-game-sfx="off" disabled={!selectedCanAct} onClick={() => setState((current) => moveSelectedAction(current, 1, 0))}>→</button>
            <button type="button" aria-label="아래로 이동" title="아래로 이동" data-game-sfx="off" disabled={!selectedCanAct} onClick={() => setState((current) => moveSelectedAction(current, 0, 1))}>↓</button>
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>전술 명령</h2>
            <span>{battle.phase}</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="대상" value={targetEnemy?.name || '없음'} />
            <SmallStat label="적 생존" value={battle.enemies.filter((enemy) => enemy.hp > 0).length} />
            <SmallStat label="스킬" value={selectedSkill?.name || '-'} />
            <SmallStat label="소모 AP" value={selectedSkill?.apCost ?? 0} />
          </div>
          <label className="game-save-json-field">
            <span>전술 스킬</span>
            <select value={activeSkillId} onChange={(event) => setSkillId(event.target.value)}>
              {skills.map((skill) => (
                <option value={skill.id} key={skill.id}>{skill.name} · AP {skill.apCost}</option>
              ))}
            </select>
          </label>
          <p style={{ color: '#64717d', fontWeight: 800, lineHeight: 1.55 }}>
            대상 {selectedSkill?.targetName || '-'} · 사거리 {selectedSkill?.rangeText || '-'} · {selectedSkill?.note || ''}
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton action="combat" cue="off" disabled={!selectedCanAct || !targetEnemy} onClick={() => setState((current) => attackSelectedAction(current, targetEnemy?.id))}>선택 대상 공격</ActionButton>
            <ActionButton action={selectedSkill?.action || 'skill'} cue="off" disabled={!selectedSkill?.canUse} onClick={() => setState((current) => executeSkillAction(current, activeSkillId))}>선택 스킬 사용</ActionButton>
            <ActionButton
              action="consume"
              cue="off"
              disabled={!selectedCanAct || Number(state.inventory.con_bandage || 0) <= 0}
              onClick={() => setState((current) => consumeBandageAction(current))}
            >
              붕대 사용 (x{Number(state.inventory.con_bandage || 0)})
            </ActionButton>
            <ActionButton
              action="wait"
              cue="off"
              disabled={!selectedCanAct}
              onClick={() => setState((current) => waitSelectedUnitAction(current))}
            >
              대기
            </ActionButton>
            <ActionButton action="turn" cue="off" disabled={battle.phase !== 'player'} onClick={() => setState((current) => endTurnAction(current))}>턴 종료</ActionButton>
            <ActionButton action="auto" cue="off" disabled={battle.phase !== 'player'} onClick={() => setState((current) => autoPlayerTurnAction(current))}>자동 1턴</ActionButton>
            <ActionButton action="auto" cue="off" disabled={battle.phase !== 'player'} onClick={runAutoBattle}>자동 전투 x8</ActionButton>
          </div>
        </section>
      </section>
              </>
    </>
  );
}
