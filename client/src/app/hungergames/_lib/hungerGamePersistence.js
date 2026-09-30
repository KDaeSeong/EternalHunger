import { HUNGER_VERSION, HUNGER_LIMITS, normalizeHungerConfig } from './hungerGameContract.js';
import { advanceHungerRun, createHungerRun, replayHungerRun } from './hungerGameRuntime.js';

export const HUNGER_STORAGE_KEY = 'eh_hunger_games_v1';

// Save input + progress, then replay on load. Display text is never an authority for game state.
export function createHungerPack(config, run = null) {
  const normalized = normalizeHungerConfig(config);
  const snapshot = run ? normalizeHungerConfig(run.input) : null;
  return { version: HUNGER_VERSION, config: normalized,
    run: run ? { ...(JSON.stringify(normalized) !== JSON.stringify(snapshot) ? { config: snapshot } : {}), phases: run.history.length } : null };
}

function readPack(raw) {
  const input = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!input || input.version !== HUNGER_VERSION) throw new Error('지원하지 않는 헝거게임 저장 버전입니다.');
  if (new TextEncoder().encode(JSON.stringify(input)).length > HUNGER_LIMITS.packBytes) throw new Error('저장 파일은 6MB 이내여야 합니다.');
  const config = normalizeHungerConfig(input.config);
  const checkpoint = input.run == null ? null : { config: normalizeHungerConfig(input.run.config ?? config), phases: input.run.phases };
  if (checkpoint && (!Number.isInteger(checkpoint.phases) || checkpoint.phases < 0 || checkpoint.phases > HUNGER_LIMITS.phases)) throw new Error('저장된 진행 수가 올바르지 않습니다.');
  return { config, checkpoint };
}

export function restoreHungerPack(raw) {
  const { config, checkpoint } = readPack(raw);
  const run = checkpoint ? replayHungerRun(checkpoint.config, checkpoint.phases) : null;
  return { config, run };
}

export async function restoreHungerPackAsync(raw, yieldStep = () => new Promise((resolve) => setTimeout(resolve, 0))) {
  const { config, checkpoint } = readPack(raw);
  let run = checkpoint ? createHungerRun(checkpoint.config) : null;
  for (let index = 0; index < (checkpoint?.phases || 0); index += 1) {
    if (run.finished) throw new Error('경기 종료 이후의 진행 기록은 불러올 수 없습니다.');
    run = advanceHungerRun(run);
    if (index % 2 === 1) await yieldStep();
  }
  return { config, run };
}
