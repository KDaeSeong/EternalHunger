import GameActionIcon from '../../_components/GameActionIcon';
import PrimitiveArchivePortrait from './PrimitiveArchivePortrait';

const ROLE_ACTIONS = { scout: 'primitive-survey', hunt: 'primitive-hunt', craft: 'primitive-craft', support: 'primitive-camp', neutral: 'primitive-job' };
const PERSON_LABELS = { founder: '창건자 본인', successor: '후계 본인', person: '본인 기록', unknown: '인물 기록 확인 필요' };

export default function PrimitiveArchivePersonIdentity({ identity }) {
  if (!identity) return null;
  const reference = identity.rootReference?.actorId !== identity.actorId ? identity.rootReference : null;
  const referenceLabel = reference?.isFounder ? '계보의 창건자' : '계보 시작 인물';
  const roleKey = Object.hasOwn(ROLE_ACTIONS, identity.roleKey) ? identity.roleKey : 'neutral';
  const personLabel = Object.hasOwn(PERSON_LABELS, identity.kind) ? PERSON_LABELS[identity.kind] : PERSON_LABELS.unknown;
  return (
    <span className="primitive-person-identity" data-role-key={roleKey}>
      <span className="primitive-person-identity__badges">
        <span>{personLabel}</span>
        <span>{identity.generationLabel || '세대 미기록'}</span>
        <span><GameActionIcon action={ROLE_ACTIONS[roleKey]} />{identity.role || '역할 미기록'}</span>
        {identity.stageLabel ? <span>{identity.stageLabel}</span> : null}
      </span>
      {identity.mentor ? <span className="primitive-person-identity__lineage">지도자 · {identity.mentor.name}</span> : null}
      {reference ? <span className="primitive-person-identity__reference">
        <PrimitiveArchivePortrait member={reference} size={24}
          alt={`${referenceLabel} ${reference.name}의 참고 초상, 현재 후계 ${identity.name}의 초상이 아님`} />
        <span>{referenceLabel} · {reference.name}</span>
      </span> : null}
      {identity.trait ? <span className="primitive-person-identity__trait">본인 특성 · {identity.trait}</span> : null}
      {identity.notice ? <span className="primitive-person-identity__notice">{identity.notice}</span> : null}
    </span>
  );
}
