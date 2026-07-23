'use client';

import { Minus, Plus } from 'lucide-react';
import GameActionIcon from '../../_components/GameActionIcon';
import {
  GameControlButton,
  RecentActionResult,
  SmallStat,
} from '../../_components/GamePlayPrimitives';
import { PrimitiveArchivePanelTitle } from './PrimitiveArchiveVisuals';

function diplomacyDisabledText(rival, action) {
  if (rival.actedToday) return '오늘 교섭을 완료했습니다.';
  if (!rival.canAct) return rival.statusText;
  if (action === 'trade') return `필요: ${rival.tradeCostText}`;
  if (action === 'gift') return `필요: ${rival.giftCostText}`;
  if (action === 'exchange') {
    if (Number(rival.relation || 0) < 20) return '관계 20 이상 필요';
    return `필요: ${rival.exchangeCostText}`;
  }
  if (action === 'raid') return '수렵 연구 완료 필요';
  return rival.statusText;
}

export default function PrimitiveArchiveTribeTab({
  actionFeedback,
  adjustTribeJob,
  recentActionText,
  rivals = [],
  runDiplomacy,
  tribe,
}) {
  const knownCount = rivals.filter((rival) => rival.known).length;
  const lastProduction = tribe.lastProduction || {};
  const foodResult = Number(tribe.productionSerial || 0) > 0
    ? `${Number(lastProduction.foodProvided || 0)}/${Number(lastProduction.foodNeed || 0)}`
    : '정산 전';

  return (
    <>
      <RecentActionResult action={actionFeedback?.action || 'primitive-job'} label={actionFeedback?.label || '최근 부족 운영 결과'} text={recentActionText} tone={actionFeedback?.tone || 'ready'} pinned />

      <section className="games-panel primitive-tribe-overview">
        <PrimitiveArchivePanelTitle
          action="primitive-growth"
          title="부족 운영"
          meta={`Day ${tribe.productionSerial}회 정산 · 접촉 ${knownCount}/${rivals.length}`}
        >
          <strong>{tribe.population}/{tribe.capacity}명</strong>
        </PrimitiveArchivePanelTitle>
        <div className="games-rank-split games-rank-split--compact primitive-tribe-stats">
          <SmallStat label="인구" value={`${tribe.population}/${tribe.capacity}`} />
          <SmallStat label="배치" value={`${tribe.assigned}/${tribe.population}`} />
          <SmallStat label="미배치" value={tribe.unassigned} />
          <SmallStat label="사기" value={Math.round(tribe.morale)} />
          <SmallStat label="식량" value={`${tribe.foodStock} / ${tribe.foodNeed}`} />
        </div>
        <div className="primitive-tribe-growth">
          <div>
            <span>{tribe.atCapacity ? '수용력 한계' : '다음 인구 성장'}</span>
            <strong>{Math.round(tribe.growthProgress)}/{tribe.growthTarget}</strong>
          </div>
          <div className="primitive-project-progress" aria-label={`부족 성장도 ${tribe.growthPct}%`}>
            <i style={{ width: `${tribe.growthPct}%` }} />
          </div>
          <small>{tribe.atCapacity ? '대피소·정착·국가 노동력 연구로 수용력을 늘릴 수 있습니다.' : `다음 날 예상 생산: ${tribe.nextProductionText}`}</small>
        </div>
      </section>

      <section className="games-panel primitive-job-panel">
        <PrimitiveArchivePanelTitle action="primitive-job" title="직업 배치" meta={`미배치 ${tribe.unassigned}명 · AP 소모 없음`} />
        <div className="primitive-job-grid">
          {tribe.jobs.map((job) => (
            <article className={job.unlocked ? '' : 'is-locked'} key={job.id}>
              <GameActionIcon action={job.action} className="primitive-job-icon" />
              <div className="primitive-job-copy">
                <span>{job.unlocked ? job.outputText : '기술 연구 후 해금'}</span>
                <strong>{job.name}</strong>
                <small>{job.description}</small>
                <em>다음 정산 · {job.dailyText}</em>
              </div>
              <div className="primitive-job-stepper">
                <button
                  type="button"
                  data-game-sfx="off"
                  disabled={!job.canRemove}
                  onClick={() => adjustTribeJob(job.id, -1)}
                  aria-label={`${job.name} 배치 1명 감소`}
                  title={`${job.name} 배치 1명 감소`}
                >
                  <Minus size={16} strokeWidth={2.4} />
                </button>
                <strong>{job.count}</strong>
                <button
                  type="button"
                  data-game-sfx="off"
                  disabled={!job.canAdd}
                  onClick={() => adjustTribeJob(job.id, 1)}
                  aria-label={`${job.name} 배치 1명 증가`}
                  title={job.unlocked ? `${job.name} 배치 1명 증가` : job.lockedReason}
                >
                  <Plus size={16} strokeWidth={2.4} />
                </button>
              </div>
            </article>
          ))}
        </div>
        <div className="primitive-tribe-ledger">
          <div><span>최근 생산</span><strong>{tribe.lastProductionText}</strong></div>
          <div><span>최근 배식</span><strong>{foodResult}</strong></div>
          <div><span>자동 건설</span><strong>{lastProduction.projectWork ? `${lastProduction.projectName} +${lastProduction.projectWork}` : '진행 없음'}</strong></div>
          <div><span>자동 연구</span><strong>{lastProduction.researchPoints ? `+${lastProduction.researchPoints}RP` : '진행 없음'}</strong></div>
        </div>
      </section>

      <section className="games-panel primitive-diplomacy-panel">
        <PrimitiveArchivePanelTitle action="primitive-diplomacy" title="경쟁 부족 외교" meta={`접촉 ${knownCount}/${rivals.length}`} />
        <div className="primitive-rival-list">
          {rivals.map((rival) => (
            <article className={`${rival.known ? `is-${rival.relationTone}` : 'is-unknown'}`} key={rival.id}>
              <div className="primitive-rival-head">
                <GameActionIcon action="diplomacy" />
                <div>
                  <span>{rival.known ? `${rival.temperament} · ${rival.specialty}` : '탐사 경계 너머'}</span>
                  <strong>{rival.known ? rival.name : '미접촉 부족'}</strong>
                </div>
                <b>{rival.known ? `${rival.relationLabel} ${Math.round(rival.relation)}` : '미확인'}</b>
              </div>

              {rival.known ? (
                <>
                  <div className="primitive-relation-meter" aria-label={`${rival.name} 관계 ${Math.round(rival.relation)}`}>
                    <i style={{ width: `${rival.relationPct}%` }} />
                  </div>
                  <div className="primitive-rival-terms">
                    <span>교역 · {rival.tradeCostText} → {rival.tradeRewardText}</span>
                    <span>선물 · {rival.giftCostText}</span>
                    <span>지식 · 관계 20 / {rival.exchangeCostText} / +{rival.exchangePoints}RP</span>
                    <span>{rival.statusText}</span>
                  </div>
                  <div className="primitive-diplomacy-actions">
                    <GameControlButton
                      action="trade"
                      cue="off"
                      disabled={!rival.canTrade}
                      title={rival.canTrade ? '교역 실행' : diplomacyDisabledText(rival, 'trade')}
                      onClick={() => runDiplomacy(rival.id, 'trade')}
                    >교역</GameControlButton>
                    <GameControlButton
                      action="claim"
                      cue="off"
                      disabled={!rival.canGift}
                      title={rival.canGift ? '선물 전달' : diplomacyDisabledText(rival, 'gift')}
                      onClick={() => runDiplomacy(rival.id, 'gift')}
                    >선물</GameControlButton>
                    <GameControlButton
                      action="research"
                      cue="off"
                      disabled={!rival.canExchange}
                      title={rival.canExchange ? '지식 교류 실행' : diplomacyDisabledText(rival, 'exchange')}
                      onClick={() => runDiplomacy(rival.id, 'exchange')}
                    >지식 교류</GameControlButton>
                    <GameControlButton
                      action="combat"
                      cue="off"
                      disabled={!rival.canRaid}
                      title={rival.canRaid ? '약탈 시도' : diplomacyDisabledText(rival, 'raid')}
                      onClick={() => runDiplomacy(rival.id, 'raid')}
                    >약탈</GameControlButton>
                  </div>
                </>
              ) : (
                <div className="primitive-rival-unknown">경쟁 부족의 거점 지역을 발견하면 교섭 정보가 기록됩니다.</div>
              )}
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
