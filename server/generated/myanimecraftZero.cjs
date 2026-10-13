"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// zero-server-entry.ts
var zero_server_entry_exports = {};
__export(zero_server_entry_exports, {
  engineVersion: () => ZERO_ENGINE_VERSION,
  simulate: () => simulateZeroMatch
});
module.exports = __toCommonJS(zero_server_entry_exports);

// src/core/sim/matchup.ts
function matchupOf(a, b) {
  if (a === "T" && b === "Z") return "TvZ";
  if (a === "T" && b === "P") return "TvP";
  if (a === "Z" && b === "P") return "ZvP";
  if (a === "Z" && b === "T") return "TvZ";
  if (a === "P" && b === "T") return "TvP";
  if (a === "P" && b === "Z") return "ZvP";
  if (a === "T" && b === "T") return "TvT";
  if (a === "Z" && b === "Z") return "ZvZ";
  return "PvP";
}
function signedMatchupBias(a, b, matchup, raw) {
  if (matchup === "TvZ") {
    if (a === "T" && b === "Z") return raw;
    if (a === "Z" && b === "T") return -raw;
  }
  if (matchup === "TvP") {
    if (a === "T" && b === "P") return raw;
    if (a === "P" && b === "T") return -raw;
  }
  if (matchup === "ZvP") {
    if (a === "Z" && b === "P") return raw;
    if (a === "P" && b === "Z") return -raw;
  }
  return 0;
}

// src/core/sim/rng/rng.ts
function hashStringToSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  return function() {
    let t = seed += 1831565813;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function createRng(seedStr) {
  const seed = hashStringToSeed(seedStr);
  const next = mulberry32(seed);
  const int = (min, maxInclusive) => {
    const r = next();
    const span = maxInclusive - min + 1;
    return min + Math.floor(r * span);
  };
  const pick = (arr) => {
    if (arr.length === 0) throw new Error("pick: empty array");
    return arr[int(0, arr.length - 1)];
  };
  const gaussian = (mean = 0, std = 1) => {
    let u = 0;
    let v = 0;
    while (u === 0) u = next();
    while (v === 0) v = next();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return mean + z * std;
  };
  return { next, int, pick, gaussian };
}

// src/core/sim/playerStats.ts
var STAT_KEYS = [
  "attack",
  "defense",
  "strategy",
  "sense",
  "macro",
  "scout",
  "control",
  "harass"
];
function playerForSimulation(player) {
  const encoding = player.statEncoding;
  if (encoding?.type !== "legacy-additive-offset" || encoding.offset !== 816) return player;
  const stats = { ...player.stats };
  for (const key of STAT_KEYS) stats[key] -= encoding.offset;
  const { statEncoding: _consumedEncoding, ...withoutEncoding } = player;
  return { ...withoutEncoding, stats };
}

// src/core/zero/types.ts
var ZERO_ENGINE_ID = "ZERO";
var ZERO_ENGINE_VERSION = "0.10.0";
var ZERO_RANDOM_VERSION = "0.8.0";

// src/core/zero/unitCatalog.ts
var ZERO_UNIT_CATALOG = [
  {
    id: "terran-scv",
    race: "T",
    name: "SCV",
    shortName: "SCV",
    role: "worker",
    domain: "ground",
    attackDomains: ["ground"],
    armorClass: "light",
    biological: false,
    tier: 1,
    minerals: 50,
    gas: 0,
    buildTimeSec: 20,
    power: 3,
    durability: 8,
    speed: 5,
    range: 1,
    traits: ["\uCC44\uCDE8", "\uC218\uB9AC", "\uAC74\uC124"]
  },
  {
    id: "terran-marine",
    race: "T",
    name: "\uB9C8\uB9B0",
    shortName: "\uB9C8\uB9B0",
    role: "ranged",
    domain: "ground",
    attackDomains: ["ground", "air"],
    armorClass: "light",
    biological: true,
    tier: 1,
    minerals: 50,
    gas: 0,
    buildTimeSec: 18,
    power: 7.5,
    durability: 7.25,
    speed: 6,
    range: 5,
    traits: ["\uC9C0\uC0C1 \uACF5\uACA9", "\uB300\uACF5", "\uBCF4\uBCD1"]
  },
  {
    id: "terran-medic",
    race: "T",
    name: "\uBA54\uB515",
    shortName: "\uBA54\uB515",
    role: "support",
    domain: "ground",
    attackDomains: [],
    armorClass: "light",
    biological: true,
    tier: 1,
    minerals: 50,
    gas: 25,
    buildTimeSec: 24,
    power: 3,
    durability: 9,
    speed: 6,
    range: 2,
    traits: ["\uCE58\uB8CC", "\uBCF4\uBCD1 \uC9C0\uC6D0"]
  },
  {
    id: "terran-vulture",
    race: "T",
    name: "\uBC8C\uCC98",
    shortName: "\uBC8C\uCC98",
    role: "ranged",
    domain: "ground",
    attackDomains: ["ground"],
    armorClass: "armored",
    biological: false,
    tier: 2,
    minerals: 75,
    gas: 0,
    buildTimeSec: 25,
    power: 11,
    durability: 9,
    speed: 10,
    range: 5,
    traits: ["\uACE0\uC18D", "\uACAC\uC81C", "\uC9C0\uB8B0"]
  },
  {
    id: "terran-siege-tank",
    race: "T",
    name: "\uC2DC\uC988 \uD0F1\uD06C",
    shortName: "\uD0F1\uD06C",
    role: "siege",
    domain: "ground",
    attackDomains: ["ground"],
    armorClass: "armored",
    biological: false,
    tier: 2,
    minerals: 150,
    gas: 100,
    buildTimeSec: 38,
    power: 25,
    durability: 22,
    speed: 4,
    range: 10,
    traits: ["\uACF5\uC131", "\uAD11\uC5ED \uACF5\uACA9", "\uC9C4\uC9C0 \uAD6C\uCD95"]
  },
  {
    id: "terran-wraith",
    stealth: "energy",
    race: "T",
    name: "\uB808\uC774\uC2A4",
    shortName: "\uB808\uC774\uC2A4",
    role: "air",
    domain: "air",
    attackDomains: ["ground", "air"],
    armorClass: "armored",
    biological: false,
    tier: 3,
    minerals: 150,
    gas: 100,
    buildTimeSec: 42,
    power: 22,
    durability: 15,
    speed: 9,
    range: 6,
    traits: ["\uACF5\uC911", "\uC740\uD3D0", "\uAE30\uC2B5"]
  },
  {
    id: "zerg-drone",
    race: "Z",
    name: "\uB4DC\uB860",
    shortName: "\uB4DC\uB860",
    role: "worker",
    domain: "ground",
    attackDomains: ["ground"],
    armorClass: "light",
    biological: true,
    tier: 1,
    minerals: 50,
    gas: 0,
    buildTimeSec: 18,
    power: 3,
    durability: 7,
    speed: 6,
    range: 1,
    traits: ["\uCC44\uCDE8", "\uBCC0\uD0DC", "\uAC74\uC124"]
  },
  {
    id: "zerg-zergling",
    race: "Z",
    name: "\uC800\uAE00\uB9C1",
    shortName: "\uC800\uAE00\uB9C1",
    role: "melee",
    domain: "ground",
    attackDomains: ["ground"],
    armorClass: "light",
    biological: true,
    tier: 1,
    minerals: 25,
    gas: 0,
    buildTimeSec: 12,
    power: 4.04,
    durability: 4.2,
    speed: 9,
    range: 1,
    traits: ["\uAD70\uC9D1", "\uACE0\uC18D", "\uD3EC\uC704"]
  },
  {
    id: "zerg-hydralisk",
    race: "Z",
    name: "\uD788\uB4DC\uB77C\uB9AC\uC2A4\uD06C",
    shortName: "\uD788\uB4DC\uB77C",
    role: "ranged",
    domain: "ground",
    attackDomains: ["ground", "air"],
    armorClass: "light",
    biological: true,
    tier: 1,
    minerals: 75,
    gas: 25,
    buildTimeSec: 22,
    power: 11,
    durability: 9,
    speed: 6,
    range: 5,
    traits: ["\uC9C0\uC0C1 \uACF5\uACA9", "\uB300\uACF5", "\uAD70\uC9D1"]
  },
  {
    id: "zerg-lurker",
    stealth: "burrow",
    race: "Z",
    name: "\uB7EC\uCEE4",
    shortName: "\uB7EC\uCEE4",
    role: "siege",
    domain: "ground",
    attackDomains: ["ground"],
    armorClass: "armored",
    biological: true,
    tier: 2,
    minerals: 125,
    gas: 125,
    buildTimeSec: 35,
    power: 24,
    durability: 16,
    speed: 4,
    range: 7,
    traits: ["\uC7A0\uBCF5", "\uAD11\uC5ED \uACF5\uACA9", "\uB9E4\uBCF5"]
  },
  {
    id: "zerg-mutalisk",
    race: "Z",
    name: "\uBBA4\uD0C8\uB9AC\uC2A4\uD06C",
    shortName: "\uBBA4\uD0C8",
    role: "air",
    domain: "air",
    attackDomains: ["ground", "air"],
    armorClass: "light",
    biological: true,
    tier: 2,
    minerals: 100,
    gas: 100,
    buildTimeSec: 30,
    power: 17,
    durability: 12,
    speed: 10,
    range: 4,
    traits: ["\uACF5\uC911", "\uACAC\uC81C", "\uB3C4\uD0C4 \uACF5\uACA9"]
  },
  {
    id: "zerg-ultralisk",
    race: "Z",
    name: "\uC6B8\uD2B8\uB77C\uB9AC\uC2A4\uD06C",
    shortName: "\uC6B8\uD2B8\uB77C",
    role: "melee",
    domain: "ground",
    attackDomains: ["ground"],
    armorClass: "armored",
    biological: true,
    tier: 3,
    minerals: 200,
    gas: 200,
    buildTimeSec: 48,
    power: 34,
    durability: 36,
    speed: 6,
    range: 1,
    traits: ["\uC911\uC7A5\uAC11", "\uB3CC\uD30C", "\uAD11\uC5ED \uACF5\uACA9"]
  },
  {
    id: "protoss-probe",
    race: "P",
    name: "\uD504\uB85C\uBE0C",
    shortName: "\uD504\uB85C\uBE0C",
    role: "worker",
    domain: "ground",
    attackDomains: ["ground"],
    armorClass: "light",
    biological: false,
    tier: 1,
    minerals: 50,
    gas: 0,
    buildTimeSec: 20,
    power: 3,
    durability: 8,
    speed: 6,
    range: 1,
    traits: ["\uCC44\uCDE8", "\uC18C\uD658", "\uBCF4\uD638\uB9C9"]
  },
  {
    id: "protoss-zealot",
    race: "P",
    name: "\uC9C8\uB7FF",
    shortName: "\uC9C8\uB7FF",
    role: "melee",
    domain: "ground",
    attackDomains: ["ground"],
    armorClass: "armored",
    biological: true,
    tier: 1,
    minerals: 100,
    gas: 0,
    buildTimeSec: 28,
    power: 15,
    durability: 22.5,
    speed: 7,
    range: 1,
    traits: ["\uB3CC\uD30C", "\uBCF4\uD638\uB9C9", "\uADFC\uC811"]
  },
  {
    id: "protoss-dragoon",
    race: "P",
    name: "\uB4DC\uB77C\uAD70",
    shortName: "\uB4DC\uB77C\uAD70",
    role: "ranged",
    domain: "ground",
    attackDomains: ["ground", "air"],
    armorClass: "armored",
    biological: false,
    tier: 1,
    minerals: 125,
    gas: 50,
    buildTimeSec: 32,
    power: 18,
    durability: 18,
    speed: 5,
    range: 6,
    traits: ["\uC9C0\uC0C1 \uACF5\uACA9", "\uB300\uACF5", "\uBCF4\uD638\uB9C9"]
  },
  {
    id: "protoss-high-templar",
    weaponPower: 0,
    abilities: ["storm"],
    race: "P",
    name: "\uD558\uC774 \uD15C\uD50C\uB7EC",
    shortName: "\uD15C\uD50C\uB7EC",
    role: "caster",
    domain: "ground",
    attackDomains: ["ground", "air"],
    armorClass: "light",
    biological: true,
    tier: 2,
    minerals: 50,
    gas: 150,
    buildTimeSec: 40,
    power: 23,
    durability: 8,
    speed: 4,
    range: 8,
    traits: ["\uC0AC\uC774\uC624\uB2C9 \uD3ED\uD48D", "\uC9C0\uC6D0", "\uAD11\uC5ED \uACF5\uACA9"]
  },
  {
    id: "protoss-reaver",
    race: "P",
    name: "\uB9AC\uBC84",
    shortName: "\uB9AC\uBC84",
    role: "siege",
    domain: "ground",
    attackDomains: ["ground"],
    armorClass: "armored",
    biological: false,
    tier: 2,
    minerals: 200,
    gas: 100,
    buildTimeSec: 48,
    power: 31,
    durability: 24,
    speed: 2,
    range: 9,
    traits: ["\uACF5\uC131", "\uAD11\uC5ED \uACF5\uACA9", "\uC218\uC1A1 \uC758\uC874"]
  },
  {
    id: "protoss-carrier",
    race: "P",
    name: "\uCE90\uB9AC\uC5B4",
    shortName: "\uCE90\uB9AC\uC5B4",
    role: "air",
    domain: "air",
    attackDomains: ["ground", "air"],
    armorClass: "armored",
    biological: false,
    tier: 3,
    minerals: 350,
    gas: 250,
    buildTimeSec: 70,
    power: 45,
    durability: 40,
    speed: 5,
    range: 9,
    traits: ["\uACF5\uC911", "\uC7A5\uAC70\uB9AC", "\uD568\uC7AC\uAE30"]
  },
  { "id": "terran-firebat", "race": "T", "name": "\uD30C\uC774\uC5B4\uBC43", "shortName": "\uD30C\uBC43", "role": "melee", "domain": "ground", "attackDomains": ["ground"], "armorClass": "light", "biological": true, "tier": 1, "minerals": 50, "gas": 25, "buildTimeSec": 24, "power": 10, "durability": 10, "speed": 6, "range": 1, "splash": true, "traits": ["\uADFC\uC811 \uAD11\uC5ED"] },
  { "id": "terran-ghost", "race": "T", "name": "\uACE0\uC2A4\uD2B8", "shortName": "\uACE0\uC2A4\uD2B8", "role": "ranged", "domain": "ground", "attackDomains": ["ground", "air"], "armorClass": "light", "biological": true, "tier": 3, "minerals": 25, "gas": 75, "buildTimeSec": 40, "power": 9, "durability": 7, "speed": 6, "range": 7, "abilities": ["lockdown"], "stealth": "energy", "traits": ["\uAE30\uACC4 \uBB34\uB825\uD654"] },
  { "id": "terran-goliath", "race": "T", "name": "\uACE8\uB9AC\uC557", "shortName": "\uACE8\uB9AC\uC557", "role": "ranged", "domain": "ground", "attackDomains": ["ground", "air"], "armorClass": "armored", "biological": false, "tier": 2, "minerals": 100, "gas": 50, "buildTimeSec": 32, "power": 17, "durability": 16, "speed": 5, "range": 8, "traits": ["\uC9C0\uB300\uACF5"] },
  { "id": "terran-science-vessel", "race": "T", "name": "\uC0AC\uC774\uC5B8\uC2A4 \uBCA0\uC2AC", "shortName": "\uBCA0\uC2AC", "role": "detector", "domain": "air", "attackDomains": ["ground", "air"], "armorClass": "armored", "biological": false, "tier": 2, "minerals": 100, "gas": 225, "buildTimeSec": 50, "power": 15, "durability": 20, "speed": 6, "range": 9, "weaponPower": 0, "detectorRange": 0.22, "abilities": ["irradiate", "matrix"], "traits": ["\uD0D0\uC9C0\xB7\uC0DD\uCCB4 \uACAC\uC81C\xB7\uBCF4\uD638"] },
  { "id": "terran-valkyrie", "race": "T", "name": "\uBC1C\uD0A4\uB9AC", "shortName": "\uBC1C\uD0A4\uB9AC", "role": "air", "domain": "air", "attackDomains": ["air"], "armorClass": "armored", "biological": false, "tier": 2, "minerals": 250, "gas": 125, "buildTimeSec": 50, "power": 30, "durability": 25, "speed": 7, "range": 6, "splash": true, "traits": ["\uACF5\uC911 \uAD11\uC5ED \uC694\uACA9"] },
  { "id": "terran-battlecruiser", "race": "T", "name": "\uBC30\uD2C0\uD06C\uB8E8\uC800", "shortName": "\uBC30\uD2C0", "role": "air", "domain": "air", "attackDomains": ["ground", "air"], "armorClass": "armored", "biological": false, "tier": 3, "minerals": 400, "gas": 300, "buildTimeSec": 80, "power": 44, "durability": 50, "speed": 3, "range": 6, "abilities": ["yamato"], "traits": ["\uC911\uC7A5\uAC11\xB7\uC9D1\uC911 \uD3EC\uACA9"] },
  { "id": "zerg-overlord", "race": "Z", "name": "\uC624\uBC84\uB85C\uB4DC", "shortName": "\uC624\uBC84", "role": "detector", "domain": "air", "attackDomains": [], "armorClass": "armored", "biological": true, "tier": 1, "minerals": 100, "gas": 0, "buildTimeSec": 40, "power": 0, "durability": 20, "speed": 3, "range": 0, "detectorRange": 0.22, "transportCapacity": 8, "transportTech": 32, "traits": ["\uD0D0\uC9C0\xB7\uC815\uCC30\xB7\uAE30\uC220 32\uBD80\uD130 \uC218\uC1A1"] },
  { "id": "zerg-scourge", "race": "Z", "name": "\uC2A4\uCEE4\uC9C0", "shortName": "\uC2A4\uCEE4\uC9C0", "role": "air", "domain": "air", "attackDomains": ["air"], "armorClass": "light", "biological": true, "tier": 2, "minerals": 13, "gas": 38, "buildTimeSec": 20, "power": 22, "durability": 3, "speed": 10, "range": 1, "suicide": true, "traits": ["\uACF5\uC911 \uC790\uD3ED \uC694\uACA9"] },
  { "id": "zerg-queen", "race": "Z", "name": "\uD038", "shortName": "\uD038", "role": "caster", "domain": "air", "attackDomains": [], "armorClass": "armored", "biological": true, "tier": 2, "minerals": 100, "gas": 100, "buildTimeSec": 50, "power": 0, "durability": 12, "speed": 8, "range": 9, "abilities": ["ensnare"], "traits": ["\uC804\uD22C \uBC29\uD574"] },
  { "id": "zerg-defiler", "race": "Z", "name": "\uB514\uD30C\uC77C\uB7EC", "shortName": "\uB514\uD30C", "role": "caster", "domain": "ground", "attackDomains": [], "armorClass": "light", "biological": true, "tier": 3, "minerals": 50, "gas": 150, "buildTimeSec": 50, "power": 0, "durability": 10, "speed": 5, "range": 9, "abilities": ["dark-swarm"], "traits": ["\uC9C0\uC0C1 \uC6D0\uAC70\uB9AC \uC5C4\uD638"] },
  { "id": "zerg-guardian", "race": "Z", "name": "\uAC00\uB514\uC5B8", "shortName": "\uAC00\uB514\uC5B8", "role": "air", "domain": "air", "attackDomains": ["ground"], "armorClass": "armored", "biological": true, "tier": 3, "minerals": 150, "gas": 200, "buildTimeSec": 55, "power": 29, "durability": 18, "speed": 3, "range": 10, "traits": ["\uC9C0\uC0C1 \uC7A5\uAC70\uB9AC \uD3EC\uACA9"] },
  { "id": "zerg-devourer", "race": "Z", "name": "\uB514\uBC14\uC6B0\uB7EC", "shortName": "\uB514\uBC14", "role": "air", "domain": "air", "attackDomains": ["air"], "armorClass": "armored", "biological": true, "tier": 3, "minerals": 250, "gas": 150, "buildTimeSec": 55, "power": 34, "durability": 28, "speed": 6, "range": 7, "splash": true, "traits": ["\uC911\uC7A5\uAC11 \uACF5\uC911 \uC694\uACA9"] },
  { "id": "zerg-infested-terran", "race": "Z", "name": "\uC778\uD398\uC2A4\uD2F0\uB4DC \uD14C\uB780", "shortName": "\uAC10\uC5FC", "role": "melee", "domain": "ground", "attackDomains": ["ground"], "armorClass": "light", "biological": true, "tier": 3, "minerals": 100, "gas": 50, "buildTimeSec": 35, "power": 45, "durability": 6, "speed": 7, "range": 1, "suicide": true, "splash": true, "traits": ["\uC9C0\uC0C1 \uC790\uD3ED"] },
  { "id": "protoss-dark-templar", "race": "P", "name": "\uB2E4\uD06C \uD15C\uD50C\uB7EC", "shortName": "\uB2E4\uD15C", "role": "melee", "domain": "ground", "attackDomains": ["ground"], "armorClass": "light", "biological": true, "tier": 2, "minerals": 125, "gas": 100, "buildTimeSec": 40, "power": 27, "durability": 13, "speed": 7, "range": 1, "stealth": "permanent", "traits": ["\uC740\uD3D0 \uCE68\uD22C"] },
  { "id": "protoss-archon", "race": "P", "name": "\uC544\uCE78", "shortName": "\uC544\uCE78", "role": "ranged", "domain": "ground", "attackDomains": ["ground", "air"], "armorClass": "armored", "biological": false, "tier": 3, "minerals": 100, "gas": 300, "buildTimeSec": 55, "power": 35, "durability": 38, "speed": 6, "range": 3, "splash": true, "traits": ["\uADFC\uAC70\uB9AC \uAD11\uC5ED"] },
  { "id": "protoss-dark-archon", "race": "P", "name": "\uB2E4\uD06C \uC544\uCE78", "shortName": "\uB2E4\uCE78", "role": "caster", "domain": "ground", "attackDomains": [], "armorClass": "armored", "biological": false, "tier": 3, "minerals": 250, "gas": 200, "buildTimeSec": 55, "power": 0, "durability": 25, "speed": 6, "range": 9, "abilities": ["maelstrom"], "traits": ["\uC0DD\uCCB4 \uBB34\uB825\uD654"] },
  { "id": "protoss-scout", "race": "P", "name": "\uC2A4\uCE74\uC6B0\uD2B8", "shortName": "\uC2A4\uCE74\uC6C3", "role": "air", "domain": "air", "attackDomains": ["ground", "air"], "armorClass": "armored", "biological": false, "tier": 2, "minerals": 275, "gas": 125, "buildTimeSec": 60, "power": 30, "durability": 28, "speed": 8, "range": 5, "traits": ["\uACF5\uC911 \uC804\uD22C"] },
  { "id": "protoss-corsair", "race": "P", "name": "\uCEE4\uC138\uC5B4", "shortName": "\uCEE4\uC138\uC5B4", "role": "air", "domain": "air", "attackDomains": ["air"], "armorClass": "armored", "biological": false, "tier": 2, "minerals": 150, "gas": 100, "buildTimeSec": 40, "power": 22, "durability": 18, "speed": 10, "range": 6, "splash": true, "abilities": ["web"], "traits": ["\uACF5\uC911 \uC694\uACA9\xB7\uC9C0\uC0C1 \uBC29\uD574"] },
  { "id": "protoss-arbiter", "race": "P", "name": "\uC544\uBE44\uD130", "shortName": "\uC544\uBE44\uD130", "role": "air", "domain": "air", "attackDomains": ["ground", "air"], "armorClass": "armored", "biological": false, "tier": 3, "minerals": 100, "gas": 350, "buildTimeSec": 80, "power": 10, "durability": 25, "speed": 5, "range": 7, "abilities": ["stasis"], "traits": ["\uC804\uC7A5 \uACA9\uB9AC"] },
  { "id": "protoss-observer", "race": "P", "name": "\uC635\uC800\uBC84", "shortName": "\uC635\uC800\uBC84", "role": "detector", "domain": "air", "attackDomains": [], "armorClass": "light", "biological": false, "tier": 2, "minerals": 25, "gas": 75, "buildTimeSec": 35, "power": 0, "durability": 6, "speed": 6, "range": 0, "detectorRange": 0.22, "stealth": "permanent", "traits": ["\uC740\uD3D0 \uD0D0\uC9C0\xB7\uC815\uCC30"] },
  {
    id: "terran-dropship",
    race: "T",
    name: "\uB4DC\uB86D\uC2ED",
    shortName: "\uB4DC\uB86D\uC2ED",
    role: "transport",
    domain: "air",
    attackDomains: [],
    armorClass: "armored",
    biological: false,
    tier: 2,
    minerals: 100,
    gas: 100,
    buildTimeSec: 50,
    power: 0,
    durability: 20,
    speed: 7,
    range: 0,
    transportCapacity: 8,
    transportTech: 32,
    traits: ["\uC9C0\uC0C1 \uBCD1\uB825 \uC218\uC1A1"]
  },
  {
    id: "protoss-shuttle",
    race: "P",
    name: "\uC154\uD2C0",
    shortName: "\uC154\uD2C0",
    role: "transport",
    domain: "air",
    attackDomains: [],
    armorClass: "armored",
    biological: false,
    tier: 2,
    minerals: 200,
    gas: 0,
    buildTimeSec: 40,
    power: 0,
    durability: 19,
    speed: 8,
    range: 0,
    transportCapacity: 8,
    transportTech: 32,
    traits: ["\uC9C0\uC0C1 \uBCD1\uB825 \uC218\uC1A1"]
  }
];
var UNIT_BY_ID = new Map(
  ZERO_UNIT_CATALOG.map((unit) => [unit.id, unit])
);
function getZeroUnit(unitTypeId) {
  const unit = UNIT_BY_ID.get(unitTypeId);
  if (!unit) throw new Error(`\uC54C \uC218 \uC5C6\uB294 \uC81C\uB85C \uC5D4\uC9C4 \uC720\uB2DB: ${unitTypeId}`);
  return unit;
}
function listZeroUnitsForRace(race) {
  return ZERO_UNIT_CATALOG.filter((unit) => unit.race === race);
}
function getZeroWorkerForRace(race) {
  const worker = ZERO_UNIT_CATALOG.find((unit) => unit.race === race && unit.role === "worker");
  if (!worker) throw new Error(`\uC77C\uAFBC \uC815\uC758\uAC00 \uC5C6\uB294 \uC885\uC871: ${race}`);
  return worker;
}

// src/core/zero/navigation.ts
var EPS = 1e-8;
var zeroDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
var point = ({ x, y }) => ({ x, y });
function createZeroBattlefield(complexity) {
  const c = Math.max(0, Math.min(100, Number.isFinite(complexity) ? complexity : 50)) / 100;
  const upper = 0.34 - c * 0.16;
  const nodes = [
    { id: "home-base", x: 0.08, y: 0.5 },
    { id: "home-gate", x: 0.24, y: 0.5 },
    { id: "center", x: 0.5, y: 0.5 },
    { id: "away-gate", x: 0.76, y: 0.5 },
    { id: "away-base", x: 0.92, y: 0.5 },
    ...["upper", "lower"].flatMap((lane) => [
      { id: `${lane}-home`, x: 0.3, y: lane === "upper" ? upper : 1 - upper },
      { id: `${lane}-center`, x: 0.5, y: lane === "upper" ? upper : 1 - upper },
      { id: `${lane}-away`, x: 0.7, y: lane === "upper" ? upper : 1 - upper }
    ])
  ];
  const edges = [];
  const connect = (ids, lane, cost) => {
    for (let i = 1; i < ids.length; i++) edges.push({ id: `${lane}:${ids[i - 1]}:${ids[i]}`, from: ids[i - 1], to: ids[i], lane, cost });
  };
  connect(["home-base", "home-gate", "center", "away-gate", "away-base"], "main", 1);
  for (const lane of ["upper", "lower"]) connect(["home-gate", `${lane}-home`, `${lane}-center`, `${lane}-away`, "away-gate"], lane, 1);
  return { kind: "squad-lanes", nodes, edges };
}
function project(p, a, b) {
  const length2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  const t = length2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / length2)) : 0;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
