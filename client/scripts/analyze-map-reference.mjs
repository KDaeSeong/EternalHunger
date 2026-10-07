import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const { buildGuestSimulationMap } = await import('../src/app/simulation/_lib/guestSimulationBootstrap.js');
const { buildBaseZoneGraph, getHyperloopZoneIds } = await import('../src/app/simulation/_lib/mapGraphRuntime.js');
const { applyRegionDataToZones } = await import('../src/app/simulation/_lib/lumiaRegionData.js');
const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');

const args = process.argv.slice(2);
assert.ok(args.length <= 1 && args.every(arg => /^--output=.+$/.test(arg)));
const output = args[0]?.slice('--output='.length);
const map = buildGuestSimulationMap(), zones = applyRegionDataToZones(map.zones);
const graph = buildBaseZoneGraph(map, zones);
const connections = map.zoneConnections.map(connection => ({ ...connection }));
const pairs = new Set(connections.map(connection => [connection.fromZoneId, connection.toZoneId].sort().join(':')));
const report = {
  engineVersion: SIMULATION_ENGINE_VERSION, mapId: map._id, zoneCount: zones.length,
  connectionRecords: connections.length, uniqueUndirectedPairs: pairs.size, connections,
  directedRoadGraph: graph, effectiveHyperloopSources: getHyperloopZoneIds(map, zones),
  services: zones.map(zone => ({ zoneId: zone.zoneId, name: zone.name,
    hasHyperloop: zone.hasHyperloop ?? null, hasKiosk: zone.hasKiosk ?? null })),
  scope: 'current built-in simulation graph and devices; external patch-note comparison is documented separately, not a complete live-game topology certification',
};
if (output) writeFileSync(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
