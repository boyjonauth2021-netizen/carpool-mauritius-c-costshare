import { seed } from "./seed";
import type { DemoState } from "./types";

export const STORAGE_KEY = "carpool-mauritius-c:v1";
export const SEED_VERSION = 1;

export type KeyValue = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

type Persisted = { version: number; state: DemoState };

export function loadOrSeed(now: Date, storage: KeyValue): DemoState {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Persisted;
      if (parsed.version === SEED_VERSION && parsed.state?.users && parsed.state.settings) {
        return parsed.state;
      }
    }
  } catch {
    /* reseed when the saved blob is unreadable */
  }
  const state = seed(now);
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: SEED_VERSION, state }));
  return state;
}

export function saveState(state: DemoState, storage: KeyValue) {
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: SEED_VERSION, state }));
}

export function memoryStorage(initial?: string): KeyValue {
  const bag = new Map<string, string>();
  if (initial) bag.set(STORAGE_KEY, initial);
  return {
    getItem: (key) => bag.get(key) ?? null,
    setItem: (key, value) => {
      bag.set(key, value);
    },
    removeItem: (key) => {
      bag.delete(key);
    },
  };
}
