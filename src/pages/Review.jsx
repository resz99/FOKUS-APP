import { useState } from 'react';
import { useData, saveDay } from '../lib/store.jsx';
import { todayKey, addDays, fmtShort, fmtLong, weekStart, weekDays, HARI_PENDEK, dayOfWeek } from '../lib/dates.js';
import { DELAY_REASONS, ACCOUNTS, ACCOUNT_KEYS } from '../lib/constants.js';
import { Card, Empty, Field, toast } from '../components/ui.jsx';
import { BarChart } from '../components/Charts.jsx';

const SCORE_EMOJI = ['', '😞', '😕', '😐', '🙂', '🔥'];

export default function Review() {
  const data = useData();
  const today = todayKey();
  const [date, setDate] = useState(today);
  return (
    <div className="page">
      <div className="page-head">
        <h1>Evaluasi</h1>
        <p className="muted">1 menit setiap malam. Jujur saja, ini untukmu sendiri.</p>
      </div>
      <div className="grid">
        <EvalForm key={date} date={date} setDate={setDate} today={today} />
        <WeekStats today={today} />
        <ContentWeeks today={today} />
        <Reasons today={today} />
        <History today={today} onOpen={setDate} />
      </div>
    </div>
  );
}

function EvalForm({ date, setDate, today }) {
  const { days, contents, tasks, api } = useData();
  const day = days[date] || {};
  const ev = day.evaluation || {};
  const pr = (day.priorities || []).filter((p) => p.text);
  const postedToday = contents.filter((c) => c.status === 'posted' && c.postedDate === date);
  const tasksDone = tasks.filter((t) => t.type === 'once' && t.done && t.doneDate === date);
  const autoSummary = [
    pr.length ? `Prioritas: ${pr.filter((p) => p.done).length}/${pr.length} selesai` : null,
    postedToday.length ? `Konten diposting: ${ACCOUNT_KEYS.map((k) => { const n = postedToday.filter((c) => c.account === k).length; return n ? `${ACCOUNTS[k].label} ${n}` : null; }).filter(Boolean).join(', ')}` : 'Konten diposting: 0',
    tasksDone.length ? `Tugas selesai: ${tasksDone.length}` : null,
  ].filter(Boolean);

  const [f, setF] = useState({
    done: ev.done || '',
    postponed: ev.postponed || '',
    reasons: ev.reasons || [],
    score: ev.score || 0,
    tomorrow: ev.tomorrow || ['', '', ''],
  });

  const save = () => {
    if (!f.score) return toast('Beri skor hari ini (1–5)', 'error');
    const tomorrowList = f.tomorrow.map((t) => t.trim()).filter(Boolean).slice(0, 3);
    saveDay(api, days, date, { evaluation: { ...f, tomorrow: tomorrowList, savedAt: Date.now() } });
    // Rencana besok langsung jadi 3 prioritas besok (bila belum diisi)
    const next = addDays(date, 1);
    const nextDay = days[next] || {};
    if (tomorrowList.length && !(nextDay.priorities || []).some((p) => p.text)) {
      saveDay(api, days, next, { priorities: tomorrowList.map((text) => ({ text, done: false })) });
    }
    toast('Evaluasi tersimpan. Istirahat yang cukup ya 🌙', 'success');
  };
  return (
    <Card title={date === today ? 'Evaluasi Hari Ini' : `Evaluasi ${fmtLong(date)}`} className="card-wide"
      action={<input type="date" className="date-compact" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} />}>
      <div className="auto-summary">{autoSummary.map((s) => <span key={s}>{s}</span>)}</div>
      <Field label="Skor hari ini">
        <div className="score-row">
          {[1, 2, 3, 4, 5].map((s) => (
            <button key={s} type="button" className={f.score === s ? 'score active' : 'score'} onClick={() => setF((x) => ({ ...x, score: s }))}>
              <span>{SCORE_EMOJI[s]}</span><small>{s}</small>
            </button>
          ))}
        </div>
      </Field>
      <Field label="Apa yang berhasil diselesaikan?"><textarea rows="2" value={f.done} onChange={(e) => setF((x) => ({ ...x, done: e.target.value }))} /></Field>
      <Field label="Apa yang tertunda?"><textarea rows="2" value={f.postponed} onChange={(e) => setF((x) => ({ ...x, postponed: e.target.value }))} /></Field>
      <Field label="Kenapa tertunda?">
        <div className="chips">
          {DELAY_REASONS.map((r) => (
            <button key={r} type="button" className={f.reasons.includes(r) ? 'chip active' : 'chip'}
              onClick={() => setF((x) => ({ ...x, reasons: x.reasons.includes(r) ? x.reasons.filter((y) => y !== r) : [...x.reasons, r] }))}>{r}</button>
          ))}
        </div>
      </Field>
      <Field label="3 prioritas untuk besok" hint="Otomatis menjadi “3 Prioritas Hari Ini” besok pagi">
        {f.tomorrow.map((t, i) => (
          <input key={i} className="prio-input" value={t} placeholder={`Prioritas ${i + 1}`}
            onChange={(e) => setF((x) => ({ ...x, tomorrow: x.tomorrow.map((y, j) => (j === i ? e.target.value : y)) }))} />
        ))}
      </Field>
      <div className="actions"><button className="btn btn-primary" onClick={save}>{ev.savedAt ? 'Perbarui evaluasi' : 'Simpan evaluasi'}</button></div>
    </Card>
  );
}

