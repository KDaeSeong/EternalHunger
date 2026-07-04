import Link from 'next/link';
import {
  GAME_CATALOG,
  GAME_ROADMAP,
  findGameBySlug,
  getGamePortingChecklist,
  getGamePortingProgress,
  gameBoardWriteHref,
  gameRoomCreateHref,
} from '../../games/_lib/gameCatalog';
import GameCandidateManager from './_components/GameCandidateManager';

export const metadata = {
  title: '게임 이식 관리 | EternalHunger',
};

function pct(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(n * 100)));
}

function stageTone(stage) {
  if (stage === 'live') return '#22c55e';
  if (stage === 'prototype') return '#38bdf8';
  return '#f59e0b';
}

function getRows() {
  return [...GAME_CATALOG, ...GAME_ROADMAP]
    .map((base, index) => {
      const game = findGameBySlug(base.slug);
      if (!game) return null;
      const checklist = getGamePortingChecklist(game);
      const progress = getGamePortingProgress(game);
      return {
        ...game,
        sourceIndex: index,
        priority: base.priority || (game.integration.stage === 'live' ? '운영 중' : '미분류'),
        scope: base.scope || game.subtitle || '',
        nextStep: base.nextStep || game.statusItems?.[0] || '',
        checklist,
        progress,
        missing: checklist.filter((item) => !item.done),
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const stageOrder = { live: 0, prototype: 1, planned: 2 };
      const left = stageOrder[a.integration.stage] ?? 3;
      const right = stageOrder[b.integration.stage] ?? 3;
      if (left !== right) return left - right;
      return a.sourceIndex - b.sourceIndex;
    });
}

const styles = {
  wrap: {
    maxWidth: 1240,
    margin: '0 auto',
    display: 'grid',
    gap: 18,
  },
  header: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: 16,
    alignItems: 'end',
  },
  title: {
    margin: 0,
    color: '#f8fafc',
    fontSize: 26,
    lineHeight: 1.15,
    fontWeight: 950,
  },
  sub: {
    maxWidth: 760,
    margin: '8px 0 0',
    color: '#b6c2d6',
    lineHeight: 1.55,
    fontWeight: 700,
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  action: {
    minHeight: 38,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(56, 189, 248, 0.26)',
    borderRadius: 8,
    background: 'rgba(8, 47, 73, 0.35)',
    color: '#e0f2fe',
    padding: '0 12px',
    textDecoration: 'none',
    fontWeight: 900,
  },
  metrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 10,
  },
  metric: {
    border: '1px solid rgba(148, 163, 184, 0.18)',
    borderRadius: 8,
    background: 'rgba(15, 23, 42, 0.72)',
    padding: 14,
  },
  metricLabel: {
    display: 'block',
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 900,
  },
  metricValue: {
    display: 'block',
    marginTop: 5,
    color: '#f8fafc',
    fontSize: 24,
    lineHeight: 1,
    fontWeight: 950,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 12,
  },
  card: {
    minWidth: 0,
    display: 'grid',
    gap: 12,
    border: '1px solid rgba(148, 163, 184, 0.18)',
    borderRadius: 8,
    background: 'rgba(15, 23, 42, 0.78)',
    padding: 15,
  },
  cardHead: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: 12,
    alignItems: 'start',
  },
  kicker: {
    margin: '0 0 5px',
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: 950,
  },
  name: {
    margin: 0,
    color: '#f8fafc',
    fontSize: 18,
    lineHeight: 1.25,
    fontWeight: 950,
  },
  pill: {
    minHeight: 28,
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 999,
    border: '1px solid rgba(148, 163, 184, 0.22)',
    color: '#e5e7eb',
    padding: '0 10px',
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: 'nowrap',
  },
  desc: {
    margin: 0,
    color: '#b6c2d6',
    lineHeight: 1.5,
    fontWeight: 700,
  },
  progressTrack: {
    height: 9,
    overflow: 'hidden',
    borderRadius: 999,
    background: 'rgba(148, 163, 184, 0.22)',
  },
  checklist: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    minHeight: 26,
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 999,
    border: '1px solid rgba(148, 163, 184, 0.20)',
    padding: '0 8px',
    fontSize: 12,
    fontWeight: 900,
  },
  detailGrid: {
    display: 'grid',
    gap: 8,
  },
  detailRow: {
    display: 'grid',
    gridTemplateColumns: '78px minmax(0, 1fr)',
    gap: 10,
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 1.45,
  },
  detailLabel: {
    color: '#94a3b8',
    fontWeight: 950,
  },
  linkGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  smallLink: {
    minHeight: 32,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(56, 189, 248, 0.22)',
    borderRadius: 8,
    background: 'rgba(8, 47, 73, 0.24)',
    color: '#e0f2fe',
    padding: '0 10px',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 900,
  },
};

