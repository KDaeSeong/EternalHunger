import GameActionIcon from '../../_components/GameActionIcon';
import DualAcademyTcgBoardTab from './DualAcademyTcgBoardTab';
import DualAcademyTcgAdvisorTab from './DualAcademyTcgAdvisorTab';
import DualAcademyTcgInspectTab from './DualAcademyTcgInspectTab';
import DualAcademyTcgHandTab from './DualAcademyTcgHandTab';
import DualAcademyTcgLogsTab from './DualAcademyTcgLogsTab';

const TABS = [
  { id: 'board', label: '보드' },
  { id: 'advisor', label: 'AI 진단' },
  { id: 'inspect', label: '존 검사' },
  { id: 'hand', label: '핸드 액션' },
  { id: 'logs', label: '로그/아카이브' },
];

export default function DualAcademyTcgFeatureTabs(props) {
  const {
    activeTcgTab,
    replayExport,
    setActiveTcgTab,
    state,
    turnAdvisor,
    zoneInspection,
  } = props;

  const badgeByTab = {
    board: state.phase,
    advisor: turnAdvisor.riskLabel,
    inspect: zoneInspection.badge,
    hand: `${state.players.player.hand.length}장`,
    logs: replayExport.statusLabel,
  };

  return (
    <>
      <section className="tcg-feature-tabs" role="tablist" aria-label="TCG 기능">
        {TABS.map((tab) => (
          <button
            type="button"
            role="tab"
            aria-selected={activeTcgTab === tab.id}
            className={activeTcgTab === tab.id ? 'is-active' : ''}
            key={tab.id}
            onClick={() => setActiveTcgTab(tab.id)}
          >
            <GameActionIcon action={tab.id} label={tab.label} />
            <span>{tab.label}</span>
            <strong>{badgeByTab[tab.id]}</strong>
          </button>
        ))}
      </section>

      {activeTcgTab === 'board' ? <DualAcademyTcgBoardTab {...props} /> : null}
      {activeTcgTab === 'advisor' ? <DualAcademyTcgAdvisorTab {...props} /> : null}
      {activeTcgTab === 'inspect' ? <DualAcademyTcgInspectTab {...props} /> : null}
      {activeTcgTab === 'logs' ? <DualAcademyTcgLogsTab {...props} /> : null}
      {activeTcgTab === 'hand' ? <DualAcademyTcgHandTab {...props} /> : null}
    </>
  );
}
