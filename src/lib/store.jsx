import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { COLLECTIONS } from './backend.js';
import { DEFAULT_GOALS } from './constants.js';
import { toast } from '../components/ui.jsx';

const DataCtx = createContext(null);

export function DataProvider({ backend, children }) {
  const [data, setData] = useState(() => Object.fromEntries(COLLECTIONS.map((c) => [c, null])));

  useEffect(() => {
    const unsubs = COLLECTIONS.map((name) =>
      backend.subscribe(
        name,
        (items) => setData((d) => ({ ...d, [name]: items })),
        (err) => toast('Gagal memuat data: ' + err.message, 'error'),
      ),
    );
    // Buat target awal saat pertama kali dipakai
    (async () => {
      try {
        const meta = await backend.get('meta', 'profile');
        if (!meta?.seeded) {
          await backend.put('meta', 'profile', { seeded: true, seededAt: Date.now() });
          for (const g of DEFAULT_GOALS) backend.add('goals', g);
        }
      } catch (e) { console.warn('seed', e); }
    })();
    return () => unsubs.forEach((u) => u && u());
  }, [backend]);

  const api = useMemo(() => {
    const wrap = (fn) => (...args) => {
      const p = fn(...args);
      Promise.resolve(p).catch((e) => toast('Gagal menyimpan: ' + e.message, 'error'));
      return p;
    };
    return {
      mode: backend.mode,
      add: wrap(backend.add),
      update: wrap(backend.update),
      put: wrap(backend.put),
      remove: wrap(backend.remove),
      get: backend.get,
    };
  }, [backend]);

  const value = useMemo(() => {
    const loading = COLLECTIONS.some((c) => data[c] === null);
    const get = (c) => data[c] || [];
    const days = Object.fromEntries(get('days').map((d) => [d.id, d]));
    return {
      loading,
      goals: get('goals').filter((g) => !g.archived).sort((a, b) => (a.order || 0) - (b.order || 0)),
      archivedGoals: get('goals').filter((g) => g.archived),
      contents: get('contents'),
      tasks: get('tasks'),
      days,
      workouts: get('workouts').filter((w) => !w.hidden),
      weights: get('weights').sort((a, b) => a.date.localeCompare(b.date)),
      settings: { morningTime: '08:00', eveningTime: '23:00', ...(get('meta').find((m) => m.id === 'settings') || {}) },
      strava: get('meta').find((m) => m.id === 'strava') || null,
      api,
    };
  }, [data, api]);

  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}

export const useData = () => useContext(DataCtx);

// Helper untuk dokumen harian (prioritas, rutinitas, evaluasi)
export function saveDay(api, days, key, patch) {
  const cur = days[key] || {};
  const { id, ...rest } = cur;
  return api.put('days', key, { ...rest, ...patch, date: key, updatedAt: Date.now() });
}
