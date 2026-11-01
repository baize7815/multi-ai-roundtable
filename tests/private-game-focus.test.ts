import assert from 'node:assert/strict';
import { pulsePrivateGamePage } from '../src/background/private-game-pages';

const GAME_WINDOW = 50, GAME_ANCHOR = 51, GAME_TAB = 52, USER_WINDOW = 10;
const windows = [
  { id: USER_WINDOW, focused: true, type: 'normal', state: 'normal', left: 50, top: 30, width: 1000, height: 700 },
  { id: GAME_WINDOW, focused: false, type: 'normal', state: 'normal', left: 0, top: 0, width: 420, height: 320 }
];
const tabs = new Map<number, any>([
  [GAME_ANCHOR, { id: GAME_ANCHOR, windowId: GAME_WINDOW, url: 'chrome-extension://test/game-background.html' }],
  [GAME_TAB, { id: GAME_TAB, windowId: GAME_WINDOW, url: 'https://chat.deepseek.com/', active: false }]
]);
const records: Record<string, unknown> = {
  multiAiRoundtablePrivateGameWindowV2: { windowId: GAME_WINDOW, anchorTabId: GAME_ANCHOR },
  multiAiRoundtablePrivateGameTabsV1: { [String(GAME_TAB)]: 'deepseek' }
};
const focusEvents: number[] = [];
const activated: number[] = [];
(globalThis as any).chrome = {
  runtime: { getURL: (path: string) => 'chrome-extension://test/' + path },
  storage: {
    local: {
      get: async (key: string) => ({ [key]: records[key] })
    }
  },
  tabs: {
    get: async (id: number) => tabs.get(id),
    update: async (id: number, changes: Record<string, unknown>) => {
      activated.push(id);
      Object.assign(tabs.get(id), changes);
      return tabs.get(id);
    }
  },
  windows: {
    get: async (id: number) => windows.find((item) => item.id === id),
    getAll: async () => windows,
    update: async (id: number, changes: Record<string, unknown>) => {
      const target = windows.find((item) => item.id === id)!;
      if (changes.focused === true) {
        for (const item of windows) item.focused = item.id === id;
        focusEvents.push(id);
      }
      Object.assign(target, changes);
      return target;
    }
  }
};

assert.equal(await pulsePrivateGamePage(GAME_TAB, 'deepseek', 0), true);
assert.deepEqual(focusEvents, [GAME_WINDOW, USER_WINDOW], 'private game wake must restore the normal Chrome window');
assert.deepEqual(activated, [GAME_TAB], 'only the managed private tab may be activated');
assert.equal(windows[0].focused, true);
assert.equal(await pulsePrivateGamePage(GAME_TAB, 'gpt', 0), false, 'wrong provider must never receive focus');
assert.deepEqual(focusEvents, [GAME_WINDOW, USER_WINDOW]);
windows[0].focused = false;
windows[1].focused = false;
assert.equal(await pulsePrivateGamePage(GAME_TAB, 'deepseek', 0), false,
  'when Chrome is not the foreground application, do not interrupt the user');
assert.deepEqual(focusEvents, [GAME_WINDOW, USER_WINDOW]);
console.log('private game real-focus wake, ownership and original-focus restoration tests passed');