var networks = /* @__PURE__ */ new WeakMap();
function network(field) {
  const existing = networks.get(field);
  if (existing) return existing;
  const nodes = new Map(field.nodes.map((n) => [n.id, point(n)]));
  if (nodes.size !== field.nodes.length) throw new Error("\uC911\uBCF5\uB41C \uC804\uC7A5 \uAC70\uC810 ID");
  const edges = field.edges.map((edge) => {
    const a = nodes.get(edge.from), b = nodes.get(edge.to);
    if (!a || !b || !Number.isFinite(edge.cost) || edge.cost <= 0) throw new Error("\uC798\uBABB\uB41C \uC804\uC7A5 \uC5F0\uACB0");
    return { ...edge, a, b, length: zeroDistance(a, b) };
  });
  const distances = new Map([...nodes.keys()].map((id) => [id, new Map([...nodes.keys()].map((other) => [other, id === other ? 0 : Infinity]))]));
  for (const edge of edges) {
    distances.get(edge.from).set(edge.to, Math.min(distances.get(edge.from).get(edge.to), edge.length));
    distances.get(edge.to).set(edge.from, Math.min(distances.get(edge.to).get(edge.from), edge.length));
  }
  for (const k of nodes.keys()) for (const i of nodes.keys()) for (const j of nodes.keys()) {
    distances.get(i).set(j, Math.min(distances.get(i).get(j), distances.get(i).get(k) + distances.get(k).get(j)));
  }
  const result = { nodes, edges, distances };
  networks.set(field, result);
  return result;
}
function attachments(net, p) {
  return net.edges.map((edge) => ({ edge, p: project(p, edge.a, edge.b) })).filter((entry) => zeroDistance(p, entry.p) <= 15e-5);
}
function isZeroGroundPoint(field, p) {
  return attachments(network(field), p).length > 0;
}
function zeroGroundDistance(field, from, to) {
  const net = network(field);
  const starts = attachments(net, from), ends = attachments(net, to);
  let best = Infinity;
  for (const start of starts) for (const end of ends) {
    if (start.edge.id === end.edge.id) best = Math.min(best, zeroDistance(from, to));
    for (const a of [start.edge.from, start.edge.to]) for (const b of [end.edge.from, end.edge.to]) {
      best = Math.min(best, zeroDistance(from, net.nodes.get(a)) + net.distances.get(a).get(b) + zeroDistance(net.nodes.get(b), to));
    }
  }
  return best;
}
function planZeroRoute(field, from, goal, domain, flank) {
  const net = network(field), destination = net.nodes.get(goal);
  if (!destination) throw new Error(`\uC874\uC7AC\uD558\uC9C0 \uC54A\uB294 \uC804\uC7A5 \uBAA9\uC801\uC9C0: ${goal}`);
  if (domain === "air") return [point(from), point(destination)];
  const starts = attachments(net, from);
  if (starts.length === 0) return [];
  const multiplier = (edge) => edge.cost * (flank && edge.lane !== flank ? 4 : 1);
  const costs = /* @__PURE__ */ new Map();
  const paths = /* @__PURE__ */ new Map();
  for (const { edge } of starts) for (const id of [edge.from, edge.to]) {
    const node = net.nodes.get(id);
    const cost = zeroDistance(from, node) * multiplier(edge);
    if (cost < (costs.get(id) ?? Infinity)) {
      costs.set(id, cost);
      paths.set(id, [point(from), point(node)]);
    }
  }
  const pending = new Set(net.nodes.keys());
  while (pending.size) {
    const id = [...pending].sort((a, b) => (costs.get(a) ?? Infinity) - (costs.get(b) ?? Infinity) || a.localeCompare(b))[0];
    if (!Number.isFinite(costs.get(id))) return [];
    if (id === goal) return paths.get(id);
    pending.delete(id);
    for (const edge of net.edges) {
      const other = edge.from === id ? edge.to : edge.to === id ? edge.from : void 0;
      if (!other || !pending.has(other)) continue;
      const cost = costs.get(id) + edge.length * multiplier(edge);
      if (cost < (costs.get(other) ?? Infinity) - EPS) {
        costs.set(other, cost);
        paths.set(other, [...paths.get(id), point(net.nodes.get(other))]);
      }
    }
  }
  return [];
}
function travelZeroRoute(route, budget) {
  if (!route.length) return { points: [], distance: 0 };
  let remaining = Math.max(0, Number.isFinite(budget) ? budget : 0), distance2 = 0;
  const points = [point(route[0])];
  for (let i = 1; i < route.length && remaining > EPS; i++) {
    const from = points.at(-1), to = route[i], length = zeroDistance(from, to);
    if (length <= EPS) continue;
    const used = Math.min(remaining, length), t = used / length;
    points.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
    remaining -= used;
    distance2 += used;
  }
  return { points, distance: distance2 };
}
function zeroSquadDistance(field, a, b) {
  return getZeroUnit(a.unitTypeId).domain === "air" || getZeroUnit(b.unitTypeId).domain === "air" ? zeroDistance(a, b) : zeroGroundDistance(field, a, b);
}
function zeroEngagementRange(squad) {
  return 0.075 + getZeroUnit(squad.unitTypeId).range * 4e-3;
}
function zeroMovementBudget(squad, rushDistance) {
  return (0.085 + getZeroUnit(squad.unitTypeId).speed * 8e-3) / (0.8 + Math.max(0, Math.min(100, rushDistance)) / 125);
}
function zeroRouteGoal(side, intent) {
  if (intent === "retreat" || intent === "defend") return `${side}-gate`;
  return `${side === "home" ? "away" : "home"}-${intent === "scout" ? "gate" : "base"}`;
}

// src/core/zero/transport.ts
var CARGO_SLOTS = {
  "terran-vulture": 2,
  "terran-goliath": 2,
  "terran-siege-tank": 4,
  "zerg-hydralisk": 2,
  "zerg-lurker": 4,
  "zerg-ultralisk": 4,
  "zerg-defiler": 2,
  "protoss-zealot": 2,
  "protoss-dragoon": 4,
  "protoss-high-templar": 2,
  "protoss-dark-templar": 2,
  "protoss-reaver": 4,
  "protoss-archon": 4,
  "protoss-dark-archon": 4
};
var zeroCargoSlots = (type) => getZeroUnit(type).domain === "ground" ? CARGO_SLOTS[type] ?? 1 : 0;
var zeroDeployed = (squad) => squad.count > 0 && squad.health > 0 && !squad.embarkedOn;
var cloneZeroSquad = (squad) => ({
  ...squad,
  ...squad.transportMission ? { transportMission: {
    ...squad.transportMission,
    ...squad.transportMission.plan ? { plan: { ...squad.transportMission.plan, reasons: [...squad.transportMission.plan.reasons] } } : {}
  } } : {}
});
var pathLength = (points) => points.slice(1).reduce((sum, p, i) => sum + zeroDistance(points[i], p), 0);
function routeDistance(p, route) {
  let best = Infinity;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i], dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / Math.max(1e-9, dx * dx + dy * dy)));
    best = Math.min(best, zeroDistance(p, { x: a.x + t * dx, y: a.y + t * dy }));
  }
  return best;
}
var troopValue = (s) => (getZeroUnit(s.unitTypeId).power + getZeroUnit(s.unitTypeId).durability * 0.45) * s.health;
function transportRouteRisk(route, intelligence) {
  return intelligence.observations.filter((o) => o.confidence > 0.15 && o.health > 0 && o.count > 0).reduce((sum, o) => {
    const unit = getZeroUnit(o.unitTypeId), weapon = unit.weaponPower ?? unit.power;
    if (!unit.attackDomains.includes("air") || weapon <= 0) return sum;
    const exposure = Math.max(0, 1 - routeDistance(o, route) / (zeroEngagementRange(o) + 0.08));
    return sum + exposure * weapon * o.count * o.health * o.confidence * 0.5;
  }, 0);
}
function planZeroTransportMission(squads, carrier, field, context, requestedId, boardingNow = false) {
  if (!zeroDeployed(carrier) || carrier.count !== 1 || !getZeroUnit(carrier.unitTypeId).transportCapacity || !Number.isFinite(context.remainingIntervals) || context.remainingIntervals <= 0) return { reasons: ["\uC218\uC1A1\uC120 \uB610\uB294 \uB0A8\uC740 \uC784\uBB34 \uC2DC\uAC04 \uBD80\uC871"] };
  const own = squads.filter((s) => s.side === carrier.side && s.count > 0 && s.health > 0);
  const candidates = zeroTransportCandidates(own, carrier.id);
  if (!requestedId) {
    const assessed = candidates.map((s) => planZeroTransportMission(own, carrier, field, context, s.id, boardingNow));
    const viable = assessed.filter((a) => a.plan).sort((a, b) => b.score - a.score || a.plan.pickupId.localeCompare(b.plan.pickupId));
    return viable[0] ?? { reasons: [...new Set(assessed.flatMap((a) => a.reasons)), ...candidates.length ? [] : ["\uD0D1\uC2B9\uD560 \uC790\uAE30 \uC9C0\uC0C1 \uBCD1\uB825\uC774 \uC5C6\uC74C"]] };
  }
  const target = candidates.find((s) => s.id === requestedId);
  if (!target || !zeroCargoSlots(target.unitTypeId)) return { reasons: ["\uD0D1\uC2B9\uD560 \uC790\uAE30 \uC9C0\uC0C1 \uBCD1\uB825\uC774 \uC5C6\uC74C"] };
  const total = own.filter((s) => getZeroUnit(s.unitTypeId).domain === "ground" && getZeroUnit(s.unitTypeId).role !== "worker").reduce((sum, s) => sum + s.count * troopValue(s), 0);
  const reserved = own.filter((s) => s.embarkedOn).reduce((sum, s) => sum + s.count * troopValue(s), 0) + own.filter((s) => s.id !== carrier.id && s.transportMission?.stage === "pickup").reduce((sum, s) => {
    const p = own.find((t) => t.id === s.transportMission?.pickupId);
    return sum + (p ? (s.transportMission?.plan?.cargoCount ?? p.count) * troopValue(p) : 0);
  }, 0);
  const count = Math.min(
    target.count,
    Math.floor((getZeroUnit(carrier.unitTypeId).transportCapacity ?? 0) / zeroCargoSlots(target.unitTypeId)),
    Math.floor(Math.max(0, total * 0.4 - reserved) / Math.max(1e-3, troopValue(target)))
  );
  if (count < 1) return { reasons: ["\uC218\uC1A1 \uD3B8\uC131 \uD6C4 \uC9C0\uC0C1 \uC8FC\uB825 60% \uC720\uC9C0 \uBD88\uAC00"] };
  const homeGate = field.nodes.find((n) => n.id === `${carrier.side}-gate`), other = carrier.side === "home" ? "away" : "home";
  const enemyBase = field.nodes.find((n) => n.id === `${other}-base`);
  const shipBudget = zeroMovementBudget(carrier, context.rushDistance), groundBudget = zeroMovementBudget(target, context.rushDistance);
  const rendezvous = boardingNow && zeroDistance(carrier, homeGate) < 1e-7 && zeroDistance(target, homeGate) < 1e-7 ? 0 : Math.max(1, Math.ceil(Math.max(zeroDistance(carrier, homeGate) / shipBudget, zeroGroundDistance(field, target, homeGate) / groundBudget) - 1e-8));
  const groundRoute = planZeroRoute(field, target, enemyBase.id, "ground");
  const walkIntervals = Math.ceil(pathLength(groundRoute) / groundBudget - 1e-8);
  const threats = context.intelligence.observations.filter((o) => o.confidence > 0.15 && o.health > 0 && o.count > 0);
  const blockedGround = threats.reduce((sum, o) => {
    const unit = getZeroUnit(o.unitTypeId);
    return sum + (unit.domain === "ground" && routeDistance(o, groundRoute) < 0.14 ? o.count * troopValue({ ...target, unitTypeId: o.unitTypeId, health: o.health }) * o.confidence : 0);
  }, 0);
  const alternatives = [];
  for (const dropGoal of [enemyBase.id, `upper-${other}`, `lower-${other}`]) {
    const drop = field.nodes.find((n) => n.id === dropGoal);
    for (const via of [void 0, "upper-center", "lower-center"]) {
      const route = [homeGate, ...via ? [field.nodes.find((n) => n.id === via)] : [], drop];
      const flight = Math.ceil(pathLength(route) / shipBudget - 1e-8);
      const approach = Math.ceil(Math.max(0, zeroGroundDistance(field, drop, enemyBase) - zeroEngagementRange(target)) / groundBudget - 1e-8);
      const expectedIntervals = rendezvous + flight + approach + 1;
      if (!Number.isFinite(expectedIntervals) || expectedIntervals > context.remainingIntervals) continue;
      const knownAntiAirRisk = transportRouteRisk(route, context.intelligence);
      if (knownAntiAirRisk > getZeroUnit(carrier.unitTypeId).durability * carrier.health * 0.8) continue;
      const bypass = Math.min(5, blockedGround / Math.max(1, count * troopValue(target)) * 3);
      const advantage = walkIntervals - expectedIntervals + bypass;
      if (advantage < -1) continue;
      const plan = {
        pickupId: target.id,
        cargoCount: count,
        dropGoal,
        ...via ? { via } : {},
        expectedIntervals,
        remainingIntervals: context.remainingIntervals,
        knownAntiAirRisk,
        committedArmyShare: (reserved + count * troopValue(target)) / Math.max(1, total),
        reasons: [
          `\uC608\uC0C1 ${expectedIntervals}\uAD6C\uAC04 / \uB0A8\uC740 ${context.remainingIntervals}\uAD6C\uAC04`,
          `\uC218\uC1A1 \uD3B8\uC131 ${count}\uAE30 / \uC9C0\uC0C1 \uC8FC\uB825 60% \uC774\uC0C1 \uC720\uC9C0`,
          `\uD558\uCC28 ${dropGoal}${via ? ` / \uC6B0\uD68C ${via}` : " / \uC9C1\uD589"}`,
          `\uAE30\uC5B5\uB41C \uB300\uACF5 \uC704\uD5D8 ${knownAntiAirRisk.toFixed(2)} (\uBBF8\uAD00\uCE21 \uC801 \uC548\uC804 \uBCF4\uC7A5 \uC544\uB2D8)`,
          `\uB3C4\uBCF4 ${walkIntervals}\uAD6C\uAC04 / \uAD00\uCE21 \uC804\uC120 \uC6B0\uD68C \uAC00\uCE58 ${bypass.toFixed(2)}`
        ]
      };
      alternatives.push({ plan, score: advantage * 2 - knownAntiAirRisk - expectedIntervals * 0.15 });
    }
  }
  alternatives.sort((a, b) => b.score - a.score || (a.plan.via ?? "").localeCompare(b.plan.via ?? "") || a.plan.dropGoal.localeCompare(b.plan.dropGoal));
  return alternatives.length ? { plan: alternatives[0].plan, reasons: alternatives[0].plan.reasons, score: alternatives[0].score } : { reasons: ["\uB0A8\uC740 \uC2DC\uAC04\xB7\uAD00\uCE21 \uB300\uACF5 \uC704\uD5D8\xB7\uB3C4\uBCF4 \uB300\uBE44 \uC6B4\uC6A9 \uAC00\uCE58\uC5D0 \uB9DE\uB294 \uC218\uC1A1 \uACBD\uB85C \uC5C6\uC74C"] };
}
function zeroTransportCandidates(squads, carrierId) {
  const reserved = new Set(squads.filter((s) => s.id !== carrierId).map((s) => s.transportMission?.pickupId).filter(Boolean));
  return squads.filter((squad) => zeroDeployed(squad) && !reserved.has(squad.id) && squad.status !== "retreating" && getZeroUnit(squad.unitTypeId).domain === "ground" && getZeroUnit(squad.unitTypeId).role !== "worker" && (squad.side === "home" ? squad.x : 1 - squad.x) <= 0.5).sort((a, b) => {
    const value = (s) => Math.min(s.count, Math.floor(8 / zeroCargoSlots(s.unitTypeId))) * (getZeroUnit(s.unitTypeId).power + 4) / Math.max(2, getZeroUnit(s.unitTypeId).speed);
    return value(b) - value(a) || a.id.localeCompare(b.id);
  });
}
function zeroTransportCandidate(squads, carrierId) {
  return zeroTransportCandidates(squads, carrierId)[0];
}
function reviewTransportFlight(carrier, cargo, field, context) {
  const mission = carrier.transportMission;
  const other = carrier.side === "home" ? "away" : "home", enemyBase = field.nodes.find((n) => n.id === `${other}-base`);
  const assess = (goal, via) => {
    const drop = field.nodes.find((n) => n.id === goal);
    const route = [carrier, ...via ? [field.nodes.find((n) => n.id === via)] : [], drop];
    const expectedIntervals = Math.ceil(pathLength(route) / zeroMovementBudget(carrier, context.rushDistance) - 1e-8) + Math.max(...cargo.map((s) => Math.ceil(Math.max(0, zeroGroundDistance(field, drop, enemyBase) - zeroEngagementRange(s)) / zeroMovementBudget(s, context.rushDistance) - 1e-8))) + 1;
    const risk = transportRouteRisk(route, context.intelligence);
    return { goal, via, expectedIntervals, risk, viable: expectedIntervals <= context.remainingIntervals && risk <= getZeroUnit(carrier.unitTypeId).durability * carrier.health * 0.8 };
  };
  const current = assess(mission.goal, mission.via);
  if (current.viable) return;
  const viable = [enemyBase.id, `upper-${other}`, `lower-${other}`].flatMap((goal) => [void 0, "upper-center", "lower-center"].map((via) => assess(goal, via))).filter((a) => a.viable).sort((a, b) => a.expectedIntervals - b.expectedIntervals || a.risk - b.risk || a.goal.localeCompare(b.goal) || (a.via ?? "").localeCompare(b.via ?? ""));
  const next = viable[0];
  const reasons = next ? [
    `\uBE44\uD589 \uC911 \uAD00\uCE21 \uAE30\uC5B5 \uC7AC\uD3C9\uAC00: \uC608\uC0C1 ${next.expectedIntervals}\uAD6C\uAC04 / \uB0A8\uC740 ${context.remainingIntervals}\uAD6C\uAC04`,
    `\uB0A8\uC740 \uACBD\uB85C \uB300\uACF5 \uC704\uD5D8 ${current.risk.toFixed(2)} \u2192 ${next.risk.toFixed(2)}`
  ] : ["\uB0A8\uC740 \uC2DC\uAC04\xB7\uAD00\uCE21 \uB300\uACF5 \uC704\uD5D8\uC744 \uCDA9\uC871\uD558\uB294 \uD558\uCC28 \uACBD\uB85C\uAC00 \uC5C6\uC5B4 \uADC0\uD658"];
  if (!next) {
    carrier.transportMission = { stage: "return", goal: `${carrier.side}-gate` };
    return { operation: "return", carrierId: carrier.id, goal: `${carrier.side}-gate`, reasons };
  }
  carrier.transportMission = {
    ...mission,
    goal: next.goal,
    via: next.via,
    ...mission.plan ? { plan: {
      ...mission.plan,
      dropGoal: next.goal,
      via: next.via,
      expectedIntervals: next.expectedIntervals,
      remainingIntervals: context.remainingIntervals,
      knownAntiAirRisk: next.risk,
      reasons
    } } : {}
  };
  if (!next.via) {
    delete carrier.transportMission.via;
    if (carrier.transportMission.plan) delete carrier.transportMission.plan.via;
  }
  return { operation: "reroute", carrierId: carrier.id, goal: next.goal, reasons };
}
function settleZeroTransport(source, field, action, tech, harassSkill, nextId, context) {
  const squads = source.map(cloneZeroSquad), records = [];
  const carriers = squads.filter((s) => zeroDeployed(s) && s.count === 1 && getZeroUnit(s.unitTypeId).transportCapacity && tech >= (getZeroUnit(s.unitTypeId).transportTech ?? 32));
  for (const carrier of carriers) {
    const homeGate = `${carrier.side}-gate`, awayBase = `${carrier.side === "home" ? "away" : "home"}-base`;
    const cargo = squads.filter((s) => s.embarkedOn === carrier.id && s.count > 0);
    let mission = carrier.transportMission;
    if (mission?.stage === "pickup" && (action === "defend" || !squads.some((s) => s.id === mission.pickupId && zeroDeployed(s)))) {
      delete carrier.transportMission;
      records.push({ operation: "cancel", carrierId: carrier.id, goal: homeGate });
      continue;
    }
    if (mission?.stage === "outbound" && (action === "defend" || carrier.status === "retreating")) {
      mission = carrier.transportMission = { stage: "return", goal: homeGate };
      records.push({ operation: "return", carrierId: carrier.id, goal: homeGate });
    }
    if (mission) {
      const destination = field.nodes.find((node) => node.id === mission.goal);
      if (!destination || zeroDistance(carrier, destination) > 1e-7) {
        if (mission.stage === "outbound" && context && cargo.length) {
          const review = reviewTransportFlight(carrier, cargo, field, context);
          if (review) records.push(review);
        }
        continue;
      }
      if (mission.stage === "pickup") {
        const target2 = squads.find((s) => s.id === mission.pickupId && s.side === carrier.side && zeroDeployed(s));
        if (!target2 || zeroDistance(carrier, target2) > 1e-7 || !isZeroGroundPoint(field, target2)) continue;
        const slots = zeroCargoSlots(target2.unitTypeId), capacity = getZeroUnit(carrier.unitTypeId).transportCapacity;
        if (!slots || getZeroUnit(target2.unitTypeId).role === "worker") continue;
        const assessment2 = context ? planZeroTransportMission(squads, carrier, field, context, target2.id, true) : void 0;
        if (assessment2 && !assessment2.plan) {
          delete carrier.transportMission;
          records.push({ operation: "cancel", carrierId: carrier.id, goal: homeGate, reasons: assessment2.reasons });
          continue;
        }
        const plan2 = assessment2?.plan;
        const before = target2.count, count = plan2?.cargoCount ?? Math.min(before, Math.floor(capacity / slots));
        const passenger = count === before ? target2 : { ...cloneZeroSquad(target2), id: nextId(target2.unitTypeId), count };
        if (count < before) {
          target2.count -= count;
          if (target2.damageCarry) {
            passenger.damageCarry = target2.damageCarry * count / before;
            target2.damageCarry *= target2.count / before;
          }
          squads.push(passenger);
        }
        passenger.embarkedOn = carrier.id;
        passenger.status = "idle";
        delete passenger.transportMission;
        carrier.transportMission = { stage: "outbound", goal: plan2?.dropGoal ?? awayBase, ...plan2?.via ? { via: plan2.via } : {}, ...plan2 ? { plan: plan2 } : {} };
        records.push({
          operation: "load",
          carrierId: carrier.id,
          goal: plan2?.dropGoal ?? awayBase,
          ...plan2 ? { plan: plan2 } : {},
          sourceId: target2.id,
          sourceBefore: before,
          sourceAfter: count === before ? 0 : target2.count,
          cargo: cloneZeroSquad(passenger),
          slots: count * slots
        });
      } else {
        if (!isZeroGroundPoint(field, carrier)) continue;
        for (const passenger of cargo) {
          delete passenger.embarkedOn;
          passenger.status = "idle";
          records.push({ operation: "unload", carrierId: carrier.id, goal: mission.goal, cargo: cloneZeroSquad(passenger) });
        }
        if (mission.stage === "outbound") {
          carrier.transportMission = { stage: "return", goal: homeGate };
          records.push({ operation: "return", carrierId: carrier.id, goal: homeGate });
        } else {
          delete carrier.transportMission;
          records.push({ operation: "complete", carrierId: carrier.id, goal: homeGate });
        }
      }
      continue;
    }
    if (cargo.length || action === "defend" || harassSkill < 600) continue;
    const assessment = context ? planZeroTransportMission(squads, carrier, field, context) : void 0;
    if (assessment && !assessment.plan) {
      records.push({ operation: "defer", carrierId: carrier.id, goal: homeGate, reasons: assessment.reasons });
      continue;
    }
    const plan = assessment?.plan;
    const target = plan ? squads.find((s) => s.id === plan.pickupId) : zeroTransportCandidate(squads.filter((s) => s.side === carrier.side), carrier.id);
    if (!target) continue;
    carrier.transportMission = { stage: "pickup", goal: homeGate, pickupId: target.id, ...plan ? { plan } : {} };
    records.push({ operation: "dispatch", carrierId: carrier.id, goal: homeGate, sourceId: target.id, ...plan ? { plan } : {} });
  }
  return { squads, records };
}
function removeZeroLostCargo(source) {
  const alive = new Set(source.filter(zeroDeployed).map((s) => s.id));
  const lost = source.filter((s) => s.count > 0 && s.embarkedOn && !alive.has(s.embarkedOn));
  const casualties = lost.map((s) => ({
    squadId: s.id,
    unitTypeId: s.unitTypeId,
    count: s.count,
    cause: "transport-loss",
    carrierId: s.embarkedOn
  }));
  return { squads: source.filter((s) => !lost.includes(s)), lost, casualties };
}
function assertZeroTransportState(squads, field) {
  const byId = new Map(squads.map((s) => [s.id, s]));
  if (byId.size !== squads.length) throw new Error("\uC911\uBCF5 \uC81C\uB85C \uBD80\uB300 ID");
  const assigned = /* @__PURE__ */ new Set();
  for (const squad of squads) {
    if (getZeroUnit(squad.unitTypeId).transportCapacity && squad.count !== 1) throw new Error(`\uC218\uC1A1\uC120\uC740 \uAC1C\uBCC4 \uD3B8\uC131\uD574\uC57C \uD568: ${squad.id}`);
    if (squad.embarkedOn) {
      const carrier = byId.get(squad.embarkedOn);
      if (!carrier || !zeroDeployed(carrier) || carrier.side !== squad.side || !getZeroUnit(carrier.unitTypeId).transportCapacity || !zeroCargoSlots(squad.unitTypeId) || zeroDistance(carrier, squad) > 15e-5) throw new Error(`\uC798\uBABB\uB41C \uD0D1\uC2B9 \uCC38\uC870: ${squad.id}`);
    }
    if (squad.transportMission) {
      const mission = squad.transportMission;
      if (!getZeroUnit(squad.unitTypeId).transportCapacity || !field.nodes.some((n) => n.id === mission.goal)) throw new Error(`\uC798\uBABB\uB41C \uC218\uC1A1 \uBAA9\uC801\uC9C0: ${squad.id}`);
      if (mission.via && !field.nodes.some((n) => n.id === mission.via)) throw new Error(`\uC798\uBABB\uB41C \uC218\uC1A1 \uACBD\uC720\uC9C0: ${squad.id}`);
      if (mission.stage === "pickup") {
        const passenger = mission.pickupId ? byId.get(mission.pickupId) : void 0;
        if (!passenger || !zeroDeployed(passenger) || passenger.side !== squad.side || assigned.has(passenger.id)) throw new Error(`\uC798\uBABB\uB41C \uD0D1\uC2B9 \uBC30\uC815: ${squad.id}`);
        assigned.add(passenger.id);
      }
    }
    const cargo = squads.filter((s) => s.embarkedOn === squad.id);
    if (cargo.reduce((sum, s) => sum + s.count * zeroCargoSlots(s.unitTypeId), 0) > (getZeroUnit(squad.unitTypeId).transportCapacity ?? 0)) throw new Error(`\uC218\uC1A1 \uC815\uC6D0 \uCD08\uACFC: ${squad.id}`);
  }
}

