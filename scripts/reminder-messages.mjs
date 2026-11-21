// Isi pesan pengingat (dipisah agar mudah dites).
import { weekDays } from '../src/lib/dates.js';
import { analyze, weekWorkout } from '../src/lib/goals.js';
import { ACCOUNTS } from '../src/lib/constants.js';

function quotaText(data, today) {
  return data.goals
    .filter((g) => g.kind === 'count' && g.source === 'content')
    .map((g) => ({ g, a: analyze(g, data, today) }))
    .filter(({ a }) => a.neededToday > 0)
    .map(({ g, a }) => `${ACCOUNTS[g.account]?.label || g.name} ${a.neededToday}`)
    .join(' · ');
}

export function buildMessage(type, data, today) {
  if (type === 'pagi') {
    const pr = (data.day.priorities || []).filter((p) => p.text);
    const q = quotaText(data, today);
    const title = pr.length ? '☀️ Prioritasmu sudah siap' : '☀️ Tentukan 3 prioritas hari ini';
    const body = [
      pr.length ? `Mulai dari: ${pr[0].text}` : 'Pilih maksimal 3 hal terpenting hari ini.',
      q ? `Kuota konten: ${q}` : null,
    ].filter(Boolean).join('\n');
    return { title, body };
  }
  if (type === 'malam') {
    if (data.day.evaluation) return null; // sudah evaluasi → tidak perlu diingatkan
    const pr = (data.day.priorities || []).filter((p) => p.text);
    const posted = data.contents.filter((c) => c.status === 'posted' && c.postedDate === today).length;
    return {
      title: '🌙 Waktunya evaluasi (1 menit)',
      body: `Hari ini: ${posted} konten${pr.length ? ` · prioritas ${pr.filter((p) => p.done).length}/${pr.length}` : ''}. Tulis rencana besok, lalu istirahat.`,
    };
  }
  // mingguan
  const days = weekDays(today);
  const posted = data.contents.filter((c) => c.status === 'posted' && c.postedDate >= days[0] && c.postedDate <= days[6]);
  const wk = weekWorkout(data.workouts, today);
  const weekly = data.goals.find((g) => g.kind === 'weekly');
  const behind = data.goals
    .map((g) => ({ g, a: analyze(g, data, today) }))
    .filter(({ a }) => a.status === 'behind')
    .map(({ g }) => g.name);
  return {
    title: '📊 Ringkasan minggu ini',
    body: [
      `Konten: ${posted.length} · Olahraga: ${Math.round(wk.minutes)}${weekly ? `/${weekly.weeklyMinutes}` : ''} menit`,
      behind.length ? `Perlu dikejar: ${behind.join(', ')}` : 'Semua target on-track 👏',
      'Besok pagi jangan lupa timbang berat badan.',
    ].join('\n'),
  };
}

