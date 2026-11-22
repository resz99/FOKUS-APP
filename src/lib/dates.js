// Semua tanggal disimpan sebagai string "YYYY-MM-DD" (waktu lokal perangkat).
const pad = (n) => String(n).padStart(2, '0');

export function toKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function todayKey(d = new Date()) {
  return toKey(d);
}
export function addDays(key, n) {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}
export function diffDays(a, b) {
  // b - a dalam hari
  return Math.round((fromKey(b) - fromKey(a)) / 86400000);
}
// Minggu dimulai Senin
export function weekStart(key = todayKey()) {
  const d = fromKey(key);
  const day = (d.getDay() + 6) % 7; // Senin=0
  d.setDate(d.getDate() - day);
  return toKey(d);
}
export function weekDays(key = todayKey()) {
  const s = weekStart(key);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
}
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const HARI_PENDEK = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
export function fmtShort(key) {
  const d = fromKey(key);
  return `${d.getDate()} ${BULAN[d.getMonth()]}`;
}
export function fmtLong(key) {
  const d = fromKey(key);
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}
export function dayOfWeek(key) {
  return fromKey(key).getDay();
}
export function fmtDate(key) {
  const d = fromKey(key);
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}
