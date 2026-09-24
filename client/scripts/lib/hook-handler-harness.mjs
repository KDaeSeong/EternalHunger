// Executes real component event handlers with a small hook lifecycle model.
// This is not a React renderer: browser checks remain a separate requirement.
import assert from 'node:assert/strict';
let current;
const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
export function createHandlerHarness(component, props) {
  const harness = { cells: [], cursor: 0, effects: [], dirty: true, mounted: true, writesAfterUnmount: 0, tree: null,
    render() {
      current = harness; harness.cursor = 0; harness.dirty = false; harness.effects = [];
      try { harness.tree = component(props); } finally { current = null; }
      for (const effect of harness.effects) effect();
      return harness.tree;
    },
    flush() { let count = 0; while (harness.dirty) { assert.ok(++count < 30, 'render loop'); harness.render(); } return harness.tree; },
    unmount() { harness.mounted = false; for (const cell of harness.cells) cell.cleanup?.(); },
  };
  return harness;
}
export function useState(initial) {
  const owner = current, index = owner.cursor++;
  const cell = owner.cells[index] ||= { value: typeof initial === 'function' ? initial() : initial };
  cell.set ||= (next) => {
    if (!owner.mounted) { owner.writesAfterUnmount++; return; }
    cell.value = typeof next === 'function' ? next(cell.value) : next; owner.dirty = true;
  };
  return [cell.value, cell.set];
}
export function useRef(initial) { return useState(() => ({ current: initial }))[0]; }
export function useMemo(factory, deps) {
  const owner = current, index = owner.cursor++;
  const cell = owner.cells[index] ||= {};
  if (!same(cell.deps, deps)) { cell.value = factory(); cell.deps = deps; }
  return cell.value;
}
export function useEffect(effect, deps) {
  const owner = current, index = owner.cursor++;
  const cell = owner.cells[index] ||= {};
  if (!same(cell.deps, deps)) owner.effects.push(() => { cell.cleanup?.(); cell.deps = deps; cell.cleanup = effect(); });
}
export const historyStorage = { rows: [], list: null, load: null, deletes: 0 };
export const REPLAY_HISTORY_LIMIT = 10;
export const listSimulationReplays = () => historyStorage.list ? historyStorage.list() : Promise.resolve(historyStorage.rows);
export const loadSimulationReplay = (id) => historyStorage.load(id);
export const deleteSimulationReplay = async () => { historyStorage.deletes++; };
export const classifySimulationReplayDeletionError = () => ({ text: 'test deletion error' });

export function elements(tree, predicate) {
  const found = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (predicate(node)) found.push(node);
    visit(node.props?.children);
  };
  visit(tree); return found;
}
export function textOf(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node !== 'object') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  return textOf(node.props?.children);
}
