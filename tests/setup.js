import { beforeEach } from 'vitest';

// Refuerzo dentro de cada worker (por si el proceso padre no lo propagó).
process.env.TZ = 'America/Santiago';

// localStorage mínimo (Node no lo trae). Se reinicia antes de cada test.
const makeLocalStorage = () => {
  let store = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
    key: (i) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
};

globalThis.localStorage = makeLocalStorage();
beforeEach(() => { globalThis.localStorage.clear(); });
