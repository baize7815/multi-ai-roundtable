import { loadState, saveState } from '../shared/storage';
import type { PersistedState } from '../shared/types';

let mutationTail: Promise<unknown> = Promise.resolve();

export async function mutatePersistedState<T>(mutator: (state: PersistedState) => T | Promise<T>): Promise<T> {
  const task = mutationTail.then(async () => {
    const state = await loadState();
    const result = await mutator(state);
    await saveState(state);
    return result;
  });
  mutationTail = task.then(() => undefined, () => undefined);
  return task;
}
