import assert from 'node:assert/strict';
import {
  getApplicableGamePortingChecklist,
  getGamePortingProgress,
} from '../src/app/games/_lib/gamePortingProgress.mjs';

const soloGame = {
  slug: 'contract-solo',
  title: 'Contract Solo',
  boardHref: '/board?game=contract-solo',
  primaryHref: '/games/contract-solo/play',
  integration: {
    roomSystem: 'none',
    supportsRooms: false,
    supportsStateSync: false,
    supportsRecords: false,
    supportsSaves: false,
    completionPct: 100,
  },
};

const soloItems = getApplicableGamePortingChecklist(soloGame);
assert.deepEqual(soloItems.map((item) => item.key), ['catalog', 'board', 'records', 'saves', 'play']);
assert.equal(getGamePortingProgress(soloGame).percent, 60);

const roomGame = {
  ...soloGame,
  slug: 'contract-room',
  integration: {
    ...soloGame.integration,
    roomSystem: 'game-room',
    supportsRooms: true,
    supportsStateSync: true,
    supportsRecords: true,
    supportsSaves: true,
  },
};

const roomProgress = getGamePortingProgress(roomGame);
assert.equal(roomProgress.total, 7);
assert.equal(roomProgress.percent, 100);

console.log('Game porting progress contracts passed.');