// src/core/zero/visibility.ts
function zeroIsCloaked(squad) {
  const stealth = getZeroUnit(squad.unitTypeId).stealth;
  return stealth === "permanent" || stealth === "energy" && squad.cloaked === true || stealth === "burrow" && (squad.status === "idle" || squad.status === "fighting");
}
function zeroCanReveal(target, observers, field) {
  if (target.embarkedOn) return false;
  if (!zeroIsCloaked(target)) return true;
  return observers.some((observer) => {
    const range = getZeroUnit(observer.unitTypeId).detectorRange ?? 0;
    return range > 0 && zeroDeployed(observer) && zeroDistance(observer, target) <= range && (!field || zeroSquadDistance(field, observer, target) <= range);
  });
}

// src/core/zero/abilities.ts
var ZERO_ABILITIES = {
  storm: { name: "\uC0AC\uC774\uC624\uB2C9 \uD3ED\uD48D", kind: "blast", cost: 75, range: 0.17, magnitude: 23, target: "any", limit: 3 },
  irradiate: { name: "\uC774\uB808\uB514\uC5D0\uC774\uD2B8", kind: "blast", cost: 75, range: 0.18, magnitude: 16, target: "biological", limit: 1 },
  matrix: { name: "\uB514\uD39C\uC2DC\uBE0C \uB9E4\uD2B8\uB9AD\uC2A4", kind: "protect", cost: 100, range: 0.16, magnitude: 0.2, target: "any", limit: 1 },
  lockdown: { name: "\uB77D\uB2E4\uC6B4", kind: "suppress", cost: 100, range: 0.17, magnitude: 0.5, target: "mechanical", limit: 1 },
  yamato: { name: "\uC57C\uB9C8\uD1A0 \uD3EC", kind: "blast", cost: 100, range: 0.18, magnitude: 30, target: "any", limit: 1 },
  ensnare: { name: "\uC778\uC2A4\uB124\uC5B4", kind: "suppress", cost: 75, range: 0.18, magnitude: 0.18, target: "any", limit: 2 },
  "dark-swarm": { name: "\uB2E4\uD06C \uC2A4\uC6DC \uC5C4\uD638", kind: "protect", cost: 100, range: 0.17, magnitude: 0.35, target: "ground", limit: 3 },
  maelstrom: { name: "\uBA54\uC77C\uC2A4\uD2B8\uB86C", kind: "suppress", cost: 100, range: 0.17, magnitude: 0.35, target: "biological", limit: 2 },
  web: { name: "\uB514\uC2A4\uB7FD\uC158 \uC6F9", kind: "suppress", cost: 100, range: 0.17, magnitude: 0.3, target: "ground", limit: 2 },
  stasis: { name: "\uC2A4\uD14C\uC774\uC2DC\uC2A4 \uD544\uB4DC", kind: "stasis", cost: 100, range: 0.17, magnitude: 1, target: "any", limit: 1 }
};
var active = (squad) => zeroDeployed(squad) && getZeroUnit(squad.unitTypeId).role !== "worker";
var distance = (a, b, field) => field ? zeroSquadDistance(field, a, b) : zeroDistance(a, b);
var zeroHasEnergy = (unit) => Boolean(unit.abilities?.length || unit.stealth === "energy");
var zeroEnergy = (squad) => Math.max(0, Math.min(200, Number.isFinite(squad.energy) ? squad.energy : zeroHasEnergy(getZeroUnit(squad.unitTypeId)) ? 75 : 0));
var zeroCombatReach = (squad) => Math.max(
  zeroEngagementRange(squad),
  ...(getZeroUnit(squad.unitTypeId).abilities ?? []).filter((id) => zeroEnergy(squad) >= ZERO_ABILITIES[id].cost).map((id) => ZERO_ABILITIES[id].range)
);
var accepts = (target, unit) => target === "any" || (target === "ground" ? unit.domain === "ground" : target === "biological" ? unit.biological : !unit.biological);
function planZeroAbilities(army, enemy, field) {
  const allies = army.filter(active), enemies = enemy.filter(active);
  const uses = [];
  for (const caster of allies) {
    const profile = getZeroUnit(caster.unitTypeId), energy = zeroEnergy(caster);
    const options = (profile.abilities ?? []).flatMap((abilityId) => {
      const ability = ZERO_ABILITIES[abilityId];
      if (energy < ability.cost) return [];
      const targets = (ability.kind === "protect" ? allies : enemies).filter((target) => {
        if (target.id === caster.id || !accepts(ability.target, getZeroUnit(target.unitTypeId)) || distance(caster, target, field) > ability.range) return false;
        if ((ability.kind === "suppress" || ability.kind === "stasis") && getZeroUnit(target.unitTypeId).power <= 0) return false;
        if (ability.kind !== "protect") return zeroCanReveal(target, allies, field);
        return (getZeroUnit(target.unitTypeId).weaponPower ?? getZeroUnit(target.unitTypeId).power) > 0 && enemies.some((foe) => distance(target, foe, field) <= 0.18 && zeroCanReveal(foe, allies, field) && (getZeroUnit(foe.unitTypeId).weaponPower ?? getZeroUnit(foe.unitTypeId).power) > 0 && (abilityId !== "dark-swarm" || getZeroUnit(foe.unitTypeId).range >= 4 && !getZeroUnit(foe.unitTypeId).splash && getZeroUnit(foe.unitTypeId).role !== "siege"));
      }).sort((a, b) => b.count * getZeroUnit(b.unitTypeId).power * b.health - a.count * getZeroUnit(a.unitTypeId).power * a.health || a.id.localeCompare(b.id)).slice(0, Math.max(1, ability.limit * Math.min(3, Math.floor(caster.count))));
      if (!targets.length) return [];
      const score = targets.reduce((sum, target) => sum + target.count * (getZeroUnit(target.unitTypeId).power + 1) * target.health, 0) * (ability.kind === "blast" ? 1 : ability.magnitude);
      return [{ score, use: {
        squadId: caster.id,
        unitTypeId: profile.id,
        abilityId,
        targets: targets.map((target) => target.id),
        energyBefore: energy,
        energyAfter: energy - ability.cost,
        magnitude: ability.magnitude
      } }];
    });
    options.sort((a, b) => b.score - a.score || a.use.abilityId.localeCompare(b.use.abilityId));
    if (options[0]) uses.push(options[0].use);
  }
  return uses;
}
function zeroAbilityMultiplier(attacker, defender, plans, spell = false) {
  const profile = getZeroUnit(attacker.unitTypeId);
  let outgoing = 1, protection = 1;
  for (const use of plans) {
    const ability = ZERO_ABILITIES[use.abilityId];
    if (ability.kind === "stasis" && (use.targets.includes(attacker.id) || use.targets.includes(defender.id))) return 0;
    if (ability.kind === "suppress" && use.targets.includes(attacker.id)) outgoing = Math.min(outgoing, 1 - use.magnitude);
    if (ability.kind === "protect" && use.targets.includes(defender.id)) {
      if (use.abilityId === "dark-swarm" && (spell || profile.range < 4 || profile.splash || profile.role === "siege")) continue;
      protection = Math.min(protection, 1 - use.magnitude);
    }
  }
  return outgoing * protection;
}

// src/core/zero/combat.ts
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}
function countOf(squad) {
  return Math.floor(clamp(squad.count, 0, 1e6));
}
function activeSquads(squads) {
  return squads.filter((squad) => zeroDeployed(squad) && getZeroUnit(squad.unitTypeId).role !== "worker");
}
function zeroRoleMultiplier(attacker, defender) {
  if (!attacker.attackDomains.includes(defender.domain)) return 0;
  if (attacker.role === "support" || attacker.role === "worker") return 0;
  if (attacker.splash) return defender.armorClass === "light" ? 1.06 : 1.02;
  if (attacker.role === "siege") return defender.armorClass === "light" ? 1.025 : 1.015;
  if (attacker.role === "caster") return defender.armorClass === "light" ? 1.025 : 1;
  if (attacker.role === "ranged" && attacker.speed >= 9) return defender.armorClass === "light" ? 1 : 0.975;
  if (attacker.role === "ranged" && attacker.armorClass === "armored") return defender.armorClass === "armored" ? 1.015 : 0.99;
  if (attacker.role === "melee" && attacker.tier === 3) return defender.armorClass === "light" ? 1.025 : 1;
  return 1;
}
function assessZeroArmy(army, enemy, complexity = 50, battlefield) {
  const attackers = activeSquads(army);
  const defenders = activeSquads(enemy);
  const ownAbilities = planZeroAbilities(attackers, defenders, battlefield);
  const allAbilities = [...ownAbilities, ...planZeroAbilities(defenders, attackers, battlefield)];
  const revealed = defenders.map((target) => zeroCanReveal(target, attackers, battlefield));
  const weights = defenders.map((squad) => countOf(squad) * getZeroUnit(squad.unitTypeId).durability * clamp(squad.health, 0, 1));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  const supportCount = attackers.filter((squad) => getZeroUnit(squad.unitTypeId).role === "support").reduce((sum, squad) => sum + countOf(squad) * clamp(squad.health, 0, 1), 0);
  const patientCount = attackers.filter((squad) => {
    const unit = getZeroUnit(squad.unitTypeId);
    return unit.biological && unit.role !== "support" && unit.attackDomains.length > 0;
  }).reduce((sum, squad) => sum + countOf(squad), 0);
  const healingBonus = patientCount > 0 ? 0.18 * Math.min(1, supportCount * 4 / patientCount) : 0;
  const report = {
    potentialPower: 0,
    attackPower: 0,
    effectivePower: 0,
    burstPower: 0,
    targetCoverage: 0,
    roleMultiplier: 1,
    supportBonus: 0,
    supportedCount: 0,
    blockedCount: 0,
    undetectedCount: defenders.reduce((sum, squad, index) => sum + (revealed[index] ? 0 : countOf(squad)), 0),
    abilities: ownAbilities,
    contributions: [],
    targets: defenders.map((squad) => ({ squadId: squad.id, unitTypeId: squad.unitTypeId, pressure: 0, burstPressure: 0 }))
  };
  let totalPotential = 0;
  let coveredPotential = 0;
  for (const squad of attackers) {
    const unit = getZeroUnit(squad.unitTypeId);
    const blast = ownAbilities.find((use) => use.squadId === squad.id && ZERO_ABILITIES[use.abilityId].kind === "blast");
    const weapon = unit.stealth === "burrow" && !zeroIsCloaked(squad) ? 0 : unit.weaponPower ?? unit.power;
    if (unit.role === "support" || unit.attackDomains.length === 0 && !blast) {
      report.contributions.push({ squadId: squad.id, unitTypeId: unit.id, power: 0 });
      continue;
    }
    const rangeLeverage = 1 + unit.range / 100 * (0.5 + clamp(complexity, 0, 100) / 100);
    const weaponPotential = countOf(squad) * weapon * clamp(squad.health, 0, 1) * rangeLeverage;
    const spellPotential = blast ? countOf(squad) * blast.magnitude * clamp(squad.health, 0, 1) : 0;
    const potential = weaponPotential + spellPotential;
    totalPotential += potential;
    let direct = 0;
    let burst = 0;
    let coverage = 0;
    const localHealingCapacity = battlefield ? attackers.filter((support) => getZeroUnit(support.unitTypeId).role === "support" && zeroSquadDistance(battlefield, squad, support) <= 0.12).reduce((sum, support) => {
      const patients = attackers.filter((patient) => {
        const profile = getZeroUnit(patient.unitTypeId);
        return profile.biological && profile.role !== "support" && profile.attackDomains.length > 0 && zeroSquadDistance(battlefield, patient, support) <= 0.12;
      }).reduce((count, patient) => count + countOf(patient), 0);
      return sum + countOf(support) * clamp(support.health, 0, 1) * 4 / Math.max(1, patients);
    }, 0) : 0;
    const availableHealing = battlefield ? 0.18 * Math.min(1, localHealingCapacity) : healingBonus;
    const supportMultiplier = 1 + (unit.biological ? availableHealing : 0);
    if (unit.biological && availableHealing > 0) report.supportedCount += countOf(squad);
    const reachable = defenders.map((target, index) => revealed[index] && (!battlefield || zeroSquadDistance(battlefield, squad, target) <= zeroEngagementRange(squad)));
    const localWeight = battlefield ? weights.reduce((sum, weight, index) => sum + (reachable[index] ? weight : 0), 0) : totalWeight;
    for (let index = 0; index < defenders.length; index += 1) {
      const multiplier = reachable[index] ? zeroRoleMultiplier(unit, getZeroUnit(defenders[index].unitTypeId)) : 0;
      const weight = reachable[index] && localWeight > 0 ? weights[index] / localWeight : 0;
      const target = defenders[index];
      const shot = weaponPotential * weight * multiplier * zeroAbilityMultiplier(squad, target, allAbilities);
      const spell = blast?.targets.includes(target.id) && revealed[index] ? spellPotential / blast.targets.length * zeroAbilityMultiplier(squad, target, allAbilities, true) : 0;
      const pressure = shot + spell;
      direct += pressure;
      const impulse = spell + (unit.suicide ? shot : 0);
      burst += impulse;
      if (multiplier > 0 && weaponPotential > 0) coverage += weight * weaponPotential / Math.max(1e-9, potential);
      if (spell > 0) coverage += spellPotential / Math.max(1e-9, potential) / blast.targets.length;
      report.targets[index].pressure += pressure * supportMultiplier;
      report.targets[index].burstPressure += impulse * supportMultiplier;
    }
    if (coverage === 0 && defenders.length > 0) report.blockedCount += countOf(squad);
    coveredPotential += potential * coverage;
    report.attackPower += direct;
    report.effectivePower += direct * supportMultiplier;
    report.burstPower += burst * supportMultiplier;
    report.contributions.push({ squadId: squad.id, unitTypeId: unit.id, power: direct * supportMultiplier, burstPower: burst * supportMultiplier });
  }
  report.targetCoverage = totalPotential > 0 ? clamp(coveredPotential / totalPotential, 0, 1) : 0;
  report.potentialPower = totalPotential;
  report.roleMultiplier = coveredPotential > 0 ? report.attackPower / coveredPotential : 1;
  report.supportBonus = report.attackPower > 0 ? clamp(report.effectivePower / report.attackPower - 1, 0, 0.18) : 0;
  return report;
}
function zeroDamageAssessment(source, intensity) {
  const rate = clamp(intensity, 0, 1);
  const scaled = (power, burst = 0) => power * rate + burst * (1 - rate);
  return {
    ...source,
    effectivePower: scaled(source.effectivePower, source.burstPower),
    contributions: source.contributions.map((c) => ({ ...c, power: scaled(c.power, c.burstPower) })),
    targets: source.targets.map((t) => ({ ...t, pressure: scaled(t.pressure, t.burstPressure) }))
  };
}

