import GameActionIcon from '../../_components/GameActionIcon';

export function SiCodingPanelTitle({
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
  const iconLabel = label || (typeof title === 'string' ? title : 'SI 코딩 패널');
  const titleNode = (
    <Heading {...headingProps}>
      <GameActionIcon action={action} label={iconLabel} />
      {title}
    </Heading>
  );
  const metaNode = meta === undefined || meta === null ? null : <span>{meta}</span>;

  if (children) {
    return (
      <div className="games-panel-title si-coding-panel-title" style={style}>
        <div className="si-coding-panel-title__copy">
          {titleNode}
          {metaNode}
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="games-panel-title si-coding-panel-title" style={style}>
      {titleNode}
      {metaNode}
    </div>
  );
}

export function SiCodingIconRow({ action, children, className = '', label = '', ...props }) {
  return (
    <article className={`game-save-row game-save-row--icon si-coding-icon-row${className ? ` ${className}` : ''}`} {...props}>
      <GameActionIcon action={action} label={label} />
      {children}
    </article>
  );
}
