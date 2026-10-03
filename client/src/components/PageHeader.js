// Shared page title block for site pages (2026-10 UI pass).
// Title and one plain sentence on the left, page actions on the right.
export default function PageHeader({ title, description, actions, children, className = '', titleId }) {
  return (
    <header className={`ui-page-header ${className}`.trim()}>
      <div className="ui-page-header__text">
        <h1 id={titleId}>{title}</h1>
        {description ? <p>{description}</p> : null}
        {children}
      </div>
      {actions ? <div className="ui-page-header__actions">{actions}</div> : null}
    </header>
  );
}
