// Perhitungan progress, kuota harian, status on-track, dan cek realistis.
// Dipakai oleh aplikasi DAN skrip pengingat (scripts/send-reminders.mjs).
import { todayKey, diffDays, weekStart, weekDays, addDays, fmtDate } from './dates.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round1 = (v) => Math.round(v * 10) / 10;

export function postedInGoal(goal, contents) {
  return contents.filter(
    (c) => c.status === 'posted' && c.account === goal.account && c.postedDate >= goal.startDate && c.postedDate <= goal.deadline,
  );
}

export function latestWeight(weights, today = todayKey()) {
  const past = weights.filter((w) => w.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  return past.length ? past[past.length - 1] : null;
}

export function weekWorkout(workouts, key = todayKey()) {
  const days = weekDays(key);
  const list = workouts.filter((w) => !w.hidden && w.date >= days[0] && w.date <= days[6]);
  return {
    minutes: list.reduce((s, w) => s + (Number(w.minutes) || 0), 0),
    strength: list.filter((w) => w.strength).length,
    list,
  };
}

export function analyze(goal, data, today = todayKey()) {
  if (goal.kind === 'weekly') return analyzeWeekly(goal, data, today);
  if (goal.kind === 'weight') return analyzeWeight(goal, data, today);
  return analyzeCount(goal, data, today);
}

function timing(goal, today) {
  const total = diffDays(goal.startDate, goal.deadline) + 1;
  const notStarted = today < goal.startDate;
  const elapsed = clamp(diffDays(goal.startDate, today), 0, total); // hari yang sudah lewat (sebelum hari ini)
  const daysLeft = notStarted ? total : Math.max(0, diffDays(today, goal.deadline) + 1); // termasuk hari ini
  return { total, notStarted, elapsed, daysLeft };
}

function analyzeCount(goal, data, today) {
  const { total, notStarted, elapsed, daysLeft } = timing(goal, today);
  const start = Number(goal.startValue) || 0;
  const target = Number(goal.targetValue) || 0;
  let current, doneToday;
  if (goal.source === 'manual') {
    current = start + (Number(goal.manualCount) || 0);
    doneToday = (goal.manualLog || {})[today] || 0;
  } else {
    const posted = postedInGoal(goal, data.contents || []);
    current = start + posted.length;
    doneToday = posted.filter((c) => c.postedDate === today).length;
  }
  const remaining = Math.max(0, target - current);
  const pct = target ? clamp(current / target, 0, 1) : 0;
  const base = { kind: 'count', current, start, target, remaining, pct, daysLeft, total, doneToday };
  if (remaining === 0) return { ...base, status: 'done', neededToday: 0 };
  if (notStarted) return { ...base, status: 'notstarted', neededToday: 0, perDay: remaining / total, ...realismCount(remaining / total) };
  if (daysLeft === 0) return { ...base, status: 'ended', neededToday: 0 };
  const neededToday = Math.max(0, Math.ceil((remaining + doneToday) / daysLeft) - doneToday);
  const perDay = (remaining + doneToday) / daysLeft;
  const expected = start + ((target - start) * elapsed) / total;
  const gap = Math.ceil(expected - current);
  const status = current >= Math.floor(expected) ? 'ontrack' : 'behind';
  return { ...base, status, neededToday, perDay, perWeek: perDay * 7, expected, gap, ...realismCount(perDay) };
}

function realismCount(perDay) {
  if (perDay > 4) return { realism: 'unrealistic', realismMsg: `Butuh ±${round1(perDay)}/hari — sangat berat. Pertimbangkan menurunkan jumlah atau memundurkan deadline.` };
  if (perDay > 2.5) return { realism: 'challenging', realismMsg: `Butuh ±${round1(perDay)}/hari — menantang, pastikan produksi dibantu sistem/batching.` };
  return { realism: 'ok', realismMsg: `Ritme yang dibutuhkan ±${round1(perDay * 7)}/minggu.` };
}

function analyzeWeight(goal, data, today) {
  const { total, notStarted, elapsed, daysLeft } = timing(goal, today);
  const start = Number(goal.startValue);
  const target = Number(goal.targetValue);
  const dir = target < start ? -1 : 1; // -1 = turun
  const lw = latestWeight(data.weights || [], today);
  const current = lw ? Number(lw.kg) : start;
  const span = Math.abs(target - start) || 1;
  const progressed = (current - start) * dir;
  const pct = clamp(progressed / span, 0, 1);
  const need = Math.max(0, (target - current) * dir);
  const base = { kind: 'weight', current, start, target, pct, daysLeft, total, need: round1(need), lastDate: lw?.date };
  if (need === 0) return { ...base, status: 'done' };
  const weeksLeft = Math.max(daysLeft, 1) / 7;
  const perWeek = need / weeksLeft;
  const real = realismWeight(perWeek, need, today);
  if (notStarted) return { ...base, status: 'notstarted', perWeek, ...realismWeight(span / (total / 7), span, goal.startDate) };
  if (daysLeft === 0) return { ...base, status: 'ended' };
  const expected = start + ((target - start) * elapsed) / total;
  const status = (current - expected) * dir <= 0.3 ? 'ontrack' : 'behind';
  return { ...base, status, perWeek, expected: round1(expected), ...real };
}

function realismWeight(perWeek, need, fromKey) {
  const suggest = addDays(fromKey, Math.ceil(need / 0.75) * 7);
  if (perWeek > 1) return { realism: 'unrealistic', realismMsg: `Butuh ${round1(perWeek)} kg/minggu — melebihi batas aman (0,5–1 kg/minggu). Saran deadline: ${fmtDate(suggest)}.`, suggestDeadline: suggest };
  if (perWeek > 0.75) return { realism: 'challenging', realismMsg: `Butuh ${round1(perWeek)} kg/minggu — masih aman tapi ketat. Jaga pola makan & tidur.` };
  return { realism: 'ok', realismMsg: `Butuh ±${round1(perWeek)} kg/minggu — dalam batas aman.` };
}

function analyzeWeekly(goal, data, today) {
  const wk = weekWorkout(data.workouts || [], today);
  const tMin = Number(goal.weeklyMinutes) || 0;
  const tStr = Number(goal.weeklyStrength) || 0;
  const dayIdx = diffDays(weekStart(today), today); // Senin = 0
  const daysLeft = 7 - dayIdx;
  const remainingMin = Math.max(0, tMin - wk.minutes);
  const remainingStr = Math.max(0, tStr - wk.strength);
  const pct = tMin ? clamp(wk.minutes / tMin, 0, 1) : 0;
  // streak minggu berturut-turut yang tercapai (sebelum minggu ini)
  let streak = 0;
  for (let i = 1; i <= 52; i++) {
    const w = weekWorkout(data.workouts || [], addDays(weekStart(today), -7 * i));
    if (w.minutes >= tMin && w.strength >= tStr && tMin > 0) streak++;
    else break;
  }
  const done = remainingMin === 0 && remainingStr === 0;
  const expected = (tMin * dayIdx) / 7;
  const status = done ? 'done' : wk.minutes >= expected ? 'ontrack' : 'behind';
  let realism = 'ok', realismMsg = 'Sesuai anjuran WHO (150–300 menit/minggu + latihan otot 2x).';
  if (tMin > 600) { realism = 'challenging'; realismMsg = 'Lebih dari 10 jam/minggu — rawan cedera/kelelahan bila belum terbiasa.'; }
  else if (tMin < 150) { realism = 'challenging'; realismMsg = 'Di bawah anjuran minimum WHO (150 menit/minggu).'; }
  return {
    kind: 'weekly', minutes: wk.minutes, strength: wk.strength, targetMin: tMin, targetStr: tStr, pct,
    remainingMin, remainingStr, daysLeft, perDay: Math.ceil(remainingMin / daysLeft), streak, status, realism, realismMsg,
  };
}

export const STATUS_LABEL = {
  ontrack: 'On-track',
  behind: 'Tertinggal',
  done: 'Tercapai',
  notstarted: 'Belum mulai',
  ended: 'Lewat deadline',
};