function WeekStats({ today }) {
  const { days } = useData();
  const wd = weekDays(today);
  const scores = wd.map((k) => ({ label: HARI_PENDEK[dayOfWeek(k)], value: days[k]?.evaluation?.score || 0, highlight: k === today }));
  const prDone = wd.reduce((s, k) => s + (days[k]?.priorities || []).filter((p) => p.done).length, 0);
  const prTotal = wd.reduce((s, k) => s + (days[k]?.priorities || []).filter((p) => p.text).length, 0);
  const filled = wd.filter((k) => days[k]?.evaluation).length;
  const avg = filled ? Math.round((scores.reduce((s, x) => s + x.value, 0) / filled) * 10) / 10 : 0;
  return (
    <Card title="Minggu Ini">
      <div className="stat-row">
        <div><div className="stat">{avg || '—'}</div><div className="muted small">rata-rata skor</div></div>
        <div><div className="stat">{prDone}/{prTotal}</div><div className="muted small">prioritas selesai</div></div>
        <div><div className="stat">{filled}/7</div><div className="muted small">hari dievaluasi</div></div>
      </div>
      <BarChart data={scores} height={120} />
    </Card>
  );
}

function ContentWeeks({ today }) {
  const { contents } = useData();
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(weekStart(today), -7 * (7 - i)));
  const data = weeks.map((s) => {
    const e = addDays(s, 6);
    const inWeek = contents.filter((c) => c.status === 'posted' && c.postedDate >= s && c.postedDate <= e);
    return { label: fmtShort(s).replace(' ', ' '), value: ACCOUNT_KEYS.map((k) => inWeek.filter((c) => c.account === k).length) };
  });
  return (
    <Card title="Konten per Minggu">
      <BarChart data={data} colors={ACCOUNT_KEYS.map((k) => ACCOUNTS[k].color)} />
      <p className="legend small muted">{ACCOUNT_KEYS.map((k) => <span key={k}><span className="dot" style={{ background: ACCOUNTS[k].color }} /> {ACCOUNTS[k].label}</span>)}</p>
    </Card>
  );
}

function Reasons({ today }) {
  const { days } = useData();
  const from = addDays(today, -29);
  const counts = {};
  Object.values(days).forEach((d) => {
    if (d.date >= from && d.evaluation?.reasons) d.evaluation.reasons.forEach((r) => { counts[r] = (counts[r] || 0) + 1; });
  });
  const list = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = list[0]?.[0];
  const TIPS = {
    Lupa: 'Pastikan notifikasi aktif & isi 3 prioritas tiap pagi.',
    Menunda: 'Mulai dengan langkah 5 menit saja. Fitur “pecah tugas” ada di halaman Hari Ini.',
    'Terlalu banyak tugas': 'Batasi 3 prioritas. Tunda/hapus yang tidak berdampak ke target.',
    Capek: 'Cek jam tidur & olahraga. Energi = bahan bakar produktivitas.',
    'Ada urusan mendadak': 'Sisakan “buffer” 1–2 jam kosong di jadwal harian.',
    Lainnya: 'Tulis detailnya di kolom “tertunda” agar polanya terlihat.',
  };
  return (
    <Card title="Penyebab Tertunda (30 hari)">
      {!list.length ? <Empty>Belum ada data. Isi evaluasi malam agar polanya terlihat.</Empty> : (
        <>
          <ul className="bars">
            {list.map(([r, n]) => (
              <li key={r}><span className="grow">{r}</span><span className="bar-inline" style={{ width: `${(n / list[0][1]) * 60}%` }} /><b>{n}</b></li>
            ))}
          </ul>
          <p className="small tip-box">💡 Paling sering: <b>{top}</b>. {TIPS[top]}</p>
        </>
      )}
    </Card>
  );
}

function History({ today, onOpen }) {
  const { days } = useData();
  const list = Object.values(days).filter((d) => d.evaluation && d.date < today).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14);
  return (
    <Card title="Riwayat Evaluasi">
      {!list.length ? <Empty>Belum ada riwayat.</Empty> : (
        <ul className="plainlist">
          {list.map((d) => (
            <li key={d.date} className="clickable" onClick={() => { onOpen(d.date); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
              <span>{SCORE_EMOJI[d.evaluation.score]}</span>
              <span className="grow">{fmtShort(d.date)} <span className="muted small truncate">{d.evaluation.done}</span></span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
