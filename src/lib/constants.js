export const ACCOUNTS = {
  pmo: { label: 'PMO', color: 'var(--c-pmo)', platforms: ['Instagram', 'LinkedIn', 'TikTok'] },
  pribadi: { label: 'Pribadi', color: 'var(--c-pribadi)', platforms: ['Instagram', 'TikTok', 'YT Shorts'] },
  clipper: { label: 'Clipper', color: 'var(--c-clipper)', platforms: ['YT Shorts'] },
};
export const ACCOUNT_KEYS = Object.keys(ACCOUNTS);

export const WORKOUT_TYPES = ['Jalan cepat', 'Lari', 'Bersepeda', 'Renang', 'Latihan otot / Gym', 'Olahraga lain'];

export const DELAY_REASONS = ['Lupa', 'Menunda', 'Terlalu banyak tugas', 'Capek', 'Ada urusan mendadak', 'Lainnya'];

// Target awal yang dibuat otomatis saat pertama kali login
export const DEFAULT_GOALS = [
  { name: '100 Konten PMO', kind: 'count', source: 'content', account: 'pmo', startValue: 30, targetValue: 100, unit: 'konten', startDate: '2026-11-21', deadline: '2026-12-31', order: 1 },
  { name: '100 Konten Pribadi (IG + TikTok)', kind: 'count', source: 'content', account: 'pribadi', startValue: 0, targetValue: 100, unit: 'konten', startDate: '2026-11-21', deadline: '2027-03-31', order: 2 },
  { name: 'BB Tahap 1 → 71 kg', kind: 'weight', startValue: 75, targetValue: 71, unit: 'kg', startDate: '2026-11-21', deadline: '2026-12-31', order: 3 },
  { name: 'BB Tahap 2 → 65 kg (ideal)', kind: 'weight', startValue: 71, targetValue: 65, unit: 'kg', startDate: '2027-01-01', deadline: '2027-03-31', order: 4 },
  { name: 'Olahraga Rutin Mingguan', kind: 'weekly', weeklyMinutes: 240, weeklyStrength: 2, unit: 'menit', startDate: '2026-11-21', deadline: '2099-12-31', order: 5 },
];
