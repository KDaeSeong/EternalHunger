'use client';

import { TRACK, blockSummary, formatTime, mapViewState, pointOnEdge, trainRows } from '../_lib/rail3dEngine';

function railActionSnapshot(value) {
  const rows = trainRows(value);
  const blocks = blockSummary(value);
  return {
    nowS: Number(value.nowS || 0),
    total: rows.length,
    completed: rows.filter((row) => row.phase === 'DONE').length,
    stopped: rows.filter((row) => row.signalState === 'STOP').length,
    tokenWaits: rows.filter((row) => row.stopReason?.kind === 'TOKEN_WAIT').length,
    waitS: rows.reduce((sum, row) => sum + Number(row.waitSeconds || 0), 0),
    occupied: Number(blocks.OCCUPIED || 0),
    reserved: Number(blocks.RESERVED || 0),
  };
}

export function actionFeedbackText(previous, next, label, fallback = '') {
  const latestLog = next.log?.[0];
  if (latestLog && latestLog !== previous.log?.[0]) return latestLog;
  if (Number(previous.stepSeconds) !== Number(next.stepSeconds)) return `스텝 간격을 ${next.stepSeconds}s로 변경했습니다.`;
  if (Number(previous.lookaheadBlocks) !== Number(next.lookaheadBlocks)) return `신호 예약 lookahead를 ${next.lookaheadBlocks}블록으로 조정했습니다.`;

  const before = railActionSnapshot(previous);
  const after = railActionSnapshot(next);
  const parts = [];
  if (after.nowS !== before.nowS) parts.push(`${formatTime(after.nowS)}까지 진행`);
  if (after.completed !== before.completed) parts.push(`종착 ${after.completed}/${after.total}편`);
  if (after.stopped !== before.stopped) parts.push(`STOP ${after.stopped}편`);
  if (after.tokenWaits !== before.tokenWaits) parts.push(`토큰 대기 ${after.tokenWaits}편`);
  if (after.waitS !== before.waitS) parts.push(`총 대기 ${after.waitS}s`);
  if (after.occupied !== before.occupied || after.reserved !== before.reserved) parts.push(`블록 점유 ${after.occupied} · 예약 ${after.reserved}`);
  if (parts.length) return `${label}: ${parts.join(' · ')}`;
  return fallback || `${label}: 현재 ${formatTime(after.nowS)} · STOP ${after.stopped}편 · 종착 ${after.completed}/${after.total}편`;
}

export function RailMap({ state, selectedTrainId }) {
  const view = mapViewState(state);
  const xs = view.nodes.map((node) => node.x);
  const zs = view.nodes.map((node) => node.z);
  const minX = Math.min(...xs, 0) - 40;
  const maxX = Math.max(...xs, 500) + 40;
  const minZ = Math.min(...zs, 0) - 80;
  const maxZ = Math.max(...zs, 120) + 80;
  const stationByStop = new Map(TRACK.stations.map((station) => [station.stopPoint.edgeId + ':' + station.stopPoint.sM, station]));

  return (
    <svg className="rail-map" viewBox={`${minX} ${minZ} ${maxX - minX} ${maxZ - minZ}`} role="img" aria-label="Rail3D minimap">
      <rect x={minX} y={minZ} width={maxX - minX} height={maxZ - minZ} rx="18" fill="#071923" />
      {view.edges.map((edge) => {
        const from = view.nodes.find((node) => node.id === edge.from);
        const to = view.nodes.find((node) => node.id === edge.to);
        if (!from || !to) return null;
        return <line key={edge.id} x1={from.x} y1={from.z} x2={to.x} y2={to.z} stroke="#94a9b8" strokeWidth="8" strokeLinecap="round" />;
      })}
      {view.blocks.map((block) => {
        const a = pointOnEdge(block.edgeId, block.s0);
        const b = pointOnEdge(block.edgeId, block.s1);
        const color = block.state === 'OCCUPIED' ? '#ff9f1c' : block.state === 'RESERVED' ? '#39c6f0' : '#335463';
        return <line key={block.id} x1={a.x} y1={a.z + 16} x2={b.x} y2={b.z + 16} stroke={color} strokeWidth="5" strokeLinecap="round" />;
      })}
      {view.stations.map((station) => {
        const point = pointOnEdge(station.stopPoint.edgeId, station.stopPoint.sM);
        return (
          <g key={station.id}>
            <circle cx={point.x} cy={point.z} r="14" fill="#f7fbff" stroke="#2673a6" strokeWidth="5" />
            <text x={point.x} y={point.z - 24} fill="#f7fbff" textAnchor="middle" fontSize="18" fontWeight="800">{station.name}</text>
          </g>
        );
      })}
      {view.trains.map((train, index) => {
        const yOffset = index % 2 === 0 ? -18 : 42;
        const fill = train.signalState === 'STOP' ? '#e84855' : train.phase === 'DONE' ? '#8ea3ad' : '#39c6f0';
        const station = stationByStop.get(train.pose.edgeId + ':' + train.pose.headS);
        const selected = train.id === selectedTrainId;
        return (
          <g key={train.id}>
            <circle cx={train.point.x} cy={train.point.z + yOffset} r={selected ? 21 : 15} fill={selected ? '#fbbf24' : fill} stroke="#f7fbff" strokeWidth={selected ? 5 : 4} />
            <text x={train.point.x} y={train.point.z + yOffset + 5} fill="#071923" textAnchor="middle" fontSize="12" fontWeight="900">{train.id}</text>
            {station ? <title>{station.name}</title> : null}
          </g>
        );
      })}
    </svg>
  );
}
