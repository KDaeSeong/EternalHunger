import GameActionIcon from '../../_components/GameActionIcon';

export function MyAnimeCraftPanelTitle({ action, heading = 'h2', meta, style, title }) {
  const Heading = heading;

  return (
    <div className="games-panel-title starleague-panel-title" style={style}>
      <Heading>
        <GameActionIcon action={action} label={title} />
        {title}
      </Heading>
      {meta === undefined || meta === null ? null : <span>{meta}</span>}
    </div>
  );
}

export function MyAnimeCraftIconRow({
  action,
  as: Row = 'article',
  children,
  className = '',
  label = '',
  ...props
}) {
  return (
    <Row className={`game-save-row starleague-icon-row${className ? ` ${className}` : ''}`} {...props}>
      <GameActionIcon action={action} label={label} />
      {children}
    </Row>
  );
}
