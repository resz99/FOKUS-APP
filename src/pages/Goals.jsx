import { useMemo, useState } from 'react';
import { useData } from '../lib/store.jsx';
import { analyze, STATUS_LABEL } from '../lib/goals.js';
import { todayKey, fmtShort } from '../lib/dates.js';
import { ACCOUNTS, ACCOUNT_KEYS } from '../lib/constants.js';
import { Card, Modal, Field, Progress, StatusBadge, toast, fmtMin, Empty } from '../components/ui.jsx';

const r1 = (v) => Math.round(v * 10) / 10;

export default function Goals() {
  const data = useData();
  const [edit, setEdit] = useState(null); // goal | 'new'
  const today = todayKey();
  return (
    <div className="page">
      <div className="page-head row-between">
        <div><h1>Target</h1><p className="muted">Progress semua tujuanmu & ritme yang dibutuhkan.</p></div>
        <button className="btn btn-primary" onClick={() => setEdit('new')}>+ Target Baru</button>
      </div>
      {!data.goals.length && <Empty>Belum ada target.</Empty>}
      <div className="grid">
        {data.goals.map((g) => <GoalCard key={g.id} goal={g} today={today} onEdit={() => setEdit(g)} />)}
      </div>
      {data.archivedGoals.length > 0 && (
        <details className="archived">
          <summary>{data.archivedGoals.length} target diarsipkan</summary>
          <ul className="plainlist">
            {data.archivedGoals.map((g) => (
              <li key={g.id}><span className="grow">{g.name}</span>
                <button className="btn btn-sm" onClick={() => data.api.update('goals', g.id, { archived: false })}>Aktifkan lagi</button></li>
            ))}
          </ul>
        </details>
      )}
      {edit && <GoalModal goal={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function GoalCard({ goal, today, onEdit }) {
  const data = useData();
  const a = analyze(goal, data, today);
  const color = goal.kind === 'count' && goal.source === 'content' ? ACCOUNTS[goal.account]?.color
    : goal.kind === 'weight' ? 'var(--c-weight)' : goal.kind === 'weekly' ? 'var(--c-health)' : 'var(--accent)';
  const addManual = (n) => {
    const log = { ...(goal.manualLog || {}) };
    log[today] = Math.max(0, (log[today] || 0) + n);
    data.api.update('goals', goal.id, { manualCount: Math.max(0, (goal.manualCount || 0) + n), manualLog: log });
  };
  return (
    <Card className="goal-card">
      <div className="goal-head">
        <h3>{goal.name}</h3>
        <StatusBadge status={a.status} label={STATUS_LABEL[a.status]} />
      </div>

      {a.kind === 'count' && (
        <>
          <div className="big-num"><span>{a.current}</span><span className="muted">/ {a.target} {goal.unit}</span></div>
          <Progress value={a.pct} color={color} />
          <div className="goal-meta">
            <span>{Math.round(a.pct * 100)}%</span>
            <span>Deadline {fmtShort(goal.deadline)} · {a.status === 'notstarted' ? `mulai ${fmtShort(goal.startDate)}` : `sisa ${a.daysLeft} hari`}</span>
          </div>
          {['ontrack', 'behind'].includes(a.status) && (
            <p className="small">Butuh <b>±{r1(a.perWeek)}/minggu</b> ({r1(a.perDay)}/hari).
              {a.status === 'behind' && <span className="danger-text"> Tertinggal {a.gap} dari jadwal.</span>}</p>
          )}
          {goal.source === 'manual' && a.status !== 'done' && (
            <div className="row-inline"><button className="btn btn-sm" onClick={() => addManual(-1)}>−1</button><button className="btn btn-sm btn-primary" onClick={() => addManual(1)}>+1</button></div>
          )}
        </>
      )}

      {a.kind === 'weight' && (
        <>
          <div className="big-num"><span>{a.current}</span><span className="muted">kg → {a.target} kg</span></div>
          <Progress value={a.pct} color={color} />
          <div className="goal-meta">
            <span>{a.status === 'done' ? 'Tercapai' : `kurang ${a.need} kg`}</span>
            <span>Deadline {fmtShort(goal.deadline)} · {a.status === 'notstarted' ? `mulai ${fmtShort(goal.startDate)}` : `sisa ${a.daysLeft} hari`}</span>
          </div>
          {a.status === 'behind' && <p className="small danger-text">Seharusnya sekitar {a.expected} kg saat ini.</p>}
          {!a.lastDate && <p className="small muted">Belum ada data timbangan — catat di halaman Sehat.</p>}
        </>
      )}

      {a.kind === 'weekly' && (
        <>
          <div className="big-num"><span>{fmtMin(a.minutes)}</span><span className="muted">/ {fmtMin(a.targetMin)} minggu ini</span></div>
          <Progress value={a.pct} color={color} />
          <div className="goal-meta">
            <span>Latihan otot {a.strength}/{a.targetStr}</span>
            <span>🔥 Streak {a.streak} minggu</span>
          </div>
        </>
      )}

      {a.realism && a.realism !== 'ok' && a.status !== 'done' && (
        <div className={`realism realism-${a.realism}`}>
          {a.realism === 'unrealistic' ? '⛔ ' : '⚠ '}{a.realismMsg}
        </div>
      )}
      <div className="goal-foot"><button className="link-btn" onClick={onEdit}>Edit</button></div>
    </Card>
  );
}

function GoalModal({ goal, onClose }) {
  const data = useData();
  const today = todayKey();
  const [f, setF] = useState(() => goal ? { ...goal } : {
    name: '', kind: 'count', source: 'content', account: 'clipper', startValue: 0, targetValue: 100, unit: 'konten',
    startDate: today, deadline: '', weeklyMinutes: 150, weeklyStrength: 2,
  });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'number' ? e.target.value : e.target.value }));
  const setKind = (kind) => setF((x) => ({
    ...x, kind,
    unit: kind === 'weight' ? 'kg' : kind === 'weekly' ? 'menit' : x.source === 'content' ? 'konten' : '',
    deadline: kind === 'weekly' ? '2099-12-31' : x.deadline === '2099-12-31' ? '' : x.deadline,
  }));

  const preview = useMemo(() => {
    if (f.kind !== 'weekly' && (!f.deadline || f.deadline < f.startDate)) return null;
    const g = { ...f, startValue: Number(f.startValue), targetValue: Number(f.targetValue), manualCount: f.manualCount || 0 };
    // Untuk cek realistis target baru, anggap progres mulai dari nilai awal
    const fakeData = goal ? data : { ...data, contents: f.source === 'content' ? [] : data.contents, weights: [] };
    return analyze(g, fakeData, today > f.startDate ? today : f.startDate);
  }, [f, data, goal, today]);

  const save = () => {
    if (!f.name.trim()) return toast('Isi nama target', 'error');
    if (f.kind !== 'weekly' && !f.deadline) return toast('Isi deadline', 'error');
    const clean = {
      name: f.name.trim(), kind: f.kind, unit: f.unit || '', startDate: f.startDate, deadline: f.deadline,
      startValue: Number(f.startValue) || 0, targetValue: Number(f.targetValue) || 0,
    };
    if (f.kind === 'count') { clean.source = f.source; clean.account = f.source === 'content' ? f.account : null; }
    if (f.kind === 'weekly') { clean.weeklyMinutes = Number(f.weeklyMinutes) || 0; clean.weeklyStrength = Number(f.weeklyStrength) || 0; }
    if (goal) data.api.update('goals', goal.id, clean);
    else data.api.add('goals', { ...clean, order: Date.now(), manualCount: 0 });
    onClose();
  };

  return (
    <Modal title={goal ? 'Edit Target' : 'Target Baru'} onClose={onClose}
      footer={<>
        {goal && <button className="btn btn-ghost" onClick={() => { data.api.update('goals', goal.id, { archived: true }); onClose(); }}>Arsipkan</button>}
        {goal && <button className="btn btn-danger" onClick={() => { if (confirm('Hapus target ini?')) { data.api.remove('goals', goal.id); onClose(); } }}>Hapus</button>}
        <span className="grow" />
        <button className="btn" onClick={onClose}>Batal</button>
        <button className="btn btn-primary" onClick={save}>Simpan</button>
      </>}>
      <Field label="Nama target"><input value={f.name} onChange={set('name')} placeholder="mis. 50 Klip YT Shorts" autoFocus /></Field>
      <Field label="Jenis target">
        <div className="segmented">
          <button className={f.kind === 'count' ? 'active' : ''} onClick={() => setKind('count')}>Hitungan</button>
          <button className={f.kind === 'weight' ? 'active' : ''} onClick={() => setKind('weight')}>Angka naik/turun</button>
          <button className={f.kind === 'weekly' ? 'active' : ''} onClick={() => setKind('weekly')}>Mingguan</button>
        </div>
      </Field>

      {f.kind === 'count' && (
        <>
          <Field label="Dihitung dari">
            <select value={f.source} onChange={(e) => setF((x) => ({ ...x, source: e.target.value, unit: e.target.value === 'content' ? 'konten' : x.unit }))}>
              <option value="content">Konten yang diposting (otomatis)</option>
              <option value="manual">Manual (tombol +1)</option>
            </select>
          </Field>
          {f.source === 'content' ? (
            <Field label="Akun konten">
              <select value={f.account} onChange={set('account')}>{ACCOUNT_KEYS.map((k) => <option key={k} value={k}>{ACCOUNTS[k].label}</option>)}</select>
            </Field>
          ) : (
            <Field label="Satuan"><input value={f.unit} onChange={set('unit')} placeholder="mis. buku, sesi, klien" /></Field>
          )}
          <div className="row2">
            <Field label="Sudah tercapai" hint="Progres sebelum dicatat di aplikasi"><input type="number" min="0" value={f.startValue} onChange={set('startValue')} /></Field>
            <Field label="Target"><input type="number" min="1" value={f.targetValue} onChange={set('targetValue')} /></Field>
          </div>
        </>
      )}
      {f.kind === 'weight' && (
        <div className="row2">
          <Field label="Nilai awal"><input type="number" step="0.1" value={f.startValue} onChange={set('startValue')} /></Field>
          <Field label="Target"><input type="number" step="0.1" value={f.targetValue} onChange={set('targetValue')} /></Field>
        </div>
      )}
      {f.kind === 'weekly' && (
        <div className="row2">
          <Field label="Menit olahraga / minggu" hint="WHO: 150–300 menit"><input type="number" min="0" value={f.weeklyMinutes} onChange={set('weeklyMinutes')} /></Field>
          <Field label="Sesi latihan otot / minggu" hint="WHO: minimal 2"><input type="number" min="0" value={f.weeklyStrength} onChange={set('weeklyStrength')} /></Field>
        </div>
      )}
      {f.kind !== 'weekly' && (
        <div className="row2">
          <Field label="Mulai"><input type="date" value={f.startDate} onChange={set('startDate')} /></Field>
          <Field label="Deadline"><input type="date" value={f.deadline} onChange={set('deadline')} /></Field>
        </div>
      )}

      {preview && preview.realismMsg && (
        <div className={`realism realism-${preview.realism}`}>
          <b>{preview.realism === 'ok' ? '✅ Realistis' : preview.realism === 'challenging' ? '⚠ Menantang' : '⛔ Tidak realistis'}</b>
          <span>{preview.realismMsg}</span>
          {preview.suggestDeadline && (
            <button className="link-btn" onClick={() => setF((x) => ({ ...x, deadline: preview.suggestDeadline }))}>Pakai deadline saran</button>
          )}
        </div>
      )}
    </Modal>
  );
}
