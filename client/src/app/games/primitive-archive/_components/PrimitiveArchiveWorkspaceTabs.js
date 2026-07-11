import GameActionIcon from '../../_components/GameActionIcon';

export default function PrimitiveArchiveWorkspaceTabs({ activeId, label, onChange, tabs }) {
  return (
    <div className="primitive-workspace-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          type="button"
          role="tab"
          aria-selected={activeId === tab.id}
          className={activeId === tab.id ? 'is-active' : ''}
          onClick={() => onChange(tab.id)}
          key={tab.id}
        >
          <GameActionIcon action={tab.icon} label={tab.label} />
          <span>{tab.label}</span>
          {tab.badge ? <strong>{tab.badge}</strong> : null}
        </button>
      ))}
    </div>
  );
}
