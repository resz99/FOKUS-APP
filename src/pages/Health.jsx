import { useState } from 'react';
import { useData } from '../lib/store.jsx';
import { analyze, weekWorkout, latestWeight } from '../lib/goals.js';
import { todayKey, weekStart, addDays, fmtShort } from '../lib/dates.js';
import { WORKOUT_TYPES } from '../lib/constants.js';
import { Card, Modal, Field, Progress, Empty, toast, fmtMin } from '../components/ui.jsx';
import { BarChart, LineChart } from '../components/Charts.jsx';

export default function Health() {
  const data = useData();
  const { api, workouts, weights, goals } = data;
  const today = todayKey();
  const [addW, setAddW] = useState(false);
  const [addKg, setAddKg] = useState(false);
  const weekly = goals.find((g) => g.kind === 'weekly');
  const a = weekly ? analyze(weekly, data, today) : null;
  const wk = weekWorkout(workouts, today);
  const weightGoals = goals.filter((g) => g.kind === 'weight');
  const lw = latestWeight(weights, today);
  const weighedThisWeek = weights.some((w) => w.date >= weekStart(today));

  const weeksHist = Array.from({ length: 8 }, (_, i) => {
    const s = addDays(weekStart(today), -7 * (7 - i));
    const w = weekWorkout(workouts, s);
    return { label: fmtShort(s).replace(' ', ' '), value: w.minutes, highlight: i === 7 };
  });
  const recentWeights = weights.slice(-12).map((w) => ({ label: fmtShort(w.date), value: Number(w.kg) }));

  return (
    <div className="page">
      <div className="page-head row-between">
        <div><h1>Sehat</h1><p className="muted">Olahraga rutin + berat badan menuju 65 kg.</p></div>
        <div className="row-inline">
          <button className="btn" onClick={() => setAddKg(true)}>+ Timbang</button>
          <button className="btn btn-primary" onClick={() => setAddW(true)}>+ Olahraga</button>
        </div>
      </div>
      <div className="grid">
        {a && (
          <Card title="Minggu Ini">
            <div className="stat-row">
              <div><div className="stat">{fmtMin(wk.minutes)}</div><div className="muted small">dari {fmtMin(a.targetMin)}</div></div>
              <div><div className="stat">{wk.strength}/{a.targetStr}</div><div className="muted small">latihan otot</div></div>
              <div><div className="stat">🔥 {a.streak}</div><div className="muted small">minggu berturut</div></div>
            </div>
            <Progress value={a.pct} color="var(--c-health)" />
            <p className="small muted">
              {a.status === 'done' ? 'Target minggu ini tercapai. Mantap!' : `Sisa ${fmtMin(a.remainingMin)}${a.remainingStr ? ` + ${a.remainingStr} sesi otot` : ''} dalam ${a.daysLeft} hari.`}
            </p>
            {!wk.list.length ? <Empty>Belum ada sesi minggu ini.</Empty> : (
              <ul className="plainlist">
                {wk.list.sort((x, y) => y.date.localeCompare(x.date)).map((w) => (
                  <li key={w.id}>
                    <span className="muted small">{fmtShort(w.date)}</span>
                    <span className="grow">{w.type}{w.strength && ' 💪'}</span>
                    <span>{fmtMin(w.minutes)}</span>
                    <button className="icon-btn sm" aria-label="Hapus" onClick={() => api.remove('workouts', w.id)}>✕</button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        <Card title="Berat Badan" action={!weighedThisWeek && <span className="badge badge-behind">Belum timbang minggu ini</span>}>
          <div className="stat-row">
            <div><div className="stat">{lw ? `${lw.kg} kg` : '—'}</div><div className="muted small">{lw ? `terakhir ${fmtShort(lw.date)}` : 'belum ada data'}</div></div>
            {weightGoals.map((g) => {
              const r = analyze(g, data, today);
              return <div key={g.id}><div className="stat">{g.targetValue} kg</div><div className="muted small">{fmtShort(g.deadline)} · {r.status === 'done' ? 'tercapai ✓' : `kurang ${r.need} kg`}</div></div>;
            })}
          </div>
          {recentWeights.length > 0 ? (
            <LineChart points={recentWeights} unit=" kg" targets={weightGoals.map((g) => ({ label: `${g.targetValue} kg`, value: Number(g.targetValue) }))} />
          ) : <Empty>Timbang 1x seminggu, idealnya pagi hari setelah bangun.</Empty>}
          {weightGoals.map((g) => {
            const r = analyze(g, data, today);
            if (r.status !== 'ontrack' && r.status !== 'behind') return null;
            return <p key={g.id} className={`small ${r.status === 'behind' ? 'danger-text' : 'muted'}`}>{g.name}: butuh ±{Math.round(r.perWeek * 10) / 10} kg/minggu{r.status === 'behind' ? ` — seharusnya ±${r.expected} kg sekarang` : ''}.</p>;
          })}
        </Card>

        <Card title="Riwayat 8 Minggu (menit olahraga)">
          <BarChart data={weeksHist} goal={a?.targetMin} format={(v) => (v >= 60 ? `${Math.round((v / 60) * 10) / 10}j` : `${v}m`)} />
        </Card>

        <Card title="Panduan (WHO)">
          <ul className="tips">
            <li><b>150–300 menit/minggu</b> aktivitas sedang (jalan cepat, bersepeda santai, renang), atau 75–150 menit aktivitas berat (lari, HIIT).</li>
            <li><b>Latihan otot minimal 2x/minggu</b> (push-up, squat, beban).</li>
            <li>Untuk turun berat badan, arahkan ke batas atas (±4–5 jam/minggu). Hasil terbesar tetap dari <b>pola makan & tidur cukup</b>.</li>
            <li>Penurunan aman: <b>0,5–1 kg/minggu</b>.</li>
          </ul>
        </Card>
      </div>
      {addW && <WorkoutModal today={today} onClose={() => setAddW(false)} />}
      {addKg && <WeightModal today={today} last={lw} onClose={() => setAddKg(false)} />}
    </div>
  );
}

function WorkoutModal({ today, onClose }) {
  const { api } = useData();
  const [f, setF] = useState({ date: today, type: WORKOUT_TYPES[0], minutes: 30, strength: false });
  const save = () => {
    if (!(Number(f.minutes) > 0)) return toast('Isi durasi', 'error');
    api.add('workouts', { ...f, minutes: Number(f.minutes) });
    toast('Sesi olahraga tercatat 💪', 'success');
    onClose();
  };
  return (
    <Modal title="Catat Olahraga" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Batal</button><button className="btn btn-primary" onClick={save}>Simpan</button></>}>
      <Field label="Jenis">
        <div className="chips">
          {WORKOUT_TYPES.map((t) => (
            <button type="button" key={t} className={f.type === t ? 'chip active' : 'chip'}
              onClick={() => setF((x) => ({ ...x, type: t, strength: t.startsWith('Latihan otot') ? true : x.strength }))}>{t}</button>
          ))}
        </div>
      </Field>
      <div className="row2">
        <Field label="Durasi (menit)"><input type="number" min="1" value={f.minutes} onChange={(e) => setF((x) => ({ ...x, minutes: e.target.value }))} /></Field>
        <Field label="Tanggal"><input type="date" value={f.date} onChange={(e) => setF((x) => ({ ...x, date: e.target.value }))} /></Field>
      </div>
      <div className="chips">{[15, 30, 45, 60].map((m) => <button key={m} type="button" className="chip" onClick={() => setF((x) => ({ ...x, minutes: m }))}>{m} menit</button>)}</div>
      <label className="checkbox"><input type="checkbox" checked={f.strength} onChange={(e) => setF((x) => ({ ...x, strength: e.target.checked }))} /> Termasuk latihan otot</label>
    </Modal>
  );
}

function WeightModal({ today, last, onClose }) {
  const { api } = useData();
  const [kg, setKg] = useState(last ? last.kg : '');
  const [date, setDate] = useState(today);
  const save = () => {
    const v = Number(String(kg).replace(',', '.'));
    if (!(v > 20 && v < 300)) return toast('Masukkan berat yang valid', 'error');
    api.put('weights', date, { date, kg: v });
    if (last) {
      const d = Math.round((v - last.kg) * 10) / 10;
      toast(d < 0 ? `Turun ${-d} kg sejak ${fmtShort(last.date)} 🎉` : d > 0 ? `Naik ${d} kg — tidak apa, fokus konsisten minggu ini.` : 'Berat stabil.', d <= 0 ? 'success' : 'info');
    }
    onClose();
  };
  return (
    <Modal title="Catat Berat Badan" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Batal</button><button className="btn btn-primary" onClick={save}>Simpan</button></>}>
      <div className="row2">
        <Field label="Berat (kg)"><input type="number" step="0.1" inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} autoFocus /></Field>
        <Field label="Tanggal"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      <p className="muted small">Tips: timbang di jam yang sama (pagi, setelah ke toilet, sebelum makan) agar hasilnya konsisten.</p>
    </Modal>
  );
}
