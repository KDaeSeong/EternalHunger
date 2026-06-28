import SiteHeader from './SiteHeader';

export default function AppShell({ children, className = '', showHeader = true }) {
  return (
    <div className={`app-shell ${className}`.trim()}>
      {showHeader ? <SiteHeader /> : null}
      {children}
    </div>
  );
}
