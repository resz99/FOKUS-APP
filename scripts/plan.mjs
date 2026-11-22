// Menentukan notifikasi apa saja yang perlu dikirim pada saat ini (tanpa I/O → mudah dites).
import { todayKey, addDays, diffDays, dayOfWeek } from '../src/lib/dates.js';
import { buildMessage, taskMessage } from './reminder-messages.mjs';

export const WINDOW = 120; // toleransi keterlambatan GitHub (menit)
const toMin = (hm) => { const [h, m] = String(hm).split(':').map(Number); return h * 60 + m; };

// data: { goals, contents, workouts, weights, tasks, days:{[key]:dayDoc}, settings, log }
// return: { jobs: [{ msg, tag, taskId?, date? }], log, logChanged }
export function planJobs(mode, data, now = new Date()) {
  const today = todayKey(now);
  const yesterday = addDays(today, -1);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const isDue = (dateKey, hm) => {
    const since = diffDays(dateKey, today) * 1440 + nowMin - toMin(hm);
    return since >= 0 && since <= WINDOW;
  };
  const settings = { morningTime: '08:00', eveningTime: '23:00', ...(data.settings || {}) };
  const log = { ...(data.log || {}) };
  let logChanged = false;
  const jobs = [];
  const dayOf = (d) => data.days?.[d] || {};

  if (['pagi', 'malam', 'mingguan'].includes(mode)) {
    // Mode tes: kirim sekarang juga
    const msg = buildMessage(mode, { ...data, day: dayOf(today) }, today)
      || { title: '🌙 Evaluasi hari ini sudah diisi', body: 'Mantap! (notifikasi tes)' };
    jobs.push({ msg, tag: `fokus-${mode}` });
  }

  if (mode === 'auto') {
    const schedule = [
      ['pagi', settings.morningTime, () => true],
      ['malam', settings.eveningTime, () => true],
      ['mingguan', '20:00', (d) => dayOfWeek(d) === 0],
    ];
    for (const [type, time, onDay] of schedule) {
      for (const d of [yesterday, today]) {
        if (log[type] === d || !onDay(d) || !isDue(d, time)) continue;
        log[type] = d;
        logChanged = true;
        const msg = buildMessage(type, { ...data, day: dayOf(d) }, d);
        if (msg) jobs.push({ msg, tag: `fokus-${type}` });
      }
    }
  }

  if (mode === 'auto' || mode === 'tugas') {
    const force = mode === 'tugas';
    for (const d of force ? [today] : [yesterday, today]) {
      for (const t of data.tasks || []) {
        if (!t.time || t.inCalendar) continue;
        if (force ? toMin(t.time) > nowMin : t.remindedOn === d || !isDue(d, t.time)) continue;
        // Tugas yang baru dibuat setelah jamnya lewat tidak perlu diingatkan
        if (!force && t.createdAt && t.createdAt > new Date(`${d}T${t.time}:00`).getTime()) continue;
        const pending = t.type === 'once'
          ? !t.done && t.dueDate === d
          : t.type === 'routine' && t.active !== false && (t.days || []).includes(dayOfWeek(d)) && !(dayOf(d).routineDone || {})[t.id];
        if (pending) jobs.push({ msg: taskMessage(t), tag: `fokus-task-${t.id}`, taskId: t.id, date: d });
      }
    }
  }
  return { jobs, log, logChanged };
}