export default function AdminGamesPage() {
  const rows = getRows();
  const live = rows.filter((row) => row.integration.stage === 'live').length;
  const prototype = rows.filter((row) => row.integration.stage === 'prototype').length;
  const blocked = rows.filter((row) => row.missing.length > 0).length;
  const avgProgress = rows.length
    ? Math.round(rows.reduce((sum, row) => sum + pct(row.progress.ratio), 0) / rows.length)
    : 0;

  return (
    <div style={styles.wrap}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>게임 이식 관리</h1>
          <p style={styles.sub}>
            종합 게임 사이트로 확장하기 위한 공통 연결 상태입니다. 카탈로그, 게시판, 게임방,
            상태 동기화, 전적, 저장 슬롯, 플레이 화면을 같은 기준으로 확인합니다.
          </p>
        </div>
        <div style={styles.actions}>
          <Link href="/games" style={styles.action}>게임 허브</Link>
          <Link href="/games/rooms" style={styles.action}>게임방</Link>
          <Link href="/games/saves" style={styles.action}>저장 슬롯</Link>
          <Link href="/games/records" style={styles.action}>전적</Link>
        </div>
      </header>

      <section style={styles.metrics} aria-label="게임 이식 요약">
        <div style={styles.metric}>
          <span style={styles.metricLabel}>등록 게임</span>
          <strong style={styles.metricValue}>{rows.length}</strong>
        </div>
        <div style={styles.metric}>
          <span style={styles.metricLabel}>운영/프로토타입</span>
          <strong style={styles.metricValue}>{live + prototype}</strong>
        </div>
        <div style={styles.metric}>
          <span style={styles.metricLabel}>미완료 연결</span>
          <strong style={styles.metricValue}>{blocked}</strong>
        </div>
        <div style={styles.metric}>
          <span style={styles.metricLabel}>평균 준비도</span>
          <strong style={styles.metricValue}>{avgProgress}%</strong>
        </div>
      </section>

      <GameCandidateManager />

      <section style={styles.grid} aria-label="게임별 이식 상태">
        {rows.map((row) => {
          const percent = pct(row.progress.ratio);
          const tone = stageTone(row.integration.stage);
          return (
            <article style={styles.card} key={row.slug}>
              <div style={styles.cardHead}>
                <div>
                  <p style={styles.kicker}>{row.subtitle}</p>
                  <h2 style={styles.name}>{row.title}</h2>
                </div>
                <span style={{ ...styles.pill, borderColor: `${tone}66`, color: tone }}>
                  {row.integration.stageLabel} · {row.progress.label}
                </span>
              </div>

              <p style={styles.desc}>{row.summary}</p>

              <div style={styles.progressTrack} aria-label={`${row.title} 이식 준비도 ${percent}%`}>
                <div style={{ width: `${percent}%`, height: '100%', background: tone }} />
              </div>

              <div style={styles.checklist}>
                {row.checklist.map((item) => (
                  <span
                    style={{
                      ...styles.chip,
                      borderColor: item.done ? 'rgba(34, 197, 94, 0.34)' : 'rgba(245, 158, 11, 0.34)',
                      color: item.done ? '#86efac' : '#facc15',
                      background: item.done ? 'rgba(22, 101, 52, 0.18)' : 'rgba(113, 63, 18, 0.18)',
                    }}
                    key={item.key}
                    title={item.note}
                  >
                    {item.label}
                  </span>
                ))}
              </div>

              <div style={styles.detailGrid}>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>우선순위</span>
                  <span>{row.priority}</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>어댑터</span>
                  <span>{row.integration.adapter} · {row.integration.resultMode}</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>범위</span>
                  <span>{row.scope || '-'}</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>다음</span>
                  <span>{row.missing.length ? row.missing.map((item) => item.label).join(', ') : row.nextStep || '추가 작업 없음'}</span>
                </div>
              </div>

              <div style={styles.linkGrid}>
                <Link href={`/games/${row.slug}`} style={styles.smallLink}>상세</Link>
                <Link href={gameBoardWriteHref(row)} style={styles.smallLink}>논의 작성</Link>
                <Link href={gameRoomCreateHref(row)} style={styles.smallLink}>방 만들기</Link>
                <Link href={`/games/saves?gameSlug=${row.slug}`} style={styles.smallLink}>저장</Link>
                <Link href={`/games/records?gameSlug=${row.slug}`} style={styles.smallLink}>전적</Link>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
