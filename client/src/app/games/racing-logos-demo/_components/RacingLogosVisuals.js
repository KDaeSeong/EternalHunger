import GameActionIcon from '../../_components/GameActionIcon';

export function RacingLogosPanelTitle({
  action,
  children,
  heading = 'h2',
  headingProps,
  label = '',
  meta,
  title,
}) {
  const Heading = heading;
  const iconLabel = label || (typeof title === 'string' ? title : '레이싱 로고 패널');
  const titleNode = (
    <Heading {...headingProps}>
      <GameActionIcon action={action} label={iconLabel} />
      {title}
    </Heading>
  );
  const metaNode = meta === undefined || meta === null ? null : <span>{meta}</span>;

  if (children) {
    return (
      <div className="games-panel-title racing-logos-panel-title">
        <div className="racing-logos-panel-title__copy">
          {titleNode}
          {metaNode}
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="games-panel-title racing-logos-panel-title">
      {titleNode}
      {metaNode}
    </div>
  );
}

export function RacingLogosInfoRow({
  action,
  children,
  className = '',
  label = '',
  leading = null,
  ...props
}) {
  const layoutClass = leading ? 'racing-logo-preview-row' : 'racing-logo-icon-row';

  return (
    <article className={`game-save-row ${layoutClass}${className ? ` ${className}` : ''}`} {...props}>
      {leading || <GameActionIcon action={action} label={label} />}
      {children}
    </article>
  );
}
