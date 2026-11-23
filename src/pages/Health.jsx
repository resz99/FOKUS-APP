import { useState } from 'react';
import { useData } from '../lib/store.jsx';
import { analyze, weekWorkout, latestWeight } from '../lib/goals.js';
import { todayKey, weekStart, addDays, fmtShort } from '../lib/dates.js';
import { WORKOUT_TYPES, WORKOUT_ICON } from '../lib/constants.js';
import { fmtKm, fmtPaceOrSpeed } from '../lib/workout.js';
import { stravaConfigured, stravaAuthorizeUrl } from '../lib/strava.js';
import { Card, Modal, Field, Progress, Empty, toast, fmtMin } from '../components/ui.jsx';
import { BarChart, LineChart } from '../components/Charts.jsx';
import WorkoutDetail, { PhotoPicker, savePhoto } from '../components/WorkoutDetail.jsx';

const sortW = (a, b) => b.date.localeCompare(a.date) || (b.startTime || '').localeCompare(a.startTime || '');

export default function Health() {
  const data = useData();
  const { workouts, weights, goals } = data;
  const today = todayKey();
  const [addW, setAddW] = useState(false);
  const [addKg, setAddKg] = useState(false);
  const [detail, setDetail] = useState(null);
  const weekly = goals.find((g) => g.kind === 'weekly');
  const a = weekly ? analyze(weekly, data, today) : null;
  const wk = weekWorkout(workouts, today);
  const weekKm = wk.list.reduce((s, w) => s + (w.distanceM || 0), 0);
  const weekKcal = wk.list.reduce((s, w) => s + (w.calories || 0), 0);
  const weightGoals = goals.filter((g) => g.kind === 'weight');
  const lw = latestWeight(weights, today);
  const weighedThisWeek = weights.some((w) => w.date >= weekStart(today));
  const recent = workouts.filter((w) => w.date < weekStart(today)).sort(sortW).slice(0, 15);
  const current = detail && workouts.find((w) => w.id === detail);

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
              {weekKm > 0 && <div><div className="stat">{fmtKm(weekKm)}</div><div className="muted small">jarak</div></div>}
              {weekKcal > 0 && <div><div className="stat">{weekKcal.toLocaleString('id-ID')}</div><div className="muted small">kkal</div></div>}
              <div><div className="stat">🔥 {a.streak}</div><div className="muted small">minggu berturut</div></div>
            </div>
            <Progress value={a.pct} color="var(--c-health)" />
            <p className="small muted">
              {a.status === 'done' ? 'Target minggu ini tercapai. Mantap!' : `Sisa ${fmtMin(a.remainingMin)}${a.remainingStr ? ` + ${a.remainingStr} sesi otot` : ''} dalam ${a.daysLeft} hari.`}
            </p>
            {!wk.list.length ? <Empty>Belum ada sesi minggu ini.</Empty> : (
              <ul className="activity-list">{wk.list.sort(sortW).map((w) => <ActivityRow key={w.id} w={w} onOpen={() => setDetail(w.id)} />)}</ul>
            )}
          </Card>
        )}

        <StravaCard />

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

        {recent.length > 0 && (
          <Card title="Aktivitas Sebelumnya">
            <ul className="activity-list">{recent.map((w) => <ActivityRow key={w.id} w={w} onOpen={() => setDetail(w.id)} />)}</ul>
          </Card>
        )}

        <Card title="Panduan (WHO)">
          <ul className="tips">
            <li><b>150–300 menit/minggu</b> aktivitas sedang (jalan cepat, bersepeda santai, renang), atau 75–150 menit aktivitas berat (lari, HIIT, sepak bola).</li>
            <li><b>Latihan otot minimal 2x/minggu</b> (push-up, squat, beban).</li>
            <li>Untuk turun berat badan, arahkan ke batas atas (±4–5 jam/minggu). Hasil terbesar tetap dari <b>pola makan & tidur cukup</b>.</li>
            <li>Penurunan aman: <b>0,5–1 kg/minggu</b>.</li>
          </ul>
        </Card>
      </div>
      {addW && <WorkoutModal today={today} onClose={() => setAddW(false)} />}
      {addKg && <WeightModal today={today} last={lw} onClose={() => setAddKg(false)} />}
      {current && <WorkoutDetail workout={current} onClose={() => setDetail(null)} />}
    </div>
  );
}

function ActivityRow({ w, onOpen }) {
  const bits = [fmtMin(w.minutes), fmtKm(w.distanceM), fmtPaceOrSpeed(w), w.avgHr && `❤️ ${w.avgHr}`, w.calories && `🔥 ${w.calories}`].filter(Boolean);
  return (
    <li className="activity-row" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <span className="activity-icon">{WORKOUT_ICON[w.type] || '🤸'}</span>
      <div className="grow">
        <div className="activity-name">{w.name || w.type}{w.strength && ' 💪'}</div>
        <div className="meta">
          <span>{fmtShort(w.date)}{w.startTime ? ` ${w.startTime}` : ''}</span>
          {bits.map((b) => <span key={b}>{b}</span>)}
        </div>
      </div>
      {w.photoId && <span title="Ada foto">📷</span>}
      {w.polyline && <span title="Ada peta rute">🗺️</span>}
      {w.source === 'strava' && <span className="strava-badge">Strava</span>}
    </li>
  );
}