// src/core/zero/damage.ts
var EPS2 = 1e-9;
var bounded = (n, max) => Math.max(0, Math.min(max, Number.isFinite(n) ? n : 0));
function damageZeroSquad(source, requestedDamage) {
  const squad = cloneZeroSquad(source), durability = getZeroUnit(squad.unitTypeId).durability;
  const beforeCount = squad.count, hitPointsBefore = beforeCount * durability * squad.health;
  const damage = zeroDeployed(squad) ? bounded(requestedDamage, hitPointsBefore) : 0;
  if (damage <= 0) return { squad, record: { squadId: squad.id, beforeCount, afterCount: beforeCount, hitPointsBefore, hitPointsAfter: hitPointsBefore, damage: 0 } };
  const vitality = Math.min(durability, (hitPointsBefore + Math.max(0, squad.damageCarry ?? 0)) / beforeCount);
  const carry = Math.max(0, vitality * beforeCount - hitPointsBefore);
  const hitPointsAfter = Math.max(0, hitPointsBefore - damage);
  const lost = hitPointsAfter <= EPS2 ? beforeCount : Math.min(beforeCount, Math.floor((carry + damage + EPS2) / Math.max(EPS2, vitality)));
  squad.count -= lost;
  squad.health = squad.count ? bounded(hitPointsAfter / (squad.count * durability), 1) : 0;
  squad.status = "fighting";
  const remaining = carry + damage - lost * vitality;
  if (squad.count && remaining > EPS2) squad.damageCarry = remaining;
  else delete squad.damageCarry;
  return { squad, record: { squadId: squad.id, beforeCount, afterCount: squad.count, hitPointsBefore, hitPointsAfter, damage } };
}
function healZeroSquad(source, fraction) {
  const squad = cloneZeroSquad(source);
  if (!zeroDeployed(squad)) return squad;
  const maximum = squad.count * getZeroUnit(squad.unitTypeId).durability;
  const before = maximum * squad.health, recovered = bounded(fraction, 1) * maximum;
  const actual = Math.min(maximum - before, recovered);
  squad.health = bounded((before + actual) / maximum, 1);
  const carry = Math.max(0, (squad.damageCarry ?? 0) - actual);
  if (carry > EPS2) squad.damageCarry = carry;
  else delete squad.damageCarry;
  return squad;
}
function resolveZeroDamage(source, incoming, damageBudget) {
  const total = incoming.targets.reduce((sum, t) => sum + Math.max(0, t.pressure), 0);
  const records = [], casualties = [];
  const pressure = new Map(incoming.targets.map((t) => [t.squadId, Math.max(0, t.pressure)]));
  const squads = source.map((s) => {
    const hit = total > 0 ? bounded(damageBudget, 1e12) * (pressure.get(s.id) ?? 0) / total : 0;
    const { squad, record } = damageZeroSquad(s, hit);
    if (record.damage > 0) records.push(record);
    if (squad.count < s.count) casualties.push({ squadId: s.id, unitTypeId: s.unitTypeId, count: s.count - squad.count });
    return squad;
  });
  return { squads, records, casualties };
}

// src/core/zero/movement.ts
var SUBSTEPS = 12;
var CONTACT_DISTANCE = 0.065;
function advanceZeroMovement(field, source, actions, rushDistance, eligibleIds, formations) {
  const squads = source.map(cloneZeroSquad);
  const active2 = squads.filter((squad) => zeroDeployed(squad) && getZeroUnit(squad.unitTypeId).role !== "worker");
  const scouts = new Map(["home", "away"].map((side) => [side, active2.filter((squad) => squad.side === side && eligibleIds.has(squad.id)).sort((a, b) => getZeroUnit(b.unitTypeId).speed - getZeroUnit(a.unitTypeId).speed || a.id.localeCompare(b.id))[0]?.id]));
  const orders = active2.filter((squad) => eligibleIds.has(squad.id)).map((squad) => {
    const unit = getZeroUnit(squad.unitTypeId);
    const command = actions[squad.side];
    const pickup = active2.find((carrier) => carrier.side === squad.side && carrier.transportMission?.stage === "pickup" && carrier.transportMission.pickupId === squad.id);
    const transportGoal = squad.transportMission?.goal ?? pickup?.transportMission?.goal;
    const formation = formations?.[squad.side];
    const regroup = formation?.order === "regroup" && formation.squadIds.includes(squad.id) && formation.rallyNode;
    const intent = transportGoal ? "transport" : squad.status === "retreating" ? "retreat" : regroup ? "regroup" : command === "scout" && squad.id !== scouts.get(squad.side) ? "produce" : command === "harass" && unit.speed < 8 && unit.domain === "ground" ? "counter" : command;
    const goal = transportGoal ?? (intent === "regroup" ? formation.rallyNode : zeroRouteGoal(squad.side, intent));
    const flank = intent === "harass" || intent === "scout" ? squad.side === "home" ? "upper" : "lower" : void 0;
    const budget = zeroMovementBudget(squad, rushDistance);
    const via = squad.transportMission?.via;
    const route = via ? [...planZeroRoute(field, squad, via, "air"), ...planZeroRoute(field, field.nodes.find((n) => n.id === via), goal, "air").slice(1)] : planZeroRoute(field, squad, goal, unit.domain, flank);
    return {
      squad,
      route,
      trace: {
        squadId: squad.id,
        domain: unit.domain,
        goal,
        intent,
        budget,
        distance: 0,
        points: [{ x: squad.x, y: squad.y, progress: 0 }]
      }
    };
  });
  for (let step = 0; step < SUBSTEPS; step++) {
    const before = active2.filter((squad) => eligibleIds.has(squad.id)).map((squad) => ({ ...squad }));
    for (const order of orders) {
      const { squad, trace } = order;
      const partBudget = trace.budget / SUBSTEPS;
      const traveled = travelZeroRoute(order.route, partBudget);
      const proposed = traveled.points.at(-1) ?? squad;
      const blocker = trace.domain === "ground" && before.find((enemy) => enemy.side !== squad.side && getZeroUnit(enemy.unitTypeId).domain === "ground" && zeroDistance(squad, enemy) <= CONTACT_DISTANCE && zeroSquadDistance(field, squad, enemy) <= CONTACT_DISTANCE && zeroDistance(proposed, enemy) <= zeroDistance(squad, enemy) + 1e-9);
      if (blocker) {
        trace.blockedBy = blocker.id;
        squad.status = "idle";
      } else {
        let distance2 = 0;
        for (let i = 1; i < traveled.points.length; i++) {
          distance2 += zeroDistance(traveled.points[i - 1], traveled.points[i]);
          trace.points.push({ ...traveled.points[i], progress: (step + distance2 / partBudget) / SUBSTEPS });
        }
        const last = traveled.points.at(-1);
        if (last && traveled.distance > 0) {
          const via = squad.transportMission?.via;
          if (via && traveled.points.some((p) => zeroDistance(p, field.nodes.find((n) => n.id === via)) < 1e-8)) delete squad.transportMission.via;
          squad.x = last.x;
          squad.y = last.y;
          trace.distance += traveled.distance;
          squad.status = trace.intent === "retreat" ? "retreating" : "moving";
          let used = traveled.distance, next = 1;
          while (next < order.route.length && used >= zeroDistance(order.route[next - 1], order.route[next]) - 1e-9) {
            used -= zeroDistance(order.route[next - 1], order.route[next]);
            next++;
          }
          order.route = [{ x: squad.x, y: squad.y }, ...order.route.slice(next)];
        }
        if (order.route.length <= 1) squad.status = "idle";
      }
      trace.points.push({ x: squad.x, y: squad.y, progress: (step + 1) / SUBSTEPS });
    }
  }
  const movements = orders.map((order) => order.trace).filter((trace) => trace.distance > 1e-9);
  for (const passenger of squads.filter((s) => s.embarkedOn)) {
    const carrier = squads.find((s) => s.id === passenger.embarkedOn);
    if (!carrier) throw new Error(`\uACE0\uC544 \uD0D1\uC2B9 \uBD80\uB300: ${passenger.id}`);
    passenger.x = carrier.x;
    passenger.y = carrier.y;
    const flight = movements.find((trace) => trace.squadId === carrier.id);
    if (flight) movements.push({ ...flight, squadId: passenger.id, carrierId: carrier.id, intent: "transport", points: flight.points.map((p) => ({ ...p })) });
  }
  return { squads, movements };
}

// src/core/zero/intelligence.ts
var bounded2 = (value, max = 1e3) => Math.min(max, Math.max(0, Number.isFinite(value) ? value : 0));
var rounded = (value) => Math.round(value * 1e4) / 1e4;
function visibleObservers(friendly, target, field, scoutSkill, complexity, activeScout) {
  const vision = 0.14 + bounded2(scoutSkill) / 1e3 * 0.08 - bounded2(complexity, 100) * 5e-4 + (activeScout ? 0.055 : 0);
  if (!zeroCanReveal(target, friendly, field)) return [];
  return friendly.filter((observer) => zeroDeployed(observer) && zeroDistance(observer, target) <= vision && zeroSquadDistance(field, observer, target) <= vision);
}
function observeZeroDestructions(friendlyBefore, enemyBefore, enemyAfter, field, scoutSkill, complexity, activeScout = false) {
  const alive = new Set(enemyAfter.filter((squad) => squad.count > 0 && squad.health > 0).map((squad) => squad.id));
  return enemyBefore.filter((target) => zeroDeployed(target) && !alive.has(target.id)).flatMap((target) => {
    const witnesses = visibleObservers(friendlyBefore, target, field, scoutSkill, complexity, activeScout);
    return witnesses.length ? [{
      squadId: target.id,
      unitTypeId: target.unitTypeId,
      x: target.x,
      y: target.y,
      observerSquadIds: witnesses.map((squad) => squad.id).sort()
    }] : [];
  }).sort((a, b) => a.squadId.localeCompare(b.squadId));
}
function observeZeroEnemy(memory, friendly, enemy, field, frameIndex, scoutSkill, complexity, activeScout = false, confirmedDestructions = []) {
  const skill = bounded2(scoutSkill) / 1e3;
  const clarity = 0.55 + skill * 0.45;
  const lifetime = 2 + Math.floor(skill * 4);
  const visible = enemy.filter((target) => target.count > 0 && target.health > 0 && visibleObservers(friendly, target, field, scoutSkill, complexity, activeScout).length > 0);
  const confirmedIds = new Set(confirmedDestructions.map((entry) => entry.squadId));
  const byId = /* @__PURE__ */ new Map();
  for (const old of memory.observations) {
    if (confirmedIds.has(old.squadId)) continue;
    const age = Math.max(0, frameIndex - old.lastSeenFrame);
    if (age <= lifetime) byId.set(old.squadId, { ...old, confidence: rounded(clarity * (1 - age / (lifetime + 1))) });
  }
  for (const target of visible) byId.set(target.id, {
    squadId: target.id,
    unitTypeId: target.unitTypeId,
    count: Math.floor(bounded2(target.count, 1e6)),
    health: bounded2(target.health, 1),
    x: target.x,
    y: target.y,
    lastSeenFrame: frameIndex,
    confidence: rounded(clarity),
    cloaked: zeroIsCloaked(target)
  });
  return { observations: [...byId.values()].sort((a, b) => a.squadId.localeCompare(b.squadId)) };
}
function summarizeZeroIntel(memory, frameIndex) {
  const observed = memory.observations.filter((observation) => getZeroUnit(observation.unitTypeId).role !== "worker");
  let count = 0, value = 0, air = 0, armored = 0, ranged = 0, cloaked = 0, confidence = 0;
  for (const observation of observed) {
    const unit = getZeroUnit(observation.unitTypeId);
    const weight = observation.count * observation.health * observation.confidence * (unit.power + unit.durability * 0.45);
    count += observation.count * observation.confidence;
    value += weight;
    if (unit.domain === "air") air += weight;
    if (unit.armorClass === "armored") armored += weight;
    if (unit.range >= 4) ranged += weight;
    if (observation.cloaked) cloaked += weight;
    confidence += observation.confidence;
  }
  return {
    knownSquads: observed.length,
    estimatedCount: rounded(count),
    estimatedArmyValue: rounded(value),
    confidence: observed.length ? rounded(confidence / observed.length) : 0,
    airShare: value > 0 ? rounded(air / value) : 0,
    armoredShare: value > 0 ? rounded(armored / value) : 0,
    rangedShare: value > 0 ? rounded(ranged / value) : 0,
    staleSquads: observed.filter((observation) => observation.lastSeenFrame < frameIndex).length,
    cloakedShare: value > 0 ? rounded(cloaked / value) : 0
  };
}
function rememberedZeroArmy(memory) {
  return memory.observations.map((observation) => ({
    id: observation.squadId,
    side: "away",
    unitTypeId: observation.unitTypeId,
    count: observation.count,
    health: observation.health * observation.confidence,
    x: 0.52,
    y: 0.5,
    status: "idle",
    cloaked: observation.cloaked === true
  }));
}

