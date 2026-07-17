'use client';

import { CircleStop, KeyRound, MapPin, RadioTower, TrainFront } from 'lucide-react';
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
    blocked: rows.filter((row) => row.stopReason?.kind === 'BLOCKED').length,
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
  if (after.blocked !== before.blocked) parts.push(`블록 충돌 ${after.blocked}편`);
  if (after.waitS !== before.waitS) parts.push(`총 대기 ${after.waitS}s`);
  if (after.occupied !== before.occupied || after.reserved !== before.reserved) parts.push(`블록 점유 ${after.occupied} · 예약 ${after.reserved}`);
  if (parts.length) return `${label}: ${parts.join(' · ')}`;
  return fallback || `${label}: 현재 ${formatTime(after.nowS)} · STOP ${after.stopped}편 · 종착 ${after.completed}/${after.total}편`;
}

function segmentCenter(view, segment) {
  const points = (segment.edgeIds || []).flatMap((edgeId) => {
    const edge = view.edges.find((item) => item.id === edgeId);
    const from = edge ? view.nodes.find((node) => node.id === edge.from) : null;
    const to = edge ? view.nodes.find((node) => node.id === edge.to) : null;
    return from && to ? [{ x: (from.x + to.x) / 2, z: (from.z + to.z) / 2 }] : [];
  });
  if (!points.length) return null;
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    z: points.reduce((sum, point) => sum + point.z, 0) / points.length,
  };
}

export function RailMap({ state, selectedTrainId, onSelectTrain }) {
  const view = mapViewState(state);
  const xs = view.nodes.map((node) => node.x);
  const zs = view.nodes.map((node) => node.z);
  const minX = Math.min(...xs, 0) - 40;
  const maxX = Math.max(...xs, 500) + 40;
  const minZ = Math.min(...zs, 0) - 80;
  const maxZ = Math.max(...zs, 0) + 80;
  const stationByStop = new Map(TRACK.stations.map((station) => [station.stopPoint.edgeId + ':' + station.stopPoint.sM, station]));
  const trainsByPoint = view.trains.reduce((groups, train) => {
    const key = `${Math.round(train.point.x)}:${Math.round(train.point.z)}`;
    const group = groups.get(key) || [];
    group.push(train.id);
    groups.set(key, group);
    return groups;
  }, new Map());
  const trainLaneOffsets = new Map();
  trainsByPoint.forEach((trainIds) => {
    trainIds.forEach((trainId, index) => {
      const centeredIndex = index - (trainIds.length - 1) / 2;
      trainLaneOffsets.set(trainId, trainIds.length === 1 ? -18 : centeredIndex * 72);
    });
  });

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
        const markerX = (a.x + b.x) / 2;
        const markerY = (a.z + b.z) / 2 + 16;
        return (
          <g key={block.id} className={`rail-map__block is-${String(block.state || 'free').toLowerCase()}`}>
            <line x1={a.x} y1={a.z + 16} x2={b.x} y2={b.z + 16} stroke={color} strokeWidth="5" strokeLinecap="round" />
            {block.state !== 'FREE' ? (
              <RadioTower
                aria-hidden="true"
                x={markerX - 8}
                y={markerY - 8}
                width="16"
                height="16"
                stroke={color}
                strokeWidth="2.5"
              />
            ) : null}
          </g>
        );
      })}
      {view.stations.map((station) => {
        const point = pointOnEdge(station.stopPoint.edgeId, station.stopPoint.sM);
        return (
          <g key={station.id} className="rail-map__station">
            <circle cx={point.x} cy={point.z} r="17" fill="#f7fbff" stroke="#2673a6" strokeWidth="4" />
            <MapPin aria-hidden="true" x={point.x - 10} y={point.z - 10} width="20" height="20" stroke="#164866" strokeWidth="2.6" />
            <text x={point.x} y={point.z - 24} fill="#f7fbff" textAnchor="middle" fontSize="18" fontWeight="800">{station.shortName || station.name}</text>
            <title>{`${station.name} · ${station.id}`}</title>
          </g>
        );
      })}
      {view.segments.map((segment, index) => {
        const center = segmentCenter(view, segment);
        if (!center) return null;
        const y = center.z + (index % 2 ? 48 : -48);
        const waiting = segment.waiting?.length > 0;
        return (
          <g key={segment.id} className={`rail-map__token${waiting ? ' is-waiting' : ''}`}>
            <rect x={center.x - 38} y={y - 14} width="76" height="28" rx="7" />
            <KeyRound aria-hidden="true" x={center.x - 31} y={y - 8} width="16" height="16" strokeWidth="2.4" />
            <text x={center.x - 10} y={y + 5} fontSize="11" fontWeight="900">
              {segment.owner || 'FREE'}
            </text>
            <title>{`${segment.id} · ${segment.owner ? `${segment.owner} 점유` : 'FREE'}${waiting ? ` · 대기 ${segment.waiting.join(', ')}` : ''}`}</title>
          </g>
        );
      })}
      {view.trains.map((train, index) => {
        const yOffset = trainLaneOffsets.get(train.id) ?? (index % 2 === 0 ? -18 : 42);
        const fill = train.signalState === 'STOP' ? '#e84855' : train.phase === 'DONE' ? '#8ea3ad' : train.color;
        const station = stationByStop.get(train.pose.edgeId + ':' + train.pose.headS);
        const selected = train.id === selectedTrainId;
        const iconSize = selected ? 34 : 28;
        const centerY = train.point.z + yOffset;
        const handleKeyDown = (event) => {
          if (!onSelectTrain || !['Enter', ' '].includes(event.key)) return;
          event.preventDefault();
          onSelectTrain(train.id);
        };
        return (
          <g
            key={train.id}
            className={`rail-map__train${selected ? ' is-selected' : ''}${train.signalState === 'STOP' ? ' is-stopped' : ''}`}
            role={onSelectTrain ? 'button' : undefined}
            tabIndex={onSelectTrain ? 0 : undefined}
            aria-label={onSelectTrain ? `${train.id} 열차 선택, ${train.signalState}, ${train.phase}` : undefined}
            data-game-sfx={onSelectTrain ? 'select' : undefined}
            onClick={onSelectTrain ? () => onSelectTrain(train.id) : undefined}
            onKeyDown={handleKeyDown}
          >
            <rect
              className="rail-map__train-hitbox"
              x={train.point.x - iconSize / 2 - 5}
              y={centerY - iconSize / 2 - 5}
              width={iconSize + 10}
              height={iconSize + 10}
              rx="9"
              fill={selected ? '#fbbf24' : fill}
              stroke="#f7fbff"
              strokeWidth={selected ? 5 : 3.5}
            />
            <TrainFront
              aria-hidden="true"
              x={train.point.x - iconSize / 2}
              y={centerY - iconSize / 2}
              width={iconSize}
              height={iconSize}
              stroke="#071923"
              strokeWidth="2.4"
            />
            <text x={train.point.x} y={centerY + iconSize / 2 + 17} fill="#f7fbff" textAnchor="middle" fontSize="12" fontWeight="900">{train.id}</text>
            {train.signalState === 'STOP' ? (
              <CircleStop
                aria-hidden="true"
                x={train.point.x + iconSize / 2 - 5}
                y={centerY - iconSize / 2 - 10}
                width="18"
                height="18"
                fill="#071923"
                stroke="#ff6b75"
                strokeWidth="2.8"
              />
            ) : null}
            <title>{`${train.id} · ${train.signalState} · ${train.phase}${station ? ` · ${station.name}` : ''}`}</title>
          </g>
        );
      })}
    </svg>
  );
}