function StravaCard() {
  const { strava, api } = useData();
  if (!stravaConfigured) {
    return (
      <Card title="Strava">
        <p className="small muted">Sinkron otomatis dari Strava belum diaktifkan (Client ID Strava belum dipasang).</p>
      </Card>
    );
  }
  const status = strava?.status || 'none';
  const connect = () => {
    if (api.mode === 'demo') return toast('Strava hanya bisa disambungkan di mode cloud.', 'error');
    window.location.href = stravaAuthorizeUrl();
  };
  const last = strava?.lastSyncAt ? new Date(strava.lastSyncAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;
  return (
    <Card title="Strava" action={status === 'connected' && <span className="badge badge-ontrack">Tersambung</span>}>
      {status === 'none' && (
        <>
          <p className="small">Aktivitas dari jam Huawei (via Huawei Health → Strava) dan aplikasi Strava akan <b>otomatis masuk</b> ke sini: durasi, jarak, pace, detak jantung, kalori & peta rute.</p>
          <button className="btn btn-strava" onClick={connect}>Sambungkan Strava</button>
        </>
      )}
      {status === 'pending' && <p className="small">⏳ Menghubungkan ke Strava… biasanya selesai dalam 5–15 menit. Halaman ini akan berubah otomatis.</p>}
      {status === 'disconnecting' && <p className="small">⏳ Memutuskan sambungan…</p>}
      {status === 'error' && (
        <>
          <p className="small danger-text">Gagal: {strava.error || 'tidak diketahui'}</p>
          <button className="btn btn-strava" onClick={connect}>Sambungkan ulang</button>
        </>
      )}
      {status === 'connected' && (
        <>
          <p className="small">Akun: <b>{strava.athleteName || 'Strava'}</b>{last && <> · sinkron terakhir {last}</>}{strava.requestSync ? ' · ⏳ menunggu sinkron…' : ''}</p>
          <p className="small muted">Tip: main bola yang tidak muncul di Strava? Tambahkan lewat “+ Olahraga” dengan screenshot dari Huawei Health.</p>
          <div className="row-inline">
            <button className="btn btn-sm" onClick={() => { api.update('meta', 'strava', { requestSync: Date.now() }); toast('Sinkron diminta, data masuk dalam ±5 menit.', 'info'); }}>Sinkron sekarang</button>
            <button className="btn btn-ghost btn-sm" onClick={() => confirm('Putuskan sambungan Strava? Aktivitas yang sudah masuk tetap tersimpan.') && api.update('meta', 'strava', { status: 'disconnecting' })}>Putuskan</button>
          </div>
        </>
      )}
    </Card>
  );
}

function WorkoutModal({ today, onClose }) {
  const { api } = useData();
  const [f, setF] = useState({ date: today, startTime: '', type: WORKOUT_TYPES[0], minutes: 30, strength: false, km: '', avgHr: '', calories: '' });
  const [img, setImg] = useState(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = () => {
    if (!(Number(f.minutes) > 0)) return toast('Isi durasi', 'error');
    const km = Number(String(f.km).replace(',', '.'));
    const data = {
      source: 'manual', date: f.date, startTime: f.startTime || null, type: f.type, minutes: Number(f.minutes), strength: f.strength,
      distanceM: km > 0 ? Math.round(km * 1000) : null,
      avgHr: Number(f.avgHr) > 0 ? Number(f.avgHr) : null,
      calories: Number(f.calories) > 0 ? Number(f.calories) : null,
    };
    const p = api.add('workouts', data);
    if (img) savePhoto(api, p.id, img);
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
              onClick={() => setF((x) => ({ ...x, type: t, strength: t.startsWith('Latihan otot') ? true : x.strength }))}>{WORKOUT_ICON[t]} {t}</button>
          ))}
        </div>
      </Field>
      <div className="row2">
        <Field label="Durasi (menit)"><input type="number" min="1" inputMode="numeric" value={f.minutes} onChange={set('minutes')} /></Field>
        <Field label="Tanggal"><input type="date" value={f.date} onChange={set('date')} /></Field>
      </div>
      <div className="chips">{[30, 45, 60, 90].map((m) => <button key={m} type="button" className="chip" onClick={() => setF((x) => ({ ...x, minutes: m }))}>{m} menit</button>)}</div>
      <details className="more-fields" open={f.type === 'Sepak bola' || undefined}>
        <summary>Detail dari jam / Huawei Health (opsional)</summary>
        <div className="row2">
          <Field label="Jarak (km)"><input inputMode="decimal" value={f.km} onChange={set('km')} placeholder="mis. 5,2" /></Field>
          <Field label="Jam mulai"><input type="time" value={f.startTime} onChange={set('startTime')} /></Field>
        </div>
        <div className="row2">
          <Field label="❤️ Detak jantung rata-rata"><input type="number" inputMode="numeric" value={f.avgHr} onChange={set('avgHr')} placeholder="bpm" /></Field>
          <Field label="🔥 Kalori"><input type="number" inputMode="numeric" value={f.calories} onChange={set('calories')} placeholder="kkal" /></Field>
        </div>
      </details>
      <label className="checkbox"><input type="checkbox" checked={f.strength} onChange={(e) => setF((x) => ({ ...x, strength: e.target.checked }))} /> Termasuk latihan otot</label>
      <div className="photo-field">
        {img && <img className="workout-photo" src={img.data} alt="Pratinjau" />}
        <PhotoPicker onPicked={setImg} label={img ? '📷 Ganti foto' : '📷 Lampirkan foto / screenshot'} />
      </div>
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
