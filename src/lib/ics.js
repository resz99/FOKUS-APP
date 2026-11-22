// Membuat file kalender (.ics) agar tugas bisa masuk ke Kalender iPhone / Google Calendar
// lengkap dengan pengingat yang berbunyi tepat di jam tugas.
import { addDays, dayOfWeek } from './dates.js';

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
export const EVENT_MINUTES = 30;

const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// Lipat baris > 75 byte sesuai standar iCalendar
function fold(line) {
  const enc = new TextEncoder();
  const out = [];
  let cur = '';
  for (const ch of line) {
    if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = ''; }
    cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const pad = (n) => String(n).padStart(2, '0');
const stamp = (dateKey, hm) => `${dateKey.replace(/-/g, '')}T${hm.replace(':', '')}00`;

export function addMinutes(dateKey, hm, min) {
  const [h, m] = hm.split(':').map(Number);
  let t = h * 60 + m + min;
  let d = dateKey;
  while (t >= 1440) { t -= 1440; d = addDays(d, 1); }
  return [d, `${pad(Math.floor(t / 60))}:${pad(t % 60)}`];
}

export function nextRoutineDate(days, from) {
  for (let i = 0; i < 7; i++) {
    const k = addDays(from, i);
    if ((days || []).includes(dayOfWeek(k))) return k;
  }
  return from;
}

export function taskEventDate(task, today) {
  return task.type === 'routine' ? nextRoutineDate(task.days, today) : task.dueDate;
}

export function buildIcs(task, today) {
  const date = taskEventDate(task, today);
  const [endDate, endTime] = addMinutes(date, task.time, EVENT_MINUTES);
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Fokus//Produktivitas Pribadi//ID',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Jakarta',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0700',
    'TZOFFSETTO:+0700',
    'TZNAME:WIB',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${task.id}@fokus-app`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=Asia/Jakarta:${stamp(date, task.time)}`,
    `DTEND;TZID=Asia/Jakarta:${stamp(endDate, endTime)}`,
    task.type === 'routine' ? `RRULE:FREQ=WEEKLY;BYDAY=${(task.days || []).map((d) => BYDAY[d]).join(',')}` : null,
    `SUMMARY:${esc(task.title)}`,
    `DESCRIPTION:${esc('Pengingat dari aplikasi Fokus. Centang tugas ini di Fokus setelah selesai.')}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(task.title)}`,
    'TRIGGER:-PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lines.map(fold).join('\r\n') + '\r\n';
}

export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Buka file .ics → iPhone menampilkan layar "Tambahkan ke Kalender"
export function openIcs(task, today) {
  const ics = buildIcs(task, today);
  const name = `fokus-${(task.title || 'tugas').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.ics`;
  const a = document.createElement('a');
  a.href = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
  a.download = name;
  if (isIOS()) a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Cadangan: tautan Google Calendar (versi web)
export function googleCalendarUrl(task, today) {
  const date = taskEventDate(task, today);
  const [endDate, endTime] = addMinutes(date, task.time, EVENT_MINUTES);
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: task.title,
    dates: `${stamp(date, task.time)}/${stamp(endDate, endTime)}`,
    ctz: 'Asia/Jakarta',
    details: 'Pengingat dari aplikasi Fokus',
  });
  if (task.type === 'routine') p.set('recur', `RRULE:FREQ=WEEKLY;BYDAY=${(task.days || []).map((d) => BYDAY[d]).join(',')}`);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
