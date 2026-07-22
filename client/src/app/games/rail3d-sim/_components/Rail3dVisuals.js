import GameActionIcon from '../../_components/GameActionIcon';

function positiveDelay(value) {
  return Math.max(
    0,
    Number(value?.positiveDelayS || 0),
    Number(value?.lastArrivalDelay || 0),
    Number(value?.arriveDelayS || 0),
    Number(value?.delayS || 0),
  );
}

export function railTrainAction(train) {
  if (!train) return 'dispatch';
  if (train.phase === 'DONE' || train.status === 'DONE' || train.status === '완료') return 'rail-clear';
  if (train.stopReason?.kind === 'TOKEN_WAIT' || train.tokenWait) return 'rail-token';
  if (train.stopReason?.kind === 'BLOCKED' || train.blockedBy) return 'block-conflict';
  if (train.signalState === 'STOP') return 'signal';
  if (positiveDelay(train) > 0) return 'rail-delay';
  if (train.phase === 'DWELL') return 'station';
  return 'dispatch';
}

export function railTrainTone(train) {
  const action = railTrainAction(train);
  if (action === 'rail-clear') return 'is-good';
  if (action === 'block-conflict' || action === 'signal') return 'is-critical';
  if (action === 'rail-token' || action === 'rail-delay') return 'is-watch';
  return '';
}

export function railSegmentAction(segment) {
  if (segment?.waiting?.length) return 'block-conflict';
  if (segment?.owner) return 'rail-token';
  return 'rail-clear';
}

export function railSegmentTone(segment) {
  if (segment?.waiting?.length) return 'is-critical';
  if (segment?.owner) return 'is-watch';
  return 'is-good';
}

export function Rail3dPanelTitle({ action, heading = 'h2', meta, style, title }) {
  const Heading = heading;

  return (
    <div className="games-panel-title rail3d-panel-title" style={style}>
      <Heading>
        <GameActionIcon action={action} label={title} />
        {title}
      </Heading>
      {meta === undefined || meta === null ? null : <span>{meta}</span>}
    </div>
  );
}

export function Rail3dIconRow({ action, children, className = '', label = '', ...props }) {
  return (
    <article className={`game-save-row rail3d-icon-row${className ? ` ${className}` : ''}`} {...props}>
      <GameActionIcon action={action} label={label} />
      {children}
    </article>
  );
}