// src/core/zero/preparation.ts
var ZERO_PREPARATION_LABELS = {
  balanced: "\uADE0\uD615 \uC6B4\uC601",
  scout: "\uCD08\uBC18 \uC815\uCC30",
  defend: "\uCD08\uBC18 \uBC29\uC5B4",
  harass: "\uACAC\uC81C \uC900\uBE44",
  macro: "\uD655\uC7A5 \uC900\uBE44"
};
var OPENINGS = {
  balanced: ["produce", "scout", "expand", "tech"],
  scout: ["scout", "scout", "expand", "tech"],
  defend: ["produce", "defend", "expand", "tech"],
  harass: ["produce", "harass", "expand", "tech"],
  macro: ["produce", "expand", "expand", "tech"]
};
function validateZeroPreparations(input) {
  const plans = {};
  if (!input.preparations) return plans;
  if (Object.keys(input.preparations).some((side) => side !== "home" && side !== "away")) throw new Error("\uACBD\uAE30 \uC900\uBE44\uC758 \uC9C4\uC601\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
  for (const side of ["home", "away"]) {
    const p = input.preparations[side];
    if (!p) continue;
    if (p.rulesVersion !== 1 || typeof p.id !== "string" || !p.id.trim() || p.id.length > 200 || p.teamId !== input[side].team.id || p.playerId !== input[side].player.id || p.mapId !== input.map.id || !Object.hasOwn(OPENINGS, p.openingFocus) || !Number.isFinite(p.proficiency) || p.proficiency < 0 || p.proficiency > 100) {
      throw new Error("\uACBD\uAE30 \uC900\uBE44\uAC00 \uD604\uC7AC \uD300\xB7\uC120\uC218\xB7\uB9F5 \uB610\uB294 \uC9C0\uC6D0\uD558\uB294 \uADDC\uCE59\uACFC \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
    }
    plans[side] = {
      id: p.id,
      rulesVersion: 1,
      teamId: p.teamId,
      playerId: p.playerId,
      mapId: p.mapId,
      openingFocus: p.openingFocus,
      proficiency: p.proficiency
    };
  }
  return plans;
}
function preparedZeroOpening(plan, frameIndex, baseline, investment, rng, openingState) {
  if (!plan || frameIndex < 0 || frameIndex >= 4) return { action: baseline };
  const requestedAction = plan.openingFocus === "macro" && frameIndex === 2 && openingState?.completedExpansions !== void 0 && openingState.completedExpansions > 0 ? "produce" : OPENINGS[plan.openingFocus][frameIndex];
  const feasible = (requestedAction !== "expand" || investment.canExpand) && (requestedAction !== "tech" || investment.canDevelop);
  const understood = plan.proficiency >= 100 || plan.proficiency > 0 && rng.next() < plan.proficiency / 100;
  const followed = feasible && understood;
  const action = followed ? requestedAction : baseline;
  return { action, preparation: {
    preparationId: plan.id,
    requestedAction,
    followed,
    changedOpening: followed && action !== baseline,
    reason: !feasible ? "\uC790\uC6D0\xB7\uB0A8\uC740 \uC2DC\uAC04 \uC870\uAC74\uC744 \uCDA9\uC871\uD558\uC9C0 \uBABB\uD574 \uD604\uC7A5 \uD310\uB2E8\uC73C\uB85C \uC804\uD658" : !understood ? "\uC900\uBE44 \uC219\uB828\uC774 \uBD80\uC871\uD574 \uAE30\uBCF8 \uC6B4\uC601\uC73C\uB85C \uC804\uD658" : `${ZERO_PREPARATION_LABELS[plan.openingFocus]}\uC758 \uC900\uBE44 \uD589\uB3D9 \uC218\uD589`
  } };
}

// src/core/zero/economy.ts
var clamp2 = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
var ZERO_EXPANSION_MINERALS = 140;
var zeroExpansionIncome = (resources) => 10 + clamp2(resources, 0, 100) * 0.18;
function zeroIncomeFactors(macro, workerCount, resources) {
  const macroFactor = 0.82 + clamp2(macro, 1, 1e3) / 1e3 * 0.36;
  const mineralFactor = macroFactor * clamp2(workerCount / 12, 0.5, 2.5) * (0.72 + clamp2(resources, 0, 100) * 62e-4);
  return { macroFactor, mineralFactor };
}
function zeroHarvest(input) {
  const { macroFactor, mineralFactor } = zeroIncomeFactors(input.macro, input.workerCount, input.resources);
  let minerals = input.income * mineralFactor;
  let gas = input.frameIndex >= 1 ? (9 + input.resources * 0.12 + input.tech * 0.16) * macroFactor : 0;
  const need = input.reservation;
  const divertedMinerals = need && input.frameIndex >= 1 ? Math.max(0, Math.min(
    minerals * 0.45,
    input.minerals + minerals - need.minerals,
    (need.gas - input.gas - gas) / 0.7
  )) : 0;
  minerals -= divertedMinerals;
  gas += divertedMinerals * 0.7;
  const round2 = (n) => Math.round(n * 100) / 100;
  return { minerals: round2(input.minerals + minerals), gas: round2(input.gas + gas), divertedMinerals };
}

// src/core/zero/strategy.ts
var clamp3 = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
var normalized = (player, key) => clamp3(player.stats[key], 1, 1e3) / 1e3;
var ZERO_ACTION_LABELS = {
  produce: "\uBCD1\uB825 \uCDA9\uC6D0",
  scout: "\uC815\uCC30",
  expand: "\uD655\uC7A5",
  tech: "\uAE30\uC220 \uAC1C\uBC1C",
  rush: "\uACF5\uC138",
  harass: "\uACAC\uC81C",
  defend: "\uC218\uBE44",
  counter: "\uB300\uC751 \uACF5\uACA9"
};
function evaluateZeroInvestments(state, resources) {
  const remainingIntervals = Math.max(0, Math.floor(state.remainingIntervals ?? 20));
  const workers = state.squads?.filter((s) => getZeroUnit(s.unitTypeId).role === "worker" && zeroDeployed(s)).reduce((sum, s) => sum + s.count, 0) ?? 12;
  const income = zeroExpansionIncome(resources) * zeroIncomeFactors(state.player.stats.macro, workers, resources).mineralFactor;
  const expansionReturn = income * Math.max(0, remainingIntervals - 1);
  const reservation = state.productionReservation && state.productionReservation.expiresFrame >= state.frameIndex ? state.productionReservation : void 0;
  const minerals = state.metrics.minerals - (reservation?.minerals ?? 0), gas = state.metrics.gas - (reservation?.gas ?? 0);
  return {
    remainingIntervals,
    expansionReturn,
    expansionCost: ZERO_EXPANSION_MINERALS,
    canExpand: minerals >= ZERO_EXPANSION_MINERALS && expansionReturn >= ZERO_EXPANSION_MINERALS,
    canDevelop: state.metrics.tech < 68 && remainingIntervals >= 2 && minerals >= 60 && gas >= 50
  };
}
function chooseZeroAction(state, map, rng) {
  const { player: s, metrics, frameIndex } = state;
  const intel = summarizeZeroIntel(state.intelligence, frameIndex);
  const threat = intel.knownSquads ? clamp3((intel.estimatedArmyValue - metrics.armyValue) / 450, -1, 1) : 0;
  const affordability = clamp3((metrics.minerals + metrics.gas * 1.4) / 650, 0, 1.5);
  const complexity = map.complexity / 100, rushEase = 1 - map.rushDistance / 100;
  const missingIntel = 1 - intel.confidence;
  const canAffordTechnology = metrics.minerals >= 60 && metrics.gas >= 50;
  const investment = evaluateZeroInvestments(state, map.resources);
  const scores = {
    produce: 0.6 + normalized(s, "macro") * 0.75 + affordability * 0.4 - metrics.armyValue / 3500,
    scout: 0.12 + normalized(s, "scout") * 0.72 + missingIntel * 0.65 + complexity * 0.2,
    expand: 0.2 + normalized(s, "macro") * 1.1 + map.resources / 125 - Math.max(0, threat) * 0.8,
    tech: 0.12 + normalized(s, "strategy") * 0.82 + normalized(s, "sense") * 0.28 + affordability * 0.24 + (1 - metrics.tech / 100) * 0.65 - metrics.tech / 100 * 0.5 + (canAffordTechnology ? 0.28 : -0.85),
    rush: 0.12 + normalized(s, "attack") * 0.95 + normalized(s, "control") * 0.32 + rushEase * 0.65 - Math.max(0, threat) * 0.45,
    harass: 0.1 + normalized(s, "harass") * 1.05 + normalized(s, "sense") * 0.25 + complexity * 0.5,
    defend: 0.12 + normalized(s, "defense") * 0.9 + Math.max(0, threat) * 1.15,
    counter: 0.08 + normalized(s, "strategy") * 0.72 + intel.confidence * 0.74 + Math.max(0, -metrics.momentum) / 90
  };
  if (!investment.canExpand) scores.expand = -1e3;
  if (!investment.canDevelop) scores.tech = -1e3;
  const opening = ["produce", "scout", "expand", "tech"];
  if (frameIndex < opening.length) {
    const completedMacroExpansion = state.preparation?.openingFocus === "macro" && frameIndex === 2 && state.expansions !== void 0 && state.expansions > 0;
    const planned = completedMacroExpansion ? "produce" : opening[frameIndex];
    const action2 = planned === "expand" && !investment.canExpand || planned === "tech" && !investment.canDevelop ? "produce" : planned;
    const prepared = preparedZeroOpening(state.preparation, frameIndex, action2, investment, rng, { completedExpansions: state.expansions });
    return {
      action: prepared.action,
      scores,
      intel,
      investment,
      scriptedOpening: true,
      ...prepared.preparation ? { preparation: prepared.preparation } : {}
    };
  }
  for (const action2 of Object.keys(scores)) scores[action2] += rng.gaussian(0, 0.15);
  const action = Object.keys(scores).sort((a, b) => scores[b] - scores[a] || a.localeCompare(b))[0];
  return { action, scores, intel, investment, scriptedOpening: false };
}
function zeroProductionCount(unit, action, metrics) {
  const capacity = Math.max(0, Math.min(Math.floor(metrics.minerals / Math.max(1, unit.minerals)), unit.gas > 0 ? Math.floor(metrics.gas / unit.gas) : 99));
  const budget = action === "produce" || action === "rush" ? 250 : 180;
  const batch = Math.max(1, Math.floor(budget / Math.max(1, unit.minerals + unit.gas * 1.2)));
  return Math.min(capacity, unit.transportCapacity ? 1 : batch);
}
function estimateZeroProductionDamage(army, enemy) {
  const packet = zeroDamageAssessment(assessZeroArmy(army, enemy), 0.27);
  const hitPoints = new Map(enemy.map((squad) => [squad.id, Math.max(0, squad.count) * clamp3(squad.health, 0, 1) * getZeroUnit(squad.unitTypeId).durability]));
  return packet.targets.reduce((sum, target) => sum + Math.min(Math.max(0, target.pressure), hitPoints.get(target.squadId) ?? 0), 0);
}
function rankZeroProduction(state, action, rng) {
  const { player, metrics } = state;
  const tier = metrics.tech >= 68 ? 3 : metrics.tech >= 32 ? 2 : 1;
  const candidates = listZeroUnitsForRace(player.race).filter((unit) => unit.role !== "worker" && unit.tier <= tier && zeroProductionCount(unit, action, metrics) > 0);
  if (!candidates.length) return [];
  const intel = summarizeZeroIntel(state.intelligence, state.frameIndex);
  const remembered = rememberedZeroArmy(state.intelligence);
  const friendly = state.squads.map((squad) => ({ ...squad, x: 0.48, y: 0.5 }));
  const expected = (army, enemy) => estimateZeroProductionDamage(army, enemy) / 0.27;
  const beforePower = expected(friendly, remembered);
  const beforeIncoming = expected(remembered, friendly);
  const adaptation = (normalized(player, "strategy") + normalized(player, "sense")) / 2;
  const wanted = { rush: "melee", harass: "air", defend: "siege", counter: "ranged", scout: "ranged", tech: "caster" };
  const antiAirPower = friendly.reduce((sum, squad) => {
    const unit = getZeroUnit(squad.unitTypeId);
    return sum + (unit.attackDomains.includes("air") ? squad.count * unit.power * squad.health : 0);
  }, 0);
  const needsAntiAir = intel.airShare > 0.15 && antiAirPower < intel.estimatedArmyValue * intel.airShare * 0.6;
  const armyCount = friendly.filter((squad) => getZeroUnit(squad.unitTypeId).role !== "worker").reduce((sum, squad) => sum + squad.count, 0);
  const detectors = friendly.filter((squad) => getZeroUnit(squad.unitTypeId).detectorRange).reduce((sum, squad) => sum + squad.count, 0);
  const detectorQuota = Math.min(3, Math.ceil(Math.max(0, metrics.armyValue) / 400));
  const transportDemand = metrics.tech >= 32 && action !== "defend" && normalized(player, "harass") >= 0.6 && Boolean(state.transportContext) && !state.squads.some((s) => zeroDeployed(s) && getZeroUnit(s.unitTypeId).transportCapacity);
  return candidates.map((unit) => {
    let count = zeroProductionCount(unit, action, metrics);
    if (state.singleUnit) count = Math.min(count, 1);
    const side = state.squads[0]?.side ?? "home";
    const homeBase = state.transportContext?.battlefield.nodes.find((n) => n.id === `${side}-base`);
    const transportAssessment = transportDemand && unit.transportCapacity && homeBase ? planZeroTransportMission(
      state.squads,
      { id: `planned-${unit.id}`, side, unitTypeId: unit.id, count: 1, x: homeBase.x, y: homeBase.y, health: 1, status: "idle" },
      state.transportContext.battlefield,
      state.transportContext
    ) : void 0;
    const transportPlan = transportAssessment?.plan;
    if (unit.role === "transport" && !transportPlan) count = 0;
    if (unit.detectorRange) count = Math.min(count, Math.max(transportPlan ? 1 : 0, detectorQuota - detectors));
    if (unit.attackDomains.length === 1 && unit.attackDomains[0] === "air" && !intel.airShare) count = 0;
    if (unit.role === "caster" && !unit.attackDomains.length) {
      const same = friendly.filter((squad) => squad.unitTypeId === unit.id).reduce((sum, squad) => sum + squad.count, 0);
      count = Math.min(count, Math.max(0, Math.ceil(armyCount / 16) - same));
    }
    if (unit.role === "support") {
      const patients = friendly.filter((squad) => getZeroUnit(squad.unitTypeId).biological && getZeroUnit(squad.unitTypeId).role !== "support").reduce((sum, squad) => sum + squad.count, 0);
      const support = friendly.filter((squad) => getZeroUnit(squad.unitTypeId).role === "support").reduce((sum, squad) => sum + squad.count, 0);
      count = Math.min(count, Math.max(0, Math.ceil(patients / 4) - support));
    }
    const preview = { id: "planned-production", side: "home", unitTypeId: unit.id, count, x: 0.48, y: 0.5, health: 1, status: "idle", energy: 100 };
    const attackChange = expected([...friendly, preview], remembered) - beforePower;
    const preventedPower = Math.max(0, beforeIncoming - expected(remembered, [...friendly, preview]));
    const marginalPower = Math.max(0, attackChange + preventedPower * 0.8);
    const mobility = 1 + unit.speed / 10 * (action === "harass" || action === "rush" ? 0.25 : 0.08);
    const intrinsic = (unit.power * 1.1 + unit.durability * 0.55) * count * mobility;
    const response = marginalPower * 1.1 + unit.durability * count * 0.55;
    const responseWeight = intel.knownSquads ? (0.35 + adaptation * 0.5) * intel.confidence : 0;
    let score = intrinsic * (1 - responseWeight) + response * responseWeight + (unit.role === wanted[action] ? 24 : 0);
    const reasons = [
      `\uC0DD\uC0B0 \uAC00\uB2A5 ${count}\uAE30`,
      `\uAE30\uC5B5 \uC2E0\uB8B0\uB3C4 ${Math.round(intel.confidence * 100)}%`,
      `\uC870\uD569 \uCD94\uAC00 \uC804\uD22C\uB825 ${marginalPower.toFixed(2)}`,
      `\uCDA9\uC804 \uD6C4 \uACF5\uACA9 \uBCC0\uD654 ${attackChange.toFixed(2)} / \uC0C1\uB300 \uACF5\uACA9 \uC5B5\uC81C ${preventedPower.toFixed(2)}`,
      "\uAE30\uC5B5\uB41C \uD45C\uC801\uC758 \uB0A8\uC740 \uCCB4\uB825\uC744 \uB118\uB294 \uD53C\uD574\uB294 \uC0DD\uC0B0 \uAC00\uCE58\uC5D0\uC11C \uC81C\uC678"
    ];
    if (needsAntiAir) {
      score *= unit.attackDomains.includes("air") ? 1 + adaptation * 0.7 : 1 - adaptation * 0.75;
      reasons.push(unit.attackDomains.includes("air") ? "\uAD00\uCE21\uB41C \uACF5\uC911 \uBCD1\uB825\uC5D0 \uB300\uC751" : "\uAD00\uCE21\uB41C \uACF5\uC911 \uBCD1\uB825 \uACF5\uACA9 \uBD88\uAC00");
    }
    if (unit.detectorRange && count > 0) {
      score += (detectors === 0 ? 90 : 15) + (intel.cloakedShare > 0 ? 160 : 0);
      reasons.push(`\uC790\uAE30 \uBCD1\uB825 \uAC00\uCE58 ${metrics.armyValue.toFixed(2)} / \uD0D0\uC9C0 \uC900\uBE44 ${detectors}\uAE30 / \uBAA9\uD45C ${detectorQuota}\uAE30`);
      reasons.push(intel.cloakedShare > 0 ? "\uAE30\uC5B5\uB41C \uC740\uD3D0 \uBCD1\uB825\uC5D0 \uB300\uD55C \uD0D0\uC9C0 \uBCF4\uAC15" : "\uC790\uAE30 \uBCD1\uB825 \uADDC\uBAA8\uC5D0 \uB9DE\uCD98 \uD0D0\uC9C0\xB7\uC815\uCC30 \uC900\uBE44 (\uC228\uC740 \uC801 \uC815\uBCF4 \uBBF8\uC0AC\uC6A9)");
    }
    if (unit.abilities?.length) reasons.push("\uB300\uD45C \uAE30\uC220\uC758 \uC720\uD6A8 \uD45C\uC801\uACFC \uC5D0\uB108\uC9C0\uB97C \uC870\uD569 \uD3C9\uAC00\uC5D0 \uBC18\uC601");
    if (transportPlan && count > 0) {
      score += 110;
      reasons.push("\uC2DC\uAC04\xB7\uC704\uD5D8\xB7\uC8FC\uB825 \uBCF4\uC874\uC744 \uD1B5\uACFC\uD55C \uC2E4\uC81C \uC218\uC1A1 \uC784\uBB34 \uC900\uBE44 / 1\uCC99 \uB2E8\uC704", ...transportPlan.reasons);
    }
    if (unit.role === "support") reasons.push("\uAE30\uC874 \uC0DD\uCCB4 \uBCD1\uB825\uC758 \uCE58\uB8CC \uC218\uC694\uAE4C\uC9C0\uB9CC \uC0DD\uC0B0");
    return { unitTypeId: unit.id, count, score: count ? score + rng.next() * 3 : -1, reasons };
  }).filter((choice) => choice.count > 0).sort((a, b) => b.score - a.score || a.unitTypeId.localeCompare(b.unitTypeId));
}
function planZeroProduction(state, action, rng) {
  const choices = rankZeroProduction(state, action, rng), ready = choices[0];
  const context = state.transportContext;
  const prior = state.productionReservation;
  if (prior && prior.expiresFrame >= state.frameIndex) {
    const funded = choices.find((c) => c.unitTypeId === prior.unitTypeId);
    if (funded && funded.score >= (ready?.score ?? 0) * 0.8) return { choice: funded };
  }
  const intel = summarizeZeroIntel(state.intelligence, state.frameIndex);
  if (!context || context.remainingIntervals < 4 || state.metrics.armyValue < 100 || state.metrics.baseIntegrity < 40 || intel.estimatedArmyValue > state.metrics.armyValue * 1.6) return ready ? { choice: ready } : {};
  const side = state.squads[0]?.side ?? "home", base = context.battlefield.nodes.find((n) => n.id === `${side}-base`), center = context.battlefield.nodes.find((n) => n.id === "center");
  if (!base || !center) return ready ? { choice: ready } : {};
  const workers = state.squads.filter((s) => getZeroUnit(s.unitTypeId).role === "worker" && zeroDeployed(s)).reduce((n, s) => n + s.count, 0);
  const prospects = rankZeroProduction({ ...state, singleUnit: true, metrics: {
    ...state.metrics,
    minerals: Math.max(500, state.metrics.minerals),
    gas: Math.max(400, state.metrics.gas)
  } }, action, rng);
  const plans = [];
  for (const prospect of prospects) {
    const unit = getZeroUnit(prospect.unitTypeId);
    if (unit.tier < 2 || !unit.gas || unit.transportCapacity || unit.minerals <= state.metrics.minerals && unit.gas <= state.metrics.gas) continue;
    const travel = 1 + Math.ceil(zeroDistance(base, center) / zeroMovementBudget({ unitTypeId: unit.id }, context.rushDistance));
    const limit = Math.min(4, context.remainingIntervals - travel - 1);
    let projected = { minerals: state.metrics.minerals, gas: state.metrics.gas };
    for (let wait = 1; wait <= limit; wait++) {
      projected = zeroHarvest({
        ...projected,
        macro: state.player.stats.macro,
        workerCount: workers,
        resources: context.resources ?? 50,
        income: state.metrics.income,
        tech: state.metrics.tech,
        frameIndex: state.frameIndex + wait,
        reservation: unit
      });
      if (projected.minerals < unit.minerals || projected.gas < unit.gas) continue;
      const score = prospect.score * Math.pow(0.92, wait);
      if (score > (ready?.score ?? 0) * 1.12) plans.push({
        unitTypeId: unit.id,
        minerals: unit.minerals,
        gas: unit.gas,
        targetFrame: state.frameIndex + wait,
        expiresFrame: prior?.unitTypeId === unit.id ? prior.expiresFrame : state.frameIndex + wait + 2,
        score,
        reasons: [
          ...prospect.reasons,
          `\uAD11\uBB3C ${unit.minerals} / \uAC00\uC2A4 ${unit.gas} \uD655\uBCF4 \uD6C4 \uC0DD\uC0B0`,
          `\uC608\uC0C1 \uCC44\uCDE8 ${wait}\uAD6C\uAC04 + \uD569\uB958 ${travel}\uAD6C\uAC04 + \uACF5\uACA9 1\uAD6C\uAC04 / \uB0A8\uC740 ${context.remainingIntervals}\uAD6C\uAC04`,
          "\uAD11\uBB3C \uCC44\uCDE8 \uC77C\uBD80\uB97C \uAC00\uC2A4\uC5D0 \uBC30\uC815 / \uCC3D\uACE0 \uC790\uC6D0 \uC804\uD658 \uC5C6\uC74C"
        ]
      });
      break;
    }
  }
  plans.sort((a, b) => b.score - a.score || a.unitTypeId.localeCompare(b.unitTypeId));
  const plan = plans.find((p) => p.expiresFrame >= state.frameIndex);
  return plan ? { reservation: plan } : ready ? { choice: ready } : {};
}

// src/core/zero/formation.ts
function planZeroFormation(field, source, side, strategy, action) {
  const assigned = new Set(source.map((s) => s.transportMission?.pickupId).filter(Boolean));
  const army = source.filter((squad) => squad.side === side && zeroDeployed(squad) && !squad.transportMission && !assigned.has(squad.id) && getZeroUnit(squad.unitTypeId).role !== "worker");
  const fastest = army.slice().sort((a, b) => getZeroUnit(b.unitTypeId).speed - getZeroUnit(a.unitTypeId).speed || a.id.localeCompare(b.id))[0]?.id;
  const main = army.filter((squad) => !(action === "scout" && squad.id === fastest) && !(action === "harass" && (getZeroUnit(squad.unitTypeId).speed >= 8 || getZeroUnit(squad.unitTypeId).domain === "air")));
  const weight = (squad) => {
    const unit = getZeroUnit(squad.unitTypeId);
    return squad.count * squad.health * (unit.role === "support" ? unit.durability * 0.15 : unit.power + unit.durability * 0.45);
  };
  const total = main.reduce((sum, squad) => sum + weight(squad), 0);
  const requiredPowerShare = 0.55 + Math.max(0, Math.min(1e3, Number.isFinite(strategy) ? strategy : 500)) / 1e3 * 0.18;
  const ranked = main.map((anchor) => ({ anchor, power: main.reduce((sum, other) => sum + (zeroDistance(anchor, other) <= 0.13 && zeroSquadDistance(field, anchor, other) <= 0.13 ? weight(other) : 0), 0) })).sort((a, b) => b.power - a.power || a.anchor.id.localeCompare(b.anchor.id));
  const cluster = ranked[0];
  const readyPowerShare = total > 0 && cluster ? cluster.power / total : 1;
  const base = { readyPowerShare, requiredPowerShare, squadIds: main.map((squad) => squad.id).sort() };
  if (!cluster || readyPowerShare >= requiredPowerShare || action === "defend") {
    return { ...base, order: "advance", reason: action === "defend" ? "\uC218\uBE44 \uBA85\uB839\uC5D0 \uB530\uB77C \uBCF8\uC9C4 \uC55E \uBC30\uCE58" : "\uC8FC\uB825 \uBCD1\uB825 \uC9D1\uACB0 \uAE30\uC900 \uCDA9\uC871" };
  }
  const distance2 = (node) => getZeroUnit(cluster.anchor.unitTypeId).domain === "air" ? zeroDistance(node, cluster.anchor) : zeroGroundDistance(field, cluster.anchor, node);
  const rally = field.nodes.slice().sort((a, b) => distance2(a) - distance2(b) || a.id.localeCompare(b.id))[0];
  if (!rally) return { ...base, order: "advance", reason: "\uC0AC\uC6A9 \uAC00\uB2A5\uD55C \uC9D1\uACB0 \uAC70\uC810 \uC5C6\uC74C" };
  return {
    ...base,
    order: "regroup",
    rallyNode: rally.id,
    reason: `\uC8FC\uB825 ${Math.round(readyPowerShare * 100)}% \uC9D1\uACB0 / \uAE30\uC900 ${Math.round(requiredPowerShare * 100)}%: \uC99D\uC6D0 \uD569\uB958 \uB300\uAE30`
  };
}

// src/core/zero/pressure.ts
function groundAttackForce(squads, side) {
  return squads.filter((squad) => squad.side === side && zeroDeployed(squad) && squad.status !== "retreating" && getZeroUnit(squad.unitTypeId).role !== "worker" && (getZeroUnit(squad.unitTypeId).weaponPower ?? getZeroUnit(squad.unitTypeId).power) > 0 && (getZeroUnit(squad.unitTypeId).stealth !== "burrow" || zeroIsCloaked(squad)) && getZeroUnit(squad.unitTypeId).attackDomains.includes("ground"));
}
function zeroBaseAttackers(squads, side, field) {
  const base = field.nodes.find((node) => node.id === `${side === "home" ? "away" : "home"}-base`);
  if (!base) return [];
  return groundAttackForce(squads, side).filter((squad) => {
    const distance2 = getZeroUnit(squad.unitTypeId).domain === "air" ? zeroDistance(squad, base) : zeroGroundDistance(field, squad, base);
    return distance2 <= zeroEngagementRange(squad);
  });
}
function assessZeroBaseAttack(attackers, attackSkill, defenseSkill) {
  let sustainedPower = 0, burstPower = 0;
  for (const squad of attackers) {
    const unit = getZeroUnit(squad.unitTypeId), power = squad.count * (unit.weaponPower ?? unit.power) * squad.health;
    if (unit.suicide) burstPower += power;
    else sustainedPower += power;
  }
  const skill = (n) => Math.max(1e-3, Math.min(1, Number.isFinite(n) ? n : 0.5));
  const armorMultiplier = 1.5 * (0.85 + skill(defenseSkill) * 0.3);
  const damage = (sustainedPower * 0.27 + burstPower) * (0.85 + skill(attackSkill) * 0.3) / armorMultiplier;
  return { damage, sustainedPower, burstPower, armorMultiplier };
}
function planZeroFieldPressure(squads, side, field, action, attackSkill, harassSkill, intel, complexity) {
  const inactive = { territory: [], raiders: [], mapShift: 0, incomeDamage: 0 };
  if (!["rush", "harass", "counter"].includes(action)) return inactive;
  const territory = groundAttackForce(squads, side).filter((squad) => (side === "home" ? squad.x : 1 - squad.x) > 0.5);
  const raiders = zeroBaseAttackers(squads, side, field);
  const bounded3 = (value, max) => Math.min(max, Math.max(0, Number.isFinite(value) ? value : 0));
  const pressure = (bounded3(action === "harass" ? harassSkill : attackSkill, 1) * 4 + bounded3(intel, 100) / 35) * (action === "harass" ? 1 + bounded3(complexity, 100) / 260 : 1);
  const commitment = (force) => Math.min(1, force.reduce((sum, squad) => sum + squad.count * getZeroUnit(squad.unitTypeId).power * squad.health, 0) / 100);
  return { territory, raiders, mapShift: pressure * 0.7 * commitment(territory), incomeDamage: pressure * 0.22 * commitment(raiders) };
}

// src/core/zero/simulateZeroMatch.ts
var SIDES = ["home", "away"];
var DEFAULT_DECISIONS = 15;
function finite(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function clamp4(value, min, max) {
  return Math.min(max, Math.max(min, finite(value, min)));
}
function round(value, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(finite(value, 0) * scale) / scale || 0;
}
function mapValue(value) {
  return clamp4(finite(value, 50), 0, 100);
}
function stat(player, key) {
  return clamp4(finite(player.stats?.[key], 500), 1, 1e3);
}
function normalizedStat(player, key) {
  return stat(player, key) / 1e3;
}
function conditionFactor(player) {
  return clamp4(finite(player.condition, 100), 0, 200) / 100;
}
function sideName(side) {
  return side === "home" ? "\uD648" : "\uC6D0\uC815";
}
function opponentOf(side) {
  return side === "home" ? "away" : "home";
}
function baseX(side) {
  return side === "home" ? 0.08 : 0.92;
}
function createActionCounts() {
  return {
    produce: 0,
    scout: 0,
    expand: 0,
    tech: 0,
    rush: 0,
    harass: 0,
    defend: 0,
    counter: 0
  };
}
function initialCombatUnit(race) {
  if (race === "T") return { unitTypeId: "terran-marine", count: 6 };
  if (race === "Z") return { unitTypeId: "zerg-zergling", count: 12 };
  return { unitTypeId: "protoss-zealot", count: 4 };
}
function makeSquad(state, unitTypeId, count, status = "idle") {
  const squad = {
    id: `zero-${state.side}-${unitTypeId}-${state.nextSquadNo}`,
    side: state.side,
    unitTypeId,
    count: Math.max(1, Math.floor(count)),
    x: baseX(state.side),
    y: 0.5,
    health: 1,
    status
  };
  state.nextSquadNo += 1;
  if (zeroHasEnergy(getZeroUnit(unitTypeId))) squad.energy = 75;
  return squad;
}
function advanceUnitEnergy(state, frameIndex, write) {
  const changes = [];
  for (const squad of state.squads) {
    const unit = getZeroUnit(squad.unitTypeId);
    if (!zeroHasEnergy(unit)) continue;
    const before = zeroEnergy(squad), wasCloaked = squad.cloaked === true;
    squad.energy = Math.min(200, before + (frameIndex > 0 ? 25 : 0));
    if (unit.stealth === "energy") {
      squad.cloaked = squad.energy >= 10;
      if (squad.cloaked) squad.energy -= 10;
    }
    if (before !== squad.energy || wasCloaked !== (squad.cloaked === true)) changes.push({ squadId: squad.id, before, after: squad.energy, cloaked: squad.cloaked === true });
  }
  if (changes.length) write("energy", {
    side: state.side,
    energyChanges: changes,
    text: `${state.player.name} \uC120\uC218\uC758 \uAE30\uC220 \uC5D0\uB108\uC9C0\uC640 \uC740\uD3D0 \uC720\uC9C0 \uC0C1\uD0DC\uAC00 \uAC31\uC2E0\uB410\uC0AC\uC640\uC694.`,
    factors: changes.map((change) => `${change.squadId}: ${change.before} \u2192 ${change.after}${change.cloaked ? " / \uC740\uD3D0 \uC720\uC9C0" : ""}`)
  });
}
function combatSquads(state) {
  return state.squads.filter((squad) => squad.count > 0 && getZeroUnit(squad.unitTypeId).role !== "worker");
}
function recalculateArmyValue(state) {
  const value = combatSquads(state).reduce((sum, squad) => {
    const unit = getZeroUnit(squad.unitTypeId);
    const health = clamp4(squad.health, 0, 1);
    return sum + squad.count * (unit.power + unit.durability * 0.45) * health;
  }, 0);
  state.metrics.armyValue = round(Math.max(0, value));
}
function createSideState(side, competitor, physics) {
  const player = playerForSimulation(competitor.player);
  const macro = normalizedStat(player, "macro");
  const worker = getZeroWorkerForRace(player.race);
  const initial = initialCombatUnit(player.race);
  const state = {
    side,
    competitor,
    player,
    metrics: {
      minerals: round(145 + physics.resources * 1.25),
      gas: 0,
      income: round(32 + physics.resources * 0.48 + macro * 16),
      armyValue: 0,
      baseIntegrity: 100,
      tech: round(8 + normalizedStat(player, "strategy") * 8),
      intel: 0,
      mapControl: 50,
      momentum: 0
    },
    squads: [],
    produced: 0,
    lost: 0,
    expansions: 0,
    actionCounts: createActionCounts(),
    nextSquadNo: 1,
    intelligence: { observations: [] }
  };
  state.squads.push(makeSquad(state, worker.id, 12));
  state.squads.push(makeSquad(state, initial.unitTypeId, initial.count));
  state.produced = 12 + initial.count;
  recalculateArmyValue(state);
  return state;
}
function createMapPhysics(input) {
  const rushDistance = mapValue(input.map?.rushDistance);
  const resources = mapValue(input.map?.resources);
  const complexity = mapValue(input.map?.complexity);
  const homeRace = input.home.player.race;
  const awayRace = input.away.player.race;
  const matchup = matchupOf(homeRace, awayRace);
  const rawMatchupBias = clamp4(finite(input.map.matchupBalance?.[matchup], 0), -1, 1);
  return {
    battlefield: createZeroBattlefield(complexity),
    rushDistance,
    resources,
    complexity,
    matchup,
    matchupBiasForHome: homeRace === awayRace ? 0 : signedMatchupBias(homeRace, awayRace, matchup, rawMatchupBias),
    // 같은 의사결정 수에서도 러시 거리가 길면 첫 접촉까지 실제 경기 시간이 더 흐릅니다.
    frameSeconds: round(42 + rushDistance * 0.42),
    // 0~100 러시 거리를 4~8번째 의사결정의 첫 대규모 교전으로 대응합니다.
    firstEngagementFrame: Math.round(4 + rushDistance * 0.04)
  };
}
function snapshotMetrics(metrics) {
  return {
    minerals: round(Math.max(0, metrics.minerals)),
    gas: round(Math.max(0, metrics.gas)),
    income: round(Math.max(0, metrics.income)),
    armyValue: round(Math.max(0, metrics.armyValue)),
    baseIntegrity: round(clamp4(metrics.baseIntegrity, 0, 100)),
    tech: round(clamp4(metrics.tech, 0, 100)),
    intel: round(clamp4(metrics.intel, 0, 100)),
    mapControl: round(clamp4(metrics.mapControl, 0, 100)),
    momentum: round(clamp4(metrics.momentum, -100, 100))
  };
}
function snapshotSquads(states) {
  return SIDES.flatMap((side) => states[side].squads).filter((squad) => squad.count > 0).map((squad) => ({
    ...cloneZeroSquad(squad),
    count: Math.max(1, Math.floor(squad.count)),
    // Contact/detection boundaries must survive replay serialization exactly.
    x: clamp4(squad.x, 0, 1),
    y: clamp4(squad.y, 0, 1),
    // Preserve wound precision in the authoritative replay. Rounding here can
    // display a living unit as dead and break HP/carry conservation on reload.
    health: clamp4(squad.health, 0, 1)
  }));
}
function accrueResources(state, physics, frameIndex, write) {
  const workerCount = state.squads.filter((squad) => getZeroUnit(squad.unitTypeId).role === "worker").reduce((sum, squad) => sum + squad.count, 0);
  if (state.productionReservation && state.productionReservation.expiresFrame < frameIndex) {
    write("production-plan", {
      side: state.side,
      text: `${getZeroUnit(state.productionReservation.unitTypeId).name} \uC0DD\uC0B0 \uACC4\uD68D\uC758 \uB300\uAE30 \uAE30\uD55C\uC774 \uB05D\uB0AC\uC0AC\uC640\uC694.`,
      factors: ["\uD655\uBCF4\uD558\uC9C0 \uBABB\uD55C \uC608\uC0B0\uC758 \uC608\uC57D \uD574\uC81C / \uBCD1\uB825 \uC7AC\uD310\uB2E8"]
    });
    delete state.productionReservation;
  }
  const mineralsBefore = state.metrics.minerals, gasBefore = state.metrics.gas;
  const harvest = zeroHarvest({
    macro: stat(state.player, "macro"),
    workerCount,
    resources: physics.resources,
    income: state.metrics.income,
    tech: state.metrics.tech,
    minerals: mineralsBefore,
    gas: gasBefore,
    frameIndex,
    reservation: state.productionReservation
  });
  state.metrics.minerals = harvest.minerals;
  state.metrics.gas = harvest.gas;
  if (harvest.divertedMinerals > 0) write("harvest", {
    side: state.side,
    text: `${state.player.name} \uC120\uC218\uAC00 ${getZeroUnit(state.productionReservation.unitTypeId).name} \uC0DD\uC0B0\uC744 \uC704\uD574 \uAC00\uC2A4 \uCC44\uCDE8\uC5D0 \uC9D1\uC911\uD588\uC0AC\uC640\uC694.`,
    harvest: { mineralsBefore, gasBefore, mineralsAfter: harvest.minerals, gasAfter: harvest.gas, divertedMinerals: harvest.divertedMinerals },
    factors: [
      `\uAD11\uBB3C ${round(mineralsBefore)} \u2192 ${harvest.minerals} / \uAC00\uC2A4 ${round(gasBefore)} \u2192 ${harvest.gas}`,
      `\uC774\uBC88 \uAD11\uBB3C \uCC44\uCDE8 ${round(harvest.divertedMinerals)}\uB97C \uAC00\uC2A4 \uCC44\uCDE8 ${round(harvest.divertedMinerals * 0.7)}\uB85C \uBC30\uC815`,
      "\uCC3D\uACE0\uC5D0 \uC788\uB294 \uC790\uC6D0\uC744 \uC804\uD658\uD558\uC9C0 \uC54A\uC74C"
    ]
  });
}
function applyPhysicalMapEffects(states, physics) {
  const byRace = (race) => SIDES.map((side) => states[side]).find((state) => state.player.race === race);
  const races = new Set(SIDES.map((side) => states[side].player.race));
  if (races.size === 2 && races.has("T") && races.has("Z")) {
    const terran = byRace("T");
    const zerg = byRace("Z");
    const distance2 = (physics.rushDistance - 50) / 50;
    const preparation = distance2 * (0.48 + normalizedStat(terran.player, "defense") * 0.42);
    terran.metrics.tech = clamp4(terran.metrics.tech + preparation, 0, 100);
    terran.metrics.momentum = clamp4(terran.metrics.momentum + distance2 * 0.34, -100, 100);
    zerg.metrics.momentum = clamp4(zerg.metrics.momentum - distance2 * 0.34, -100, 100);
  }
  if (races.size === 2 && races.has("Z") && races.has("P")) {
    const zerg = byRace("Z");
    const protoss = byRace("P");
    const abundance = (physics.resources - 50) / 50;
    const swarmYield = abundance * (0.62 + normalizedStat(zerg.player, "macro") * 0.58);
    zerg.metrics.income = Math.max(8, zerg.metrics.income + swarmYield);
    zerg.metrics.momentum = clamp4(zerg.metrics.momentum + abundance * 0.24, -100, 100);
    protoss.metrics.momentum = clamp4(protoss.metrics.momentum - abundance * 0.24, -100, 100);
  }
  if (races.size === 2 && races.has("P") && races.has("T")) {
    const protoss = byRace("P");
    const terran = byRace("T");
    const complexity = (physics.complexity - 50) / 50;
    const routeReading = complexity * (0.44 + normalizedStat(protoss.player, "strategy") * 0.48);
    protoss.metrics.mapControl = clamp4(protoss.metrics.mapControl + routeReading, 0, 100);
    terran.metrics.mapControl = clamp4(terran.metrics.mapControl - routeReading * 0.55, 0, 100);
  }
  const matchupBias = physics.matchupBiasForHome;
  if (Math.abs(matchupBias) > 1e-6) {
    states.home.metrics.mapControl = clamp4(states.home.metrics.mapControl + matchupBias * 0.36, 0, 100);
    states.away.metrics.mapControl = clamp4(states.away.metrics.mapControl - matchupBias * 0.36, 0, 100);
    states.home.metrics.momentum = clamp4(states.home.metrics.momentum + matchupBias * 0.22, -100, 100);
    states.away.metrics.momentum = clamp4(states.away.metrics.momentum - matchupBias * 0.22, -100, 100);
  }
}
function produceUnits(state, action, frameIndex, rng, write, physics, remainingIntervals) {
  const plan = planZeroProduction({ ...state, frameIndex, transportContext: {
    battlefield: physics.battlefield,
    resources: physics.resources,
    rushDistance: physics.rushDistance,
    remainingIntervals,
    intelligence: state.intelligence
  } }, action, rng);
  if (plan.reservation) {
    state.productionReservation = { ...plan.reservation, reasons: [...plan.reservation.reasons] };
    write("production-plan", {
      side: state.side,
      unitTypeId: plan.reservation.unitTypeId,
      text: `${state.player.name} \uC120\uC218\uAC00 ${getZeroUnit(plan.reservation.unitTypeId).name} \uC0DD\uC0B0 \uC608\uC0B0\uC744 \uD655\uBCF4\uD558\uACE0 \uC788\uC0AC\uC640\uC694.`,
      productionReservation: { ...plan.reservation, reasons: [...plan.reservation.reasons] },
      factors: [...plan.reservation.reasons]
    });
    return;
  }
  const previousPlan = state.productionReservation;
  delete state.productionReservation;
  const choice = plan.choice;
  if (previousPlan && choice?.unitTypeId !== previousPlan.unitTypeId) write("production-plan", {
    side: state.side,
    text: `${state.player.name} \uC120\uC218\uAC00 ${getZeroUnit(previousPlan.unitTypeId).name} \uC0DD\uC0B0 \uC608\uC57D\uC744 \uD480\uACE0 \uD604\uC7AC \uC804\uD669\uC5D0 \uB300\uC751\uD588\uC0AC\uC640\uC694.`,
    factors: ["\uD604\uC7AC \uC790\uC6D0\xB7\uBCD1\uB825\xB7\uAD00\uCE21 \uAE30\uC5B5\uC73C\uB85C \uACC4\uD68D \uC7AC\uD3C9\uAC00"]
  });
  if (!choice) return;
  const unit = getZeroUnit(choice.unitTypeId), count = choice.count;
  state.metrics.minerals = round(state.metrics.minerals - unit.minerals * count);
  state.metrics.gas = round(state.metrics.gas - unit.gas * count);
  const squad = makeSquad(state, unit.id, count);
  state.squads.push(squad);
  state.produced += count;
  recalculateArmyValue(state);
  write("production", {
    side: state.side,
    action: "produce",
    squadId: squad.id,
    unitTypeId: unit.id,
    count,
    text: `${state.player.name} \uC120\uC218\uAC00 ${unit.name} ${count}\uAE30\uB97C \uC0DD\uC0B0\uD588\uC0AC\uC640\uC694.`,
    productionChoice: choice,
    factors: [`\uC0DD\uC0B0 \uBE44\uC6A9 \uAD11\uBB3C ${unit.minerals * count}`, `\uAC00\uC2A4 ${unit.gas * count}`, ...choice.reasons]
  });
}
function scoutingUnit(state) {
  return combatSquads(state).filter(zeroDeployed).slice().sort((a, b) => {
    const unitA = getZeroUnit(a.unitTypeId);
    const unitB = getZeroUnit(b.unitTypeId);
    return unitB.speed - unitA.speed || b.count - a.count || a.id.localeCompare(b.id);
  })[0];
}
function performScout(state, physics, write) {
  const squad = scoutingUnit(state);
  if (!squad) return;
  const unit = getZeroUnit(squad.unitTypeId);
  write("scouting", {
    side: state.side,
    action: "scout",
    squadId: squad.id,
    unitTypeId: unit.id,
    count: squad.count,
    text: `${unit.name} \uBD80\uB300\uC5D0 \uC6B0\uD68C\uB85C \uC815\uCC30\uC744 \uC9C0\uC2DC\uD588\uC0AC\uC640\uC694.`,
    factors: [`\uD604\uC7AC \uAE30\uC5B5 \uC2E0\uB8B0\uB3C4 ${round(state.metrics.intel)}%`, `\uB9F5 \uBCF5\uC7A1\uB3C4 ${physics.complexity}`, "\uB3C4\uCC29 \uC704\uCE58\uC5D0\uC11C \uAD00\uCE21 \uAC00\uB2A5\uD55C \uC801\uB9CC \uC815\uBCF4\uB97C \uAC31\uC2E0"]
  });
}
function performExpansion(state, physics, write) {
  const mineralCost = ZERO_EXPANSION_MINERALS;
  if (state.metrics.minerals < mineralCost) {
    write("expansion", {
      side: state.side,
      action: "expand",
      text: `${state.player.name} \uC120\uC218\uAC00 \uC790\uC6D0 \uBD80\uC871\uC73C\uB85C \uCD94\uAC00 \uAC70\uC810 \uACC4\uD68D\uC744 \uBCF4\uB958\uD588\uC0AC\uC640\uC694.`,
      factors: [`\uD544\uC694 \uAD11\uBB3C ${mineralCost}`, `\uBCF4\uC720 \uAD11\uBB3C ${round(state.metrics.minerals)}`]
    });
    return;
  }
  state.metrics.minerals -= mineralCost;
  state.expansions += 1;
  const resourceYield = zeroExpansionIncome(physics.resources);
  state.metrics.income = round(state.metrics.income + resourceYield);
  state.metrics.mapControl = clamp4(state.metrics.mapControl + 3.5, 0, 100);
  write("expansion", {
    side: state.side,
    action: "expand",
    text: `${state.player.name} \uC120\uC218\uAC00 ${state.expansions + 1}\uBC88\uC9F8 \uC790\uC6D0 \uAC70\uC810\uC744 \uD655\uBCF4\uD588\uC0AC\uC640\uC694.`,
    factors: [`\uB9F5 \uC790\uC6D0\uB7C9 ${physics.resources}`, `\uC218\uC785 +${round(resourceYield)}`]
  });
}
function performTechnology(state, rng, write) {
  const mineralCost = 60;
  const gasCost = 50;
  if (state.metrics.minerals < mineralCost || state.metrics.gas < gasCost) {
    write("technology", {
      side: state.side,
      action: "tech",
      text: `${state.player.name} \uC120\uC218\uAC00 \uC790\uC6D0 \uBD80\uC871\uC73C\uB85C \uAE30\uC220 \uC804\uD658 \uC2DC\uC810\uC744 \uB2A6\uCDC4\uC0AC\uC640\uC694.`,
      factors: [
        `\uD544\uC694 \uAD11\uBB3C/\uAC00\uC2A4 ${mineralCost}/${gasCost}`,
        `\uBCF4\uC720 \uAD11\uBB3C/\uAC00\uC2A4 ${round(state.metrics.minerals)}/${round(state.metrics.gas)}`
      ]
    });
    return;
  }
  state.metrics.minerals -= mineralCost;
  state.metrics.gas -= gasCost;
  const gain = 20 + normalizedStat(state.player, "strategy") * 12 + rng.next() * 3;
  state.metrics.tech = clamp4(state.metrics.tech + gain, 0, 100);
  const unlocked = state.metrics.tech >= 68 ? "\uCD5C\uC885 \uBCD1\uAE30" : state.metrics.tech >= 32 ? "\uC911\uAE09 \uBCD1\uB825" : "\uAE30\uCD08 \uC5C5\uADF8\uB808\uC774\uB4DC";
  write("technology", {
    side: state.side,
    action: "tech",
    text: `${state.player.name} \uC120\uC218\uAC00 ${unlocked} \uAE30\uC220\uC744 \uC9C4\uC804\uC2DC\uCF30\uC0AC\uC640\uC694.`,
    factors: [`\uAE30\uC220 \uC218\uC900 ${round(state.metrics.tech)}%`]
  });
}
function performDefense(state, write) {
  const gain = 3 + normalizedStat(state.player, "defense") * 5;
  state.metrics.baseIntegrity = round(clamp4(state.metrics.baseIntegrity + gain, 0, 100));
  state.metrics.momentum = clamp4(state.metrics.momentum + 2, -100, 100);
  state.squads = state.squads.map((squad) => {
    if (!zeroDeployed(squad) || getZeroUnit(squad.unitTypeId).role === "worker") return squad;
    return { ...healZeroSquad(squad, 0.04), status: "idle" };
  });
  recalculateArmyValue(state);
  write("movement", {
    side: state.side,
    action: "defend",
    text: `${state.player.name} \uC120\uC218\uAC00 \uBC29\uC5B4\uC120\uC744 \uC7AC\uC815\uBE44\uD558\uACE0 \uBCF8\uC9C4 \uC55E \uC7AC\uBC30\uCE58\uB97C \uC9C0\uC2DC\uD588\uC0AC\uC640\uC694.`,
    factors: [
      `\uBC29\uC5B4 ${round(stat(state.player, "defense"))}`,
      `\uBCF8\uC9C4 \uB0B4\uAD6C\uB3C4 ${round(state.metrics.baseIntegrity)}%`
    ]
  });
}
function applyAction(state, action, physics, frameIndex, rng, write, remainingIntervals, openingProductionAction, preserveOpeningScout = false) {
  state.actionCounts[action] += 1;
  if (action === "scout" || preserveOpeningScout) performScout(state, physics, write);
  if (action === "expand") performExpansion(state, physics, write);
  if (action === "tech") performTechnology(state, rng, write);
  if (action === "defend") performDefense(state, write);
  if (action === "produce" || action === "rush" || frameIndex % 2 === 0) {
    produceUnits(state, openingProductionAction ?? action, frameIndex, rng, write, physics, remainingIntervals);
  }
}
function combatPower(state, assessment, rng) {
  const execution = 0.72 + normalizedStat(state.player, "control") * 0.22 + normalizedStat(state.player, "strategy") * 0.1 + normalizedStat(state.player, "sense") * 0.07;
  const information = 0.92 + state.metrics.intel * 15e-4;
  const territory = 0.92 + state.metrics.mapControl * 16e-4;
  const condition = 0.9 + conditionFactor(state.player) * 0.1;
  const attackExecution = 0.85 + normalizedStat(state.player, "attack") * 0.3;
  return assessment.effectivePower * execution * information * territory * condition * attackExecution * (0.9 + rng.next() * 0.2);
}
function applyLosses(state, damageBudget, incoming, write) {
  const resolved = resolveZeroDamage(state.squads, incoming, damageBudget);
  state.squads = resolved.squads;
  const casualties = resolved.casualties;
  const applied = casualties.reduce((sum, c) => sum + c.count, 0);
  for (const casualty of casualties) {
    const squad = state.squads.find((candidate) => candidate.id === casualty.squadId);
    if (squad.count === 0) {
      const unit = getZeroUnit(squad.unitTypeId);
      write("destruction", {
        side: state.side,
        squadId: squad.id,
        unitTypeId: squad.unitTypeId,
        count: casualty.count,
        deathPosition: { x: squad.x, y: squad.y },
        text: `${unit.name} \uBD80\uB300\uAC00 \uAD50\uC804\uC5D0\uC11C \uC804\uBA78\uD588\uC0AC\uC640\uC694.`
      });
    }
  }
  state.lost += applied;
  state.squads = state.squads.filter((squad) => squad.count > 0);
  const cargoLoss = removeZeroLostCargo(state.squads);
  state.squads = cargoLoss.squads;
  for (const passenger of cargoLoss.lost) {
    state.lost += passenger.count;
    write("destruction", {
      side: state.side,
      squadId: passenger.id,
      unitTypeId: passenger.unitTypeId,
      count: passenger.count,
      deathPosition: { x: passenger.x, y: passenger.y },
      text: `${getZeroUnit(passenger.unitTypeId).name} ${passenger.count}\uAE30\uAC00 \uC218\uC1A1\uC120 \uACA9\uCD94\uB85C \uD568\uAED8 \uC190\uC2E4\uB410\uC0AC\uC640\uC694.`,
      factors: [`\uACA9\uCD94\uB41C \uC218\uC1A1\uC120 ${passenger.embarkedOn}`, "\uD0D1\uC2B9 \uC911 \uAC04\uC811 \uC190\uC2E4 / \uC9C0\uC0C1 \uACF5\uACA9 \uD53C\uD574\uC640 \uC911\uBCF5 \uCC28\uAC10\uD558\uC9C0 \uC54A\uC74C"]
    });
  }
  casualties.push(...cargoLoss.casualties);
  recalculateArmyValue(state);
  return { casualties, damage: resolved.records };
}
function frontSquad(state) {
  return combatSquads(state).filter(zeroDeployed).slice().sort((a, b) => {
    const aPosition = state.side === "home" ? a.x : 1 - a.x;
    const bPosition = state.side === "home" ? b.x : 1 - b.x;
    return bPosition - aPosition || b.count - a.count || a.id.localeCompare(b.id);
  })[0];
}
function resolveEngagement(home, away, physics, rng, write, decisive) {
  const homeArmy = combatSquads(home).filter(zeroDeployed), awayArmy = combatSquads(away).filter(zeroDeployed);
  const contact = (a, b) => zeroSquadDistance(physics.battlefield, a, b) <= Math.max(zeroCombatReach(a), zeroCombatReach(b));
  const homeFront = homeArmy.find((a) => awayArmy.some((b) => contact(a, b)));
  const awayFront = awayArmy.find((b) => homeArmy.some((a) => contact(a, b)));
  if (!homeFront || !awayFront) return;
  const positions = [...combatSquads(home), ...combatSquads(away)].map(cloneZeroSquad);
  const homeAssessment = assessZeroArmy(home.squads, away.squads, physics.complexity, physics.battlefield);
  const awayAssessment = assessZeroArmy(away.squads, home.squads, physics.complexity, physics.battlefield);
  for (const [state, assessment] of [[home, homeAssessment], [away, awayAssessment]]) for (const use of assessment.abilities) {
    const caster = state.squads.find((squad) => squad.id === use.squadId);
    caster.energy = use.energyAfter;
    write("ability", {
      side: state.side,
      squadId: caster.id,
      unitTypeId: caster.unitTypeId,
      count: caster.count,
      abilityUse: use,
      text: `${getZeroUnit(caster.unitTypeId).name} \uBD80\uB300\uAC00 ${ZERO_ABILITIES[use.abilityId].name}\uC744 \uC0AC\uC6A9\uD588\uC0AC\uC640\uC694.`,
      factors: [`\uC5D0\uB108\uC9C0 ${use.energyBefore} \u2192 ${use.energyAfter}`, `\uB300\uC0C1 ${use.targets.join(", ")}`, "\uC774\uBC88 \uAD50\uC804 \uAD6C\uAC04\uC758 \uB300\uD45C \uAE30\uC220 \uD6A8\uACFC"]
    });
  }
  const intensity = decisive ? 0.48 : 0.27;
  const homePacket = zeroDamageAssessment(homeAssessment, intensity), awayPacket = zeroDamageAssessment(awayAssessment, intensity);
  const homePower = combatPower(home, homePacket, rng);
  const awayPower = combatPower(away, awayPacket, rng);
  if (homePower <= 0 && awayPower <= 0) {
    for (const state of [home, away]) for (const squad of combatSquads(state)) squad.status = "idle";
    write("standoff", {
      text: "\uC591\uCE21 \uBAA8\uB450 \uACF5\uACA9 \uAC00\uB2A5\uD55C \uD45C\uC801\uC774 \uC5C6\uC5B4 \uD53C\uD574 \uC5C6\uC774 \uB300\uCE58\uD588\uC0AC\uC640\uC694.",
      losses: { home: 0, away: 0 },
      factors: ["\uC720\uD6A8 \uACF5\uACA9\uB825 \uD648 0 / \uC6D0\uC815 0", "\uAE30\uC138\xB7\uB9F5 \uC7A5\uC545\xB7\uBCF8\uC9C4 \uB0B4\uAD6C\uB3C4 \uBCC0\uD654 \uC5C6\uC74C"],
      combat: {
        home: { ...homeAssessment, resolvedPower: 0 },
        away: { ...awayAssessment, resolvedPower: 0 },
        casualties: { home: [], away: [] },
        positions
      }
    });
    return;
  }
  const totalPower = Math.max(1, homePower + awayPower);
  const protection = (state) => 0.85 + normalizedStat(state.player, "defense") * 0.3;
  const homeDamage = applyLosses(home, awayPower / protection(home), awayPacket, write);
  const awayDamage = applyLosses(away, homePower / protection(away), homePacket, write);
  const homeCasualties = homeDamage.casualties, awayCasualties = awayDamage.casualties;
  for (const [state, assessment, casualties] of [[home, homeAssessment, homeCasualties], [away, awayAssessment, awayCasualties]]) {
    for (const contribution of assessment.contributions) {
      if (contribution.power <= 0 || !getZeroUnit(contribution.unitTypeId).suicide) continue;
      const squad = state.squads.find((candidate) => candidate.id === contribution.squadId);
      if (!squad) continue;
      const before = squad.count;
      casualties.push({ squadId: squad.id, unitTypeId: squad.unitTypeId, count: before, cause: "self-destruction" });
      state.lost += before;
      squad.count = 0;
      squad.health = 0;
      write("destruction", {
        side: state.side,
        squadId: squad.id,
        unitTypeId: squad.unitTypeId,
        count: before,
        deathPosition: { x: squad.x, y: squad.y },
        text: `${getZeroUnit(squad.unitTypeId).name} \uBD80\uB300\uAC00 \uC790\uD3ED \uACF5\uACA9\uC744 \uC644\uB8CC\uD558\uC5EC \uC18C\uBAA8\uB410\uC0AC\uC640\uC694.`,
        factors: ["\uC790\uD3ED \uC18C\uBAA8", "\uAC19\uC740 \uAD50\uC804\uC758 \uBC18\uACA9 \uC190\uC2E4\uACFC \uC911\uBCF5 \uCC28\uAC10\uD558\uC9C0 \uC54A\uC74C"]
      });
    }
    state.squads = state.squads.filter((squad) => squad.count > 0);
    recalculateArmyValue(state);
  }
  const homeLosses = homeCasualties.reduce((sum, casualty) => sum + casualty.count, 0);
  const awayLosses = awayCasualties.reduce((sum, casualty) => sum + casualty.count, 0);
  const homeWon = homePower >= awayPower;
  const winner = homeWon ? home : away;
  const loser = homeWon ? away : home;
  const margin = Math.abs(homePower - awayPower) / totalPower;
  winner.metrics.momentum = clamp4(winner.metrics.momentum + 10 + margin * 30, -100, 100);
  loser.metrics.momentum = clamp4(loser.metrics.momentum - 10 - margin * 30, -100, 100);
  winner.metrics.mapControl = clamp4(winner.metrics.mapControl + 5 + margin * 8, 0, 100);
  loser.metrics.mapControl = clamp4(loser.metrics.mapControl - 5 - margin * 8, 0, 100);
  const homeUnit = getZeroUnit(homeFront.unitTypeId);
  const awayUnit = getZeroUnit(awayFront.unitTypeId);
  const winnerFront = frontSquad(winner);
  const received = loser.side === "home" ? homeDamage.damage : awayDamage.damage;
  const retreating = combatSquads(loser).filter((squad) => {
    const wound = received.find((entry) => entry.squadId === squad.id);
    const before = positions.find((entry) => entry.id === squad.id);
    if (!wound || !before || wound.damage <= 0) return false;
    const initialHp = before.count * before.health * getZeroUnit(before.unitTypeId).durability;
    return wound.damage >= initialHp * 0.3 || squad.health < 0.35;
  });
  write("engagement", {
    side: winner.side,
    action: decisive ? "counter" : "rush",
    squadId: winnerFront?.id,
    unitTypeId: winnerFront?.unitTypeId,
    count: winnerFront?.count,
    losses: { home: homeLosses, away: awayLosses },
    text: winnerFront ? `${homeUnit.name}\xB7${awayUnit.name} \uB4F1\uC774 \uD3B8\uC131\uB41C \uBD80\uB300\uC758 \uAD50\uC804\uC5D0\uC11C ${getZeroUnit(winnerFront.unitTypeId).name} \uC794\uC874 \uBD80\uB300\uB97C \uBCF4\uC720\uD55C ${winner.player.name} \uC120\uC218\uAC00 \uC8FC\uB3C4\uAD8C\uC744 \uC7A1\uC558\uC0AC\uC640\uC694.` : `${homeUnit.name}\xB7${awayUnit.name} \uB4F1\uC774 \uAD50\uC804\uD588\uACE0 ${winner.player.name} \uC120\uC218\uAC00 \uC804\uD22C\uB825 \uC6B0\uC704\uB97C \uAE30\uB85D\uD588\uC9C0\uB9CC \uC794\uC874 \uBCD1\uB825\uC740 \uC5C6\uC0AC\uC640\uC694.`,
    combat: {
      home: { ...homeAssessment, resolvedPower: homePower },
      away: { ...awayAssessment, resolvedPower: awayPower },
      casualties: { home: homeCasualties, away: awayCasualties },
      damage: { home: homeDamage.damage, away: awayDamage.damage },
      positions
    },
    factors: [
      `\uD648 \uC804\uD22C\uB825 ${round(homePower)}`,
      `\uC6D0\uC815 \uC804\uD22C\uB825 ${round(awayPower)}`,
      `\uD648 \uD45C\uC801 \uB300\uC751\uB960 ${round(homeAssessment.targetCoverage * 100)}% / \uC6D0\uC815 ${round(awayAssessment.targetCoverage * 100)}%`,
      `\uC5ED\uD560 \uC0C1\uC131 \uBC30\uC728 \uD648 ${round(homeAssessment.roleMultiplier, 3)} / \uC6D0\uC815 ${round(awayAssessment.roleMultiplier, 3)}`,
      `\uC9C0\uC6D0 \uC9C0\uC18D\uB825 \uBCF4\uC815 \uD648 +${round(homeAssessment.supportBonus * 100)}% / \uC6D0\uC815 +${round(awayAssessment.supportBonus * 100)}%`,
      `\uACF5\uACA9 \uBD88\uAC00 \uBCD1\uB825 \uD648 ${homeAssessment.blockedCount}\uAE30 / \uC6D0\uC815 ${awayAssessment.blockedCount}\uAE30`,
      `\uBBF8\uD0D0\uC9C0 \uC0C1\uB300 \uBCD1\uB825 \uD648 ${homeAssessment.undetectedCount}\uAE30 / \uC6D0\uC815 ${awayAssessment.undetectedCount}\uAE30`,
      `\uC190\uC2E4 \uD648 ${homeLosses} / \uC6D0\uC815 ${awayLosses}`,
      `\uC2E4\uC81C \uCCB4\uB825 \uD53C\uD574 \uD648 ${round(homeDamage.damage.reduce((sum, d) => sum + d.damage, 0))} / \uC6D0\uC815 ${round(awayDamage.damage.reduce((sum, d) => sum + d.damage, 0))}`,
      `\uC9C0\uC18D \uC0AC\uACA9 \uAD6C\uAC04 \uACC4\uC218 ${intensity} / \uC5D0\uB108\uC9C0\uB97C \uC18C\uBE44\uD55C \uC21C\uAC04 \uAE30\uC220 \uD53C\uD574 \uD648 ${round(homeAssessment.burstPower ?? 0)} / \uC6D0\uC815 ${round(awayAssessment.burstPower ?? 0)}`,
      `\uACF5\uACA9 \uC2E4\uD589/\uBC29\uC5B4 \uC644\uCDA9: \uD648 ${round(0.85 + normalizedStat(home.player, "attack") * 0.3, 3)}/${round(protection(home), 3)}, \uC6D0\uC815 ${round(0.85 + normalizedStat(away.player, "attack") * 0.3, 3)}/${round(protection(away), 3)}`,
      `\uD1F4\uAC01 \uAC00\uB2A5 \uBD80\uB300 ${retreating.length}`,
      `${sideName(loser.side)} \uBCF8\uC9C4 \uB0B4\uAD6C\uB3C4 ${round(loser.metrics.baseIntegrity)}%`
    ]
  });
  const retreatLead = retreating[0];
  for (const squad of retreating) {
    squad.status = "retreating";
    if (squad === retreatLead) {
      const unit = getZeroUnit(squad.unitTypeId);
      write("retreat", {
        side: loser.side,
        squadId: squad.id,
        unitTypeId: squad.unitTypeId,
        count: squad.count,
        text: `${unit.name} \uC794\uC874 \uBD80\uB300\uAC00 \uBC29\uC5B4\uC120\uC73C\uB85C \uD6C4\uD1F4\uB97C \uC2DC\uC791\uD588\uC0AC\uC640\uC694.`
      });
    }
  }
}
function resolveFieldPressures(states, actions, physics, write) {
  const plan = (side) => planZeroFieldPressure(
    states[side].squads,
    side,
    physics.battlefield,
    actions[side],
    normalizedStat(states[side].player, "attack"),
    normalizedStat(states[side].player, "harass"),
    states[side].metrics.intel,
    physics.complexity
  );
  const plans = { home: plan("home"), away: plan("away") };
  for (const side of SIDES) states[side].metrics.mapControl = clamp4(states[side].metrics.mapControl + plans[side].mapShift - plans[opponentOf(side)].mapShift, 0, 100);
  for (const side of SIDES) {
    const pressure = plans[side], defender = states[opponentOf(side)];
    const before = defender.metrics.income;
    defender.metrics.income = Math.max(Math.min(12, before), before - pressure.incomeDamage);
    if (!pressure.mapShift && before === defender.metrics.income) continue;
    write("field-pressure", {
      side,
      action: actions[side],
      text: `${states[side].player.name} \uC120\uC218\uC758 \uB3C4\uCC29 \uBCD1\uB825\uC774 ${before > defender.metrics.income ? "\uC0C1\uB300 \uBCF8\uC9C4 \uACBD\uC81C\uB97C \uACAC\uC81C\uD588\uC0AC\uC640\uC694." : "\uC0C1\uB300 \uC9C4\uC601\uC5D0\uC11C \uC804\uC120\uC744 \uC555\uBC15\uD588\uC0AC\uC640\uC694."}`,
      fieldPressure: {
        territory: pressure.territory.map((squad) => ({ ...squad })),
        raiders: pressure.raiders.map((squad) => ({ ...squad })),
        attemptedMapShift: pressure.mapShift,
        incomeBefore: before,
        incomeAfter: defender.metrics.income
      },
      factors: [
        `\uC0C1\uB300 \uC9C4\uC601 \uC555\uBC15 \uBD80\uB300 ${pressure.territory.map((squad) => squad.id).join(", ") || "\uC5C6\uC74C"}`,
        `\uBCF8\uC9C4 \uACBD\uC81C \uB3C4\uB2EC \uBD80\uB300 ${pressure.raiders.map((squad) => squad.id).join(", ") || "\uC5C6\uC74C"}`,
        `\uC0C1\uB300 \uC218\uC785 ${round(before)} \u2192 ${round(defender.metrics.income)}`,
        `\uB9F5 \uC555\uBC15 ${round(pressure.mapShift)} (\uC591\uCE21 \uC555\uBC15\uC758 \uCC28\uC774\uB97C \uB3D9\uC2DC \uBC18\uC601)`
      ]
    });
  }
}
function resolveBasePressure(attacker, defender, physics, write) {
  const attackers = zeroBaseAttackers(attacker.squads, attacker.side, physics.battlefield);
  if (!attackers.length) return;
  const assessment = assessZeroBaseAttack(attackers, normalizedStat(attacker.player, "attack"), normalizedStat(defender.player, "defense"));
  const damage = assessment.damage;
  const before = defender.metrics.baseIntegrity;
  defender.metrics.baseIntegrity = round(clamp4(before - damage, 0, 100));
  if (before === defender.metrics.baseIntegrity) return;
  const spent = attackers.filter((squad) => getZeroUnit(squad.unitTypeId).suicide).map((squad) => ({ squadId: squad.id, unitTypeId: squad.unitTypeId, count: squad.count, cause: "self-destruction" }));
  write("base-attack", {
    side: attacker.side,
    text: `${attacker.player.name} \uC120\uC218\uC758 \uB3C4\uCC29 \uBCD1\uB825\uC774 \uC0C1\uB300 \uBCF8\uC9C4\uC744 \uACF5\uACA9\uD588\uC0AC\uC640\uC694.`,
    baseAttack: {
      defender: defender.side,
      attackers: attackers.map((squad) => ({ ...squad })),
      before,
      after: defender.metrics.baseIntegrity,
      damage: before - defender.metrics.baseIntegrity,
      spent,
      sustainedPower: assessment.sustainedPower,
      burstPower: assessment.burstPower,
      armorMultiplier: assessment.armorMultiplier
    },
    factors: [
      `\uACF5\uACA9 \uBD80\uB300 ${attackers.map((squad) => squad.id).join(", ")}`,
      `\uBCF8\uC9C4 \uB0B4\uAD6C\uB3C4 ${round(before)} \u2192 ${round(defender.metrics.baseIntegrity)}`,
      `\uC9C0\uC18D \uC0AC\uACA9 ${round(assessment.sustainedPower)} \xD7 0.27 / \uC77C\uD68C\uC131 \uC790\uD3ED ${round(assessment.burstPower)} / \uBC29\uC5B4 \uBC30\uC728 ${round(assessment.armorMultiplier, 3)}`
    ]
  });
  for (const loss of spent) {
    const squad = attacker.squads.find((candidate) => candidate.id === loss.squadId);
    write("destruction", {
      side: attacker.side,
      squadId: squad.id,
      unitTypeId: squad.unitTypeId,
      count: squad.count,
      deathPosition: { x: squad.x, y: squad.y },
      text: `${getZeroUnit(squad.unitTypeId).name} \uBD80\uB300\uAC00 \uBCF8\uC9C4 \uC790\uD3ED \uACF5\uACA9\uC73C\uB85C \uC18C\uBAA8\uB410\uC0AC\uC640\uC694.`
    });
    attacker.lost += squad.count;
    squad.count = 0;
    squad.health = 0;
  }
  attacker.squads = attacker.squads.filter((squad) => squad.count > 0);
  recalculateArmyValue(attacker);
}
function phaseFor(frameIndex, decisionCount) {
  if (frameIndex === decisionCount - 1) return "finished";
  if (frameIndex === 0) return "opening";
  const progress = frameIndex / Math.max(1, decisionCount - 1);
  if (progress < 0.34) return "early";
  if (progress < 0.69) return "mid";
  return "late";
}
function strengthBreakdown(state) {
  const s = state.player;
  return {
    attack: normalizedStat(s, "attack") * 12,
    defense: normalizedStat(s, "defense") * 10,
    strategy: normalizedStat(s, "strategy") * 13 + normalizedStat(s, "sense") * 8,
    control: normalizedStat(s, "control") * 12,
    economy: Math.log1p(state.metrics.minerals + state.metrics.gas * 1.35) * 7 + state.metrics.income * 0.42,
    army: Math.log1p(state.metrics.armyValue) * 19,
    tech: state.metrics.tech * 0.42,
    intel: state.metrics.intel * 0.16,
    mapControl: state.metrics.mapControl * 0.3,
    momentum: state.metrics.momentum * 0.25,
    baseIntegrity: state.metrics.baseIntegrity * 0.36
  };
}
function finalStrength(state) {
  return finite(
    Object.values(strengthBreakdown(state)).reduce((sum, value) => sum + value, 0),
    0
  );
}
function verdictFrom(states, rng) {
  const scores = { home: finalStrength(states.home), away: finalStrength(states.away) };
  const baseIntegrity = { home: states.home.metrics.baseIntegrity, away: states.away.metrics.baseIntegrity };
  const homeDestroyed = baseIntegrity.home <= 0, awayDestroyed = baseIntegrity.away <= 0;
  if (homeDestroyed !== awayDestroyed) return { winner: homeDestroyed ? "away" : "home", reason: "base-destruction", tieBreak: false, scores, baseIntegrity };
  const tieBreak = Math.abs(scores.home - scores.away) < 1e-6;
  const winner = tieBreak ? rng.next() < 0.5 ? "home" : "away" : scores.home > scores.away ? "home" : "away";
  return { winner, reason: homeDestroyed ? "mutual-base-destruction" : "score", tieBreak, scores, baseIntegrity };
}
function makeCauses(states, winnerSide) {
  const winner = states[winnerSide];
  const loser = states[opponentOf(winnerSide)];
  if (loser.metrics.baseIntegrity <= 0 && winner.metrics.baseIntegrity > 0) return [
    {
      side: winnerSide,
      label: "\uC0C1\uB300 \uBCF8\uC9C4 \uD30C\uAD34",
      impact: 1,
      detail: "\uC2E4\uC81C \uACF5\uACA9 \uAC70\uB9AC\uC5D0 \uB3C4\uB2EC\uD55C \uBCD1\uB825\uC774 \uC0C1\uB300 \uBCF8\uC9C4 \uB0B4\uAD6C\uB3C4\uB97C 0\uC73C\uB85C \uB9CC\uB4E4\uC5C8\uC0AC\uC640\uC694. \uC774\uAC83\uC774 \uACB0\uC815\uC801\uC778 \uC2B9\uB9AC \uC870\uAC74\uC774\uB78D\uB2C8\uB2E4."
    },
    {
      side: winnerSide,
      label: "\uC790\uAE30 \uBCF8\uC9C4 \uC0DD\uC874",
      impact: 0,
      detail: `\uAC19\uC740 \uAD50\uC804 \uAD6C\uAC04 \uC885\uB8CC \uC2DC \uC790\uAE30 \uBCF8\uC9C4 \uB0B4\uAD6C\uB3C4\uB294 ${round(winner.metrics.baseIntegrity)}\uC600\uC0AC\uC640\uC694. \uB3D9\uC2DC \uD30C\uAD34\uAC00 \uC544\uB2C8\uB78D\uB2C8\uB2E4.`
    },
    {
      side: winnerSide,
      label: "\uC810\uC218 \uD310\uC815 \uBBF8\uC0AC\uC6A9",
      impact: 0,
      detail: `\uC885\uD569 \uC810\uC218 ${round(finalStrength(winner), 4)} \uB300 ${round(finalStrength(loser), 4)}\uB294 \uCC38\uACE0 \uC815\uBCF4\uC774\uBA70 \uC774\uBC88 \uC2B9\uD328\uC5D0\uB294 \uC4F0\uC9C0 \uC54A\uC558\uC0AC\uC640\uC694.`
    }
  ];
  const winnerStrength = strengthBreakdown(winner);
  const loserStrength = strengthBreakdown(loser);
  const contribution = (key) => winnerStrength[key] - loserStrength[key];
  const candidates = [
    {
      side: winnerSide,
      label: "\uBCD1\uB825 \uC6B0\uC138",
      detail: `${winner.player.name} \uC120\uC218\uAC00 \uCD5C\uC885 \uBCD1\uB825 \uAC00\uCE58 ${round(winner.metrics.armyValue)} \uB300 ${round(loser.metrics.armyValue)}\uC758 \uC804\uC120\uC744 \uB9CC\uB4E4\uC5C8\uC0AC\uC640\uC694.`,
      rawImpact: contribution("army"),
      impact: 0
    },
    {
      side: winnerSide,
      label: "\uACBD\uC81C \uC6B4\uC601",
      detail: `\uC218\uC785\uACFC \uC794\uC5EC \uC790\uC6D0\uC758 \uC2B9\uD328 \uAE30\uC5EC \uC810\uC218\uAC00 ${round(winnerStrength.economy)} \uB300 ${round(loserStrength.economy)}\uC600\uC0AC\uC640\uC694.`,
      rawImpact: contribution("economy"),
      impact: 0
    },
    {
      side: winnerSide,
      label: "\uAE30\uC220 \uC804\uD658",
      detail: `\uAE30\uC220 \uC218\uC900 ${round(winner.metrics.tech)} \uB300 ${round(loser.metrics.tech)}\uB85C \uBCD1\uB825 \uC120\uD0DD\uC758 \uD3ED\uC744 \uD655\uBCF4\uD588\uC0AC\uC640\uC694.`,
      rawImpact: contribution("tech"),
      impact: 0
    },
    {
      side: winnerSide,
      label: "\uC815\uBCF4\uC804",
      detail: `\uC815\uCC30 \uC815\uBCF4 ${round(winner.metrics.intel)} \uB300 ${round(loser.metrics.intel)}\uB85C \uC0C1\uB300 \uC6C0\uC9C1\uC784\uC744 \uB354 \uC815\uD655\uD788 \uC77D\uC5C8\uC0AC\uC640\uC694.`,
      rawImpact: contribution("intel"),
      impact: 0
    },
    {
      side: winnerSide,
      label: "\uB9F5 \uC7A5\uC545",
      detail: `\uCD5C\uC885 \uB9F5 \uC7A5\uC545\uB3C4 ${round(winner.metrics.mapControl)} \uB300 ${round(loser.metrics.mapControl)}\uC600\uC0AC\uC640\uC694.`,
      rawImpact: contribution("mapControl"),
      impact: 0
    },
    {
      side: winnerSide,
      label: "\uAE30\uC138 \uC720\uC9C0",
      detail: `\uB9C8\uC9C0\uB9C9 \uAE30\uC138\uAC00 ${round(winner.metrics.momentum)} \uB300 ${round(loser.metrics.momentum)}\uB85C \uACBD\uAE30 \uB9C8\uAC10 \uC18D\uB3C4\uB97C \uAC08\uB790\uC0AC\uC640\uC694.`,
      rawImpact: contribution("momentum"),
      impact: 0
    },
    {
      side: winnerSide,
      label: "\uBCF8\uC9C4 \uBCF4\uC874",
      detail: `\uBCF8\uC9C4 \uB0B4\uAD6C\uB3C4\uB97C ${round(winner.metrics.baseIntegrity)} \uB300 ${round(loser.metrics.baseIntegrity)}\uB85C \uC9C0\uCF1C\uB0C8\uC0AC\uC640\uC694.`,
      rawImpact: contribution("baseIntegrity"),
      impact: 0
    },
    {
      side: winnerSide,
      label: "\uACF5\uC138 \uC218\uD589",
      detail: `\uACF5\uACA9 \uB2A5\uB825\uC758 \uC2B9\uD328 \uAE30\uC5EC \uC810\uC218\uAC00 ${round(winnerStrength.attack)} \uB300 ${round(loserStrength.attack)}\uC600\uC0AC\uC640\uC694.`,
      rawImpact: contribution("attack"),
      impact: 0
    },
    {
      side: winnerSide,
      label: "\uBC29\uC5B4 \uC218\uD589",
      detail: `\uBC29\uC5B4 \uB2A5\uB825\uC758 \uC2B9\uD328 \uAE30\uC5EC \uC810\uC218\uAC00 ${round(winnerStrength.defense)} \uB300 ${round(loserStrength.defense)}\uC600\uC0AC\uC640\uC694.`,
      rawImpact: contribution("defense"),
      impact: 0
    },
    {
      side: winnerSide,
      label: "\uC804\uB7B5 \uD310\uB2E8",
      detail: `\uC804\uB7B5\xB7\uAC10\uAC01\uC758 \uC2B9\uD328 \uAE30\uC5EC \uC810\uC218\uAC00 ${round(winnerStrength.strategy)} \uB300 ${round(loserStrength.strategy)}\uC600\uC0AC\uC640\uC694.`,
      rawImpact: contribution("strategy"),
      impact: 0
    },
    {
      side: winnerSide,
      label: "\uCEE8\uD2B8\uB864",
      detail: `\uCEE8\uD2B8\uB864\uC758 \uC2B9\uD328 \uAE30\uC5EC \uC810\uC218\uAC00 ${round(winnerStrength.control)} \uB300 ${round(loserStrength.control)}\uC600\uC0AC\uC640\uC694.`,
      rawImpact: contribution("control"),
      impact: 0
    }
  ];
  const selected = candidates.filter((candidate) => candidate.rawImpact > 1e-6).sort((a, b) => b.rawImpact - a.rawImpact || a.label.localeCompare(b.label)).slice(0, 3);
  const winnerTotal = finalStrength(winner);
  const loserTotal = finalStrength(loser);
  const positiveTotal = candidates.reduce((sum, candidate) => sum + Math.max(0, candidate.rawImpact), 0);
  const deficitTotal = candidates.reduce((sum, candidate) => sum + Math.max(0, -candidate.rawImpact), 0);
  const supplementaryWeight = Math.max(1e-6, (selected.at(-1)?.rawImpact ?? positiveTotal) * 0.25);
  const supplementary = [
    {
      side: winnerSide,
      label: "\uC885\uD569 \uC804\uD669 \uD310\uC815",
      detail: `\uACF5\uAC1C \uC9C0\uD45C\uC640 \uC120\uC218 \uB2A5\uB825\uC758 \uB3D9\uC77C\uD55C \uC2B9\uD328\uC2DD\uC744 \uD569\uC0B0\uD55C \uC810\uC218\uAC00 ${round(winnerTotal, 4)} \uB300 ${round(loserTotal, 4)}\uC600\uC0AC\uC640\uC694.`,
      rawImpact: supplementaryWeight,
      impact: 0
    },
    {
      side: winnerSide,
      label: "\uC6B0\uC138 \uC694\uC778 \uACB0\uC9D1",
      detail: `\uC591\uC758 \uAE30\uC5EC ${round(positiveTotal, 4)}\uC640 \uC5F4\uC138 \uAE30\uC5EC ${round(deficitTotal, 4)}\uB97C \uD568\uAED8 \uD569\uC0B0\uD588\uC0AC\uC640\uC694.`,
      rawImpact: supplementaryWeight,
      impact: 0
    },
    {
      side: winnerSide,
      label: "\uACB0\uC815\uB860\uC801 \uB3D9\uB960 \uD310\uC815",
      detail: "\uD575\uC2EC \uC9C0\uD45C\uAC00 \uB3D9\uB960\uC5D0 \uAC00\uAE4C\uC6B4 \uACBD\uC6B0 \uC5D4\uC9C4 \uBC84\uC804\uACFC \uACBD\uAE30 \uC2DC\uB4DC\uC758 \uACE0\uC815 \uC21C\uC11C\uB85C \uC2B9\uC790\uB97C \uC7AC\uD604\uD588\uC0AC\uC640\uC694.",
      rawImpact: supplementaryWeight,
      impact: 0
    }
  ];
  for (const fallback of supplementary) {
    if (selected.length >= 3) break;
    if (!selected.some((candidate) => candidate.label === fallback.label)) selected.push(fallback);
  }
  const weights = selected.map((candidate) => candidate.rawImpact);
  const total = weights.reduce((sum, value) => sum + value, 0);
  return selected.map(({ rawImpact: _rawImpact, ...cause }, index) => ({
    ...cause,
    impact: round(weights[index] / total, 4)
  }));
}
function assertValidInput(input) {
  if (!input || typeof input !== "object") throw new Error("\uC81C\uB85C \uC5D4\uC9C4 \uC785\uB825\uC774 \uD544\uC694\uD558\uC640\uC694.");
  if (!input.home?.player || !input.away?.player) throw new Error("\uC591\uCABD \uC120\uC218\uAC00 \uBAA8\uB450 \uD544\uC694\uD558\uC640\uC694.");
  if (!input.home?.team || !input.away?.team) throw new Error("\uC591\uCABD \uD300\uC774 \uBAA8\uB450 \uD544\uC694\uD558\uC640\uC694.");
  if (!input.map || typeof input.map.id !== "string" || input.map.id.length === 0) {
    throw new Error("\uC720\uD6A8\uD55C \uACBD\uAE30 \uB9F5\uC774 \uD544\uC694\uD558\uC640\uC694.");
  }
  if (!["T", "Z", "P"].includes(input.home.player.race)) throw new Error("\uD648 \uC120\uC218\uC758 \uC885\uC871\uC774 \uC798\uBABB\uB418\uC5C8\uC0AC\uC640\uC694.");
  if (!["T", "Z", "P"].includes(input.away.player.race)) throw new Error("\uC6D0\uC815 \uC120\uC218\uC758 \uC885\uC871\uC774 \uC798\uBABB\uB418\uC5C8\uC0AC\uC640\uC694.");
}
function simulateZeroMatch(input) {
  assertValidInput(input);
  const preparations = validateZeroPreparations(input);
  const seed = String(input.seed ?? "");
  const randomRoot = `zero-engine|${ZERO_RANDOM_VERSION}|${seed}|${input.map.id}|${input.home.player.id}|${input.away.player.id}`;
  const rng = createRng(`${randomRoot}|verdict`);
  const frameRng = (frame, phase) => createRng(`${randomRoot}|${frame}|${phase}`);
  const decisionCount = Math.floor(clamp4(finite(input.maxDecisions, DEFAULT_DECISIONS), 10, 20));
  const physics = createMapPhysics(input);
  const states = {
    home: createSideState("home", input.home, physics),
    away: createSideState("away", input.away, physics)
  };
  const events = [];
  const frames = [];
  let finalCauses;
  let finalVerdict;
  let sequence = 0;
  for (let frameIndex = 0; frameIndex < decisionCount; frameIndex += 1) {
    const existingIds = new Set(SIDES.flatMap((side) => states[side].squads.map((squad) => squad.id)));
    const timeSec = Math.round(frameIndex * physics.frameSeconds);
    const frameEvents = [];
    const write = (kind, details) => {
      sequence += 1;
      const event = {
        id: `zero-event-${String(sequence).padStart(4, "0")}`,
        sequence,
        timeSec,
        kind,
        ...Object.fromEntries(Object.entries(details).filter(([, value]) => value !== void 0))
      };
      events.push(event);
      frameEvents.push(event);
      return event;
    };
    if (frameIndex === 0) {
      for (const side of SIDES) {
        const state = states[side];
        const opening = initialCombatUnit(state.player.race);
        const unit = getZeroUnit(opening.unitTypeId);
        write("opening", {
          side,
          action: "produce",
          unitTypeId: unit.id,
          count: opening.count,
          text: `${sideName(side)} ${state.player.name} \uC120\uC218\uB294 ${unit.name} \uC911\uC2EC\uC758 \uCD9C\uBC1C\uC744 \uC120\uD0DD\uD588\uC0AC\uC640\uC694.`,
          factors: [`\uC885\uC871 ${state.player.race}`, `\uCD08\uAE30 \uBCD1\uB825 ${opening.count}`]
        });
      }
      const mapBias = physics.matchupBiasForHome;
      const favoredSide = Math.abs(mapBias) <= 1e-6 ? void 0 : mapBias > 0 ? "home" : "away";
      write("map-effect", {
        side: favoredSide,
        text: favoredSide ? `${input.map.name}\uC758 ${physics.matchup} \uBCF4\uC815\uC774 ${sideName(favoredSide)} \uC9C4\uC601\uC758 \uACF5\uAC1C \uC804\uD669 \uC9C0\uD45C\uC5D0 \uBC18\uC601\uB410\uC0AC\uC640\uC694.` : `${input.map.name}\uC758 ${physics.matchup} \uBCF4\uC815\uC740 \uC911\uB9BD\uC774\uBA70 \uBB3C\uB9AC \uB9F5 \uC218\uCE58\uB9CC \uC801\uC6A9\uB410\uC0AC\uC640\uC694.`,
        factors: [
          `\uC885\uC871\uC804 \uBCF4\uC815 ${round(mapBias, 4)}`,
          `\uB7EC\uC2DC \uAC70\uB9AC ${physics.rushDistance}`,
          `\uC790\uC6D0\uB7C9 ${physics.resources}`,
          `\uBCF5\uC7A1\uB3C4 ${physics.complexity}`
        ]
      });
    }
    for (const side of SIDES) {
      advanceUnitEnergy(states[side], frameIndex, write);
      accrueResources(states[side], physics, frameIndex, write);
    }
    applyPhysicalMapEffects(states, physics);
    const isFinalFrame = frameIndex === decisionCount - 1;
    const decisions = {
      home: chooseZeroAction({ ...states.home, frameIndex, remainingIntervals: decisionCount - frameIndex - 1, preparation: preparations.home }, physics, frameRng(frameIndex, "home-decision")),
      away: chooseZeroAction({ ...states.away, frameIndex, remainingIntervals: decisionCount - frameIndex - 1, preparation: preparations.away }, physics, frameRng(frameIndex, "away-decision"))
    };
    const actions = { home: decisions.home.action, away: decisions.away.action };
    const earlyMacroExpansion = (side) => frameIndex === 1 && preparations[side]?.openingFocus === "macro" && decisions[side].preparation?.followed === true && actions[side] === "expand";
    const movementActions = {
      home: earlyMacroExpansion("home") ? "scout" : actions.home,
      away: earlyMacroExpansion("away") ? "scout" : actions.away
    };
    const formations = {
      home: planZeroFormation(physics.battlefield, states.home.squads, "home", stat(states.home.player, "strategy"), movementActions.home),
      away: planZeroFormation(physics.battlefield, states.away.squads, "away", stat(states.away.player, "strategy"), movementActions.away)
    };
    for (const side of SIDES) {
      const decision = decisions[side];
      write("decision", {
        side,
        action: actions[side],
        text: `${states[side].player.name} \uC120\uC218\uAC00 ${ZERO_ACTION_LABELS[actions[side]]}\uC744 \uC120\uD0DD\uD588\uC0AC\uC640\uC694.`,
        decision: {
          scores: decision.scores,
          intelligence: decision.intel,
          formation: formations[side],
          scriptedOpening: decision.scriptedOpening,
          investment: decision.investment,
          ...decision.preparation ? { preparation: decision.preparation } : {}
        },
        factors: [
          decision.scriptedOpening ? "\uCD08\uBC18 \uC6B4\uC601 \uACC4\uD68D" : "\uAD00\uCE21 \uAE30\uB85D\uACFC \uC790\uAE30 \uC0C1\uD0DC\uC5D0 \uB530\uB978 \uD310\uB2E8",
          ...decision.preparation ? [decision.preparation.reason] : [],
          ...earlyMacroExpansion(side) ? ["\uC870\uAE30 \uD655\uC7A5 \uBE44\uC6A9\uC744 \uC9C0\uBD88\uD558\uBA74\uC11C \uAE30\uC874 \uBCD1\uB825\uC758 \uC815\uCC30 \uB3D9\uC120\uC744 \uC720\uC9C0"] : [],
          `\uAE30\uC5B5\uB41C \uC0C1\uB300 \uBD80\uB300 ${decision.intel.knownSquads}\uAC1C / \uC2E0\uB8B0\uB3C4 ${Math.round(decision.intel.confidence * 100)}%`,
          formations[side].reason,
          `\uB0A8\uC740 \uD310\uB2E8 ${decision.investment.remainingIntervals}\uD68C / \uD655\uC7A5 \uC608\uC0C1 \uD68C\uC218 \uAD11\uBB3C ${round(decision.investment.expansionReturn)} / \uBE44\uC6A9 ${decision.investment.expansionCost}`,
          `\uD655\uC7A5 \uD22C\uC790 ${decision.investment.canExpand ? "\uAC00\uB2A5" : "\uBCF4\uB958"} / \uAE30\uC220 \uD22C\uC790 ${decision.investment.canDevelop ? "\uAC00\uB2A5" : "\uBCF4\uB958"}`
        ]
      });
    }
    for (const side of SIDES) {
      const state = states[side];
      const preserveOpeningProduction = frameIndex === 0 && preparations[side]?.openingFocus === "scout" && decisions[side].preparation?.followed === true && actions[side] === "scout";
      const resumeMacroProduction = frameIndex === 2 && preparations[side]?.openingFocus === "macro" && state.expansions > 0;
      applyAction(
        state,
        actions[side],
        physics,
        frameIndex,
        frameRng(frameIndex, `${side}-execution`),
        write,
        decisionCount - frameIndex - 1,
        preserveOpeningProduction ? "produce" : resumeMacroProduction ? "expand" : void 0,
        earlyMacroExpansion(side)
      );
    }
    const motion = advanceZeroMovement(
      physics.battlefield,
      SIDES.flatMap((side) => states[side].squads),
      movementActions,
      physics.rushDistance,
      frameIndex > 0 ? existingIds : /* @__PURE__ */ new Set(),
      formations
    );
    for (const side of SIDES) states[side].squads = motion.squads.filter((squad) => squad.side === side);
    for (const trace of motion.movements) {
      const squad = motion.squads.find((candidate) => candidate.id === trace.squadId);
      const unit = getZeroUnit(squad.unitTypeId);
      write("movement", {
        side: squad.side,
        action: trace.intent === "transport" ? void 0 : trace.intent === "retreat" || trace.intent === "regroup" ? "defend" : trace.intent,
        squadId: squad.id,
        unitTypeId: unit.id,
        count: squad.count,
        from: { x: trace.points[0].x, y: trace.points[0].y },
        to: { x: squad.x, y: squad.y },
        text: `${unit.name} ${squad.count}\uAE30\uAC00 ${trace.carrierId ? "\uC218\uC1A1\uC120\uC5D0 \uD0D1\uC2B9\uD558\uC5EC \uACF5\uC911 \uACBD\uB85C" : trace.intent === "retreat" ? "\uD6C4\uD1F4 \uACBD\uB85C" : trace.intent === "regroup" ? "\uC9D1\uACB0 \uACBD\uB85C" : trace.domain === "air" ? "\uACF5\uC911 \uACBD\uB85C" : "\uC9C0\uC0C1 \uACBD\uB85C"}\uB97C \uB530\uB77C \uC774\uB3D9\uD588\uC0AC\uC640\uC694.`,
        factors: [
          `\uBAA9\uC801\uC9C0 ${trace.goal}`,
          `\uC774\uB3D9 \uAC70\uB9AC ${round(trace.distance, 4)} / \uD55C\uB3C4 ${round(trace.budget, 4)}`,
          ...trace.blockedBy ? ["\uC0C1\uB300 \uC804\uC120\uACFC \uC811\uCD09\uD558\uC5EC \uC804\uC9C4 \uC911\uC9C0"] : []
        ]
      });
    }
    const beforeCombat = { home: states.home.squads.map((squad) => ({ ...squad })), away: states.away.squads.map((squad) => ({ ...squad })) };
    const scheduledEngagement = frameIndex >= physics.firstEngagementFrame && (frameIndex - physics.firstEngagementFrame) % 3 === 0;
    if (scheduledEngagement || isFinalFrame) {
      resolveEngagement(states.home, states.away, physics, frameRng(frameIndex, "engagement"), write, isFinalFrame);
    }
    resolveFieldPressures(states, actions, physics, write);
    for (const side of SIDES) resolveBasePressure(states[side], states[opponentOf(side)], physics, write);
    for (const side of SIDES) {
      const state = states[side];
      const transport = settleZeroTransport(
        state.squads,
        physics.battlefield,
        actions[side],
        state.metrics.tech,
        stat(state.player, "harass"),
        (type) => `zero-${side}-${type}-${state.nextSquadNo++}`,
        { remainingIntervals: decisionCount - frameIndex - 1, rushDistance: physics.rushDistance, intelligence: state.intelligence }
      );
      state.squads = transport.squads;
      for (const record of transport.records) {
        const carrier = state.squads.find((s) => s.id === record.carrierId);
        const labels = { dispatch: "\uD0D1\uC2B9 \uC9C0\uC810\uC73C\uB85C \uCD9C\uBC1C", load: "\uD0D1\uC2B9", unload: "\uD558\uCC28", return: "\uADC0\uD658 \uC2DC\uC791", complete: "\uADC0\uD658 \uC644\uB8CC", cancel: "\uD0D1\uC2B9 \uB300\uAE30 \uCDE8\uC18C", defer: "\uC218\uC1A1 \uCD9C\uBC1C \uBCF4\uB958", reroute: "\uC218\uC1A1 \uACBD\uB85C \uBCC0\uACBD" };
        write("transport", {
          side,
          squadId: carrier.id,
          unitTypeId: carrier.unitTypeId,
          count: carrier.count,
          transport: record,
          text: `${getZeroUnit(carrier.unitTypeId).name}: ${record.cargo ? `${getZeroUnit(record.cargo.unitTypeId).name} ${record.cargo.count}\uAE30 ` : ""}${labels[record.operation]}\uD588\uC0AC\uC640\uC694.`,
          factors: [
            `\uBAA9\uC801\uC9C0 ${record.goal}`,
            ...record.slots ? [`\uC801\uC7AC \uACF5\uAC04 ${record.slots}/${getZeroUnit(carrier.unitTypeId).transportCapacity}`] : [],
            ...record.plan?.reasons ?? record.reasons ?? [],
            "\uC2E4\uC81C \uC704\uCE58\uC5D0\uC11C \uCC98\uB9AC / \uD0D1\uC2B9 \uC911 \uACF5\uACA9\xB7\uC815\uCC30 \uBD88\uAC00 / \uD558\uCC28 \uB2E4\uC74C \uAD6C\uAC04\uBD80\uD130 \uC804\uD22C \uCC38\uC5EC"
          ]
        });
      }
      recalculateArmyValue(state);
      assertZeroTransportState(state.squads, physics.battlefield);
    }
    const finished = isFinalFrame || SIDES.some((side) => states[side].metrics.baseIntegrity <= 0);
    for (const side of SIDES) {
      const state = states[side], old = state.intelligence;
      const confirmedDestructions = observeZeroDestructions(
        beforeCombat[side],
        beforeCombat[opponentOf(side)],
        states[opponentOf(side)].squads,
        physics.battlefield,
        stat(state.player, "scout"),
        physics.complexity,
        actions[side] === "scout"
      );
      state.intelligence = observeZeroEnemy(
        old,
        state.squads,
        states[opponentOf(side)].squads,
        physics.battlefield,
        frameIndex,
        stat(state.player, "scout"),
        physics.complexity,
        actions[side] === "scout",
        confirmedDestructions
      );
      const summary = summarizeZeroIntel(state.intelligence, frameIndex);
      state.metrics.intel = summary.confidence * 100;
      if (old.observations.length || state.intelligence.observations.length || confirmedDestructions.length || actions[side] === "scout") write("observation", {
        side,
        observations: state.intelligence.observations,
        confirmedDestructions,
        text: summary.knownSquads ? `${state.player.name} \uC120\uC218\uC758 \uAD00\uCE21 \uAE30\uB85D\uC5D0 \uC0C1\uB300 \uC804\uD22C \uBD80\uB300 ${summary.knownSquads}\uAC1C\uAC00 \uB0A8\uC544 \uC788\uC0AC\uC640\uC694.` : `${state.player.name} \uC120\uC218\uC5D0\uAC8C \uD655\uC2E4\uD558\uAC8C \uAE30\uC5B5\uB41C \uC0C1\uB300 \uC804\uD22C \uBD80\uB300\uAC00 \uC5C6\uC0AC\uC640\uC694.`,
        factors: [
          `\uAE30\uC5B5 \uC2E0\uB8B0\uB3C4 ${Math.round(summary.confidence * 100)}%`,
          `\uC624\uB798\uB41C \uAD00\uCE21 ${summary.staleSquads}\uAC1C`,
          `\uCD94\uC815 \uBCD1\uB825 \uAC00\uCE58 ${summary.estimatedArmyValue.toFixed(2)}`,
          `\uBAA9\uACA9\uD55C \uC804\uBA78 ${confirmedDestructions.map((entry) => `${getZeroUnit(entry.unitTypeId).name} (${entry.squadId})`).join(", ") || "\uC5C6\uC74C"}`
        ]
      });
    }
    let headline = frameEvents.at(-1)?.text ?? "\uC591\uCE21\uC774 \uB2E4\uC74C \uC218\uB97C \uC900\uBE44\uD558\uACE0 \uC788\uC0AC\uC640\uC694.";
    if (finished) {
      finalVerdict = verdictFrom(states, rng);
      const winner2 = finalVerdict.winner;
      const winnerState = states[winner2];
      finalCauses = makeCauses(states, winner2);
      const primaryCause = finalCauses[0];
      const lastEngagement = [...frameEvents].reverse().find((event) => event.kind === "engagement");
      const wonLastEngagement = lastEngagement?.side === winner2;
      const featured = wonLastEngagement ? frontSquad(winnerState) : void 0;
      const unit = featured ? getZeroUnit(featured.unitTypeId) : void 0;
      const victory = write("victory", {
        side: winner2,
        verdict: finalVerdict,
        action: wonLastEngagement ? lastEngagement?.action : void 0,
        squadId: featured?.id,
        unitTypeId: featured?.unitTypeId,
        count: featured?.count,
        text: finalVerdict.reason === "base-destruction" ? `${winnerState.player.name} \uC120\uC218\uAC00 \uC0C1\uB300 \uBCF8\uC9C4\uC744 \uD30C\uAD34\uD558\uC5EC \uC2B9\uB9AC\uB97C \uD655\uC815\uD588\uC0AC\uC640\uC694. \uC885\uD569 \uC810\uC218\uBCF4\uB2E4 \uBCF8\uC9C4 \uD30C\uAD34\uAC00 \uC6B0\uC120\uC774\uB78D\uB2C8\uB2E4.` : finalVerdict.reason === "mutual-base-destruction" ? `\uC591\uCE21 \uBCF8\uC9C4\uC774 \uAC19\uC740 \uAD6C\uAC04\uC5D0 \uD30C\uAD34\uB410\uC0AC\uC640\uC694. ${winnerState.player.name} \uC120\uC218\uAC00 ${finalVerdict.tieBreak ? "\uB3D9\uB960 \uC2DC\uB4DC \uD310\uC815" : "\uC885\uD569 \uC804\uD669 \uD310\uC815"}\uC73C\uB85C \uC2B9\uB9AC\uD588\uC0AC\uC640\uC694.` : !lastEngagement ? `${winnerState.player.name} \uC120\uC218\uAC00 ${primaryCause?.label ?? "\uC885\uD569 \uC804\uD669"} \uC6B0\uC138\uB85C \uC804\uCCB4 \uD310\uC815\uC744 \uAC00\uC838\uAC14\uC0AC\uC640\uC694.` : wonLastEngagement ? `${winnerState.player.name} \uC120\uC218\uAC00 ${unit ? `${unit.name} \uBD80\uB300\uC640 ` : ""}${primaryCause?.label ?? "\uC885\uD569 \uC804\uD669"} \uC6B0\uC138\uB85C \uC2B9\uB9AC\uB97C \uD655\uC815\uD588\uC0AC\uC640\uC694.` : `${winnerState.player.name} \uC120\uC218\uAC00 \uB9C8\uC9C0\uB9C9 \uAD50\uC804\uC740 \uB0B4\uC92C\uC9C0\uB9CC ${primaryCause?.label ?? "\uC885\uD569 \uC804\uD669"} \uC6B0\uC138\uB85C \uC804\uCCB4 \uD310\uC815\uC744 \uAC00\uC838\uAC14\uC0AC\uC640\uC694.`,
        factors: [
          `\uD310\uC815 ${finalVerdict.reason}${finalVerdict.tieBreak ? " / \uB3D9\uB960 \uC2DC\uB4DC \uC0AC\uC6A9" : ""}`,
          `\uC885\uD569 \uC810\uC218 \uD648 ${round(finalVerdict.scores.home, 4)} / \uC6D0\uC815 ${round(finalVerdict.scores.away, 4)}`,
          `\uCD5C\uC885 \uBCD1\uB825 \uAC00\uCE58 ${round(winnerState.metrics.armyValue)}`,
          `\uB9F5 \uC7A5\uC545\uB3C4 ${round(winnerState.metrics.mapControl)}`,
          ...primaryCause ? [primaryCause.detail] : []
        ]
      });
      headline = victory.text;
    }
    frames.push({
      index: frameIndex,
      timeSec,
      phase: finished ? "finished" : phaseFor(frameIndex, decisionCount),
      home: snapshotMetrics(states.home.metrics),
      away: snapshotMetrics(states.away.metrics),
      squads: snapshotSquads(states),
      eventIds: frameEvents.map((event) => event.id),
      headline,
      movements: motion.movements,
      intelligence: { home: states.home.intelligence, away: states.away.intelligence },
      productionReservations: Object.fromEntries(SIDES.filter((side) => states[side].productionReservation).map((side) => [
        side,
        { ...states[side].productionReservation, reasons: [...states[side].productionReservation.reasons] }
      ]))
    });
    if (finished) break;
  }
  if (!finalVerdict || !finalCauses) throw new Error("\uC81C\uB85C \uACBD\uAE30\uC758 \uC885\uB8CC \uD310\uC815\uC774 \uB204\uB77D\uB410\uC0AC\uC640\uC694.");
  const winner = finalVerdict.winner;
  return {
    engineId: ZERO_ENGINE_ID,
    engineVersion: ZERO_ENGINE_VERSION,
    seed,
    mapId: input.map.id,
    battlefield: physics.battlefield,
    winner,
    verdict: finalVerdict,
    durationSec: frames.at(-1)?.timeSec ?? 0,
    events,
    frames,
    causes: finalCauses,
    ...Object.keys(preparations).length ? { preparationReview: Object.fromEntries(SIDES.filter((side) => preparations[side]).map((side) => [side, {
      plan: preparations[side],
      decisions: events.filter((event) => event.side === side && event.decision?.preparation).map((event) => ({
        ...event.decision.preparation,
        timeSec: event.timeSec,
        action: event.action
      }))
    }])) } : {}
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  engineVersion,
  simulate
});

module.exports.buildHash = "d581b50a52721cae18aa185110364b3b5f6e5da8f24525f1d6c9c750c00a5874";
