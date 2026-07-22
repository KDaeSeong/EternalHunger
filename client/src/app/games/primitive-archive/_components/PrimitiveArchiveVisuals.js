import GameActionIcon from '../../_components/GameActionIcon';

export function primitiveItemAction(item) {
  if (item?.type === 'food') return 'primitive-meal';
  if (item?.type === 'equip') return 'primitive-equip';
  if (item?.type === 'book') return 'archive';
  if (item?.icon === 'weapon') return 'primitive-hunt';
  if (item?.icon === 'tool') return 'primitive-craft';
  if (item?.icon === 'artifact') return 'primitive-discovery';
  if (item?.icon === 'herb') return 'primitive-gather';
  return 'inventory';
}

export function PrimitiveArchivePanelTitle({
  action,
  children,
  heading = 'h2',
  headingProps,
  label = '',
  meta,
  style,
  title,
}) {
  const Heading = heading;
  const iconLabel = label || (typeof title === 'string' ? title : '문명 아카이브 패널');
  const titleNode = (
    <Heading {...headingProps}>
      <GameActionIcon action={action} label={iconLabel} />
      {title}
    </Heading>
  );
  const metaNode = meta === undefined || meta === null ? null : <span>{meta}</span>;

  if (children) {
    return (
      <div className="games-panel-title primitive-archive-panel-title" style={style}>
        <div className="primitive-archive-panel-title__copy">
          {titleNode}
          {metaNode}
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="games-panel-title primitive-archive-panel-title" style={style}>
      {titleNode}
      {metaNode}
    </div>
  );
}

export function PrimitiveArchiveIconRow({ action, children, className = '', label = '', ...props }) {
  return (
    <article className={`game-save-row primitive-archive-icon-row${className ? ` ${className}` : ''}`} {...props}>
      <GameActionIcon action={action} label={label} />
      {children}
    </article>
  );
}
