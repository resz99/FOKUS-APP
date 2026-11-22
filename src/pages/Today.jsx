import { useState } from 'react';
import { useData, saveDay } from '../lib/store.jsx';
import { analyze, weekWorkout } from '../lib/goals.js';
import { todayKey, addDays, fmtLong, fmtShort, dayOfWeek, HARI_PENDEK } from '../lib/dates.js';
import { ACCOUNTS } from '../lib/constants.js';
import { Card, Empty, Modal, Field, Progress, toast, fmtMin } from '../components/ui.jsx';
import { PostModal } from '../components/ContentForms.jsx';
import CalendarModal from '../components/CalendarModal.jsx';

export default function Today() {
  const today = todayKey();
  const hour = new Date().getHours();
  const greet = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam';
  return (
    <div className="page">
      <div className="page-head">
        <p className="muted">{fmtLong(today)}</p>
        <h1>{greet} 👋</h1>
      </div>
      <div className="grid">
        <Priorities today={today} />
        <Quota today={today} />
        <Tasks today={today} />
        <Routines today={today} />
        <WorkoutMini today={today} />
      </div>
    </div>
  );
}

// ---------------- 3 Prioritas ----------------
function Priorities({ today }) {
  const { days, api } = useData();
  const day = days[today] || {};
  const pr = (day.priorities || []).filter((p) => p.text);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(['', '', '']);

  const startEdit = () => {
    setDraft([0, 1, 2].map((i) => pr[i]?.text || ''));
    setEditing(true);
  };
  const save = () => {
    const list = draft.map((t) => t.trim()).filter(Boolean).slice(0, 3)
      .map((text) => ({ text, done: pr.find((p) => p.text === text)?.done || false }));
    saveDay(api, days, today, { priorities: list });
    setEditing(false);
  };
  const toggle = (i) => {
    const list = pr.map((p, j) => (j === i ? { ...p, done: !p.done } : p));
    saveDay(api, days, today, { priorities: list });
    if (!pr[i].done && list.every((p) => p.done)) toast('🎉 3 prioritas hari ini selesai!', 'success');
  };
  const doneCount = pr.filter((p) => p.done).length;

  if (editing || pr.length === 0) {
    return (
      <Card title="3 Prioritas Hari Ini" className="card-priority">
        <p className="muted small">Pilih maksimal 3 hal terpenting. Sisanya boleh menunggu.</p>
        {draft.map((t, i) => (
          <input key={i} className="prio-input" value={t} placeholder={`Prioritas ${i + 1}`}
            onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? e.target.value : x)))}
            onKeyDown={(e) => e.key === 'Enter' && save()} />
        ))}
        <div className="actions">
          {editing && <button className="btn" onClick={() => setEditing(false)}>Batal</button>}
          <button className="btn btn-primary" onClick={save} disabled={!draft.some((t) => t.trim())}>Simpan prioritas</button>
        </div>
      </Card>
    );
  }
  return (
    <Card title="3 Prioritas Hari Ini" className="card-priority"
      action={<button className="link-btn" onClick={startEdit}>Ubah</button>}>
      <Progress value={doneCount / pr.length} thin />
      <ul className="checklist">
        {pr.map((p, i) => (
          <li key={i} className={p.done ? 'done' : ''}>
            <button className="check" aria-pressed={p.done} onClick={() => toggle(i)} aria-label="Tandai selesai">{p.done ? '✓' : ''}</button>
            <span className="prio-num">{i + 1}</span>
            <span className="grow">{p.text}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ---------------- Kuota konten otomatis ----------------
function Quota({ today }) {
  const data = useData();
  const [postFor, setPostFor] = useState(null);
  const rows = data.goals
    .filter((g) => g.kind === 'count' && g.source === 'content')
    .map((g) => ({ g, a: analyze(g, data, today) }))
    .filter(({ a }) => a.status !== 'notstarted');
  if (!rows.length) return null;
  return (
    <Card title="Kuota Konten Hari Ini">
      <p className="muted small">Dihitung otomatis dari sisa target ÷ sisa hari. Kalau kemarin kurang, kuota hari ini ikut naik.</p>
      <div className="quota-list">
        {rows.map(({ g, a }) => {
          const need = a.neededToday + a.doneToday;
          return (
            <div key={g.id} className="quota">
              <div className="quota-top">
                <span className="dot" style={{ background: ACCOUNTS[g.account]?.color }} />
                <strong>{ACCOUNTS[g.account]?.label}</strong>
                <span className="muted small grow">{a.current}/{a.target} · sisa {a.daysLeft} hari</span>
                {a.status === 'done' ? <span className="badge badge-done">Target tercapai</span>
                  : a.neededToday === 0 ? <span className="badge badge-ontrack">Kuota beres ✓</span>
                  : <span className="quota-num">{a.doneToday}/{need}</span>}
              </div>
              {a.status !== 'done' && <Progress value={need ? a.doneToday / need : 1} color={ACCOUNTS[g.account]?.color} thin />}
              {a.status !== 'done' && <button className="btn btn-sm" onClick={() => setPostFor(g.account)}>+ Catat posting</button>}
            </div>
          );
        })}
      </div>
      {postFor && <PostModal account={postFor} onClose={() => setPostFor(null)} />}
    </Card>
  );
}

// ---------------- Tugas sekali jadi ----------------
const byTime = (a, b) => (a.time || '99:99').localeCompare(b.time || '99:99');

function TaskRowExtras({ t, onCal }) {
  if (!t.time) return null;
  return (
    <button className={t.inCalendar ? 'cal-btn in' : 'cal-btn'} onClick={onCal} title="Tambah ke Kalender" aria-label="Tambah ke Kalender">
      {t.inCalendar ? '📅✓' : '📅'}
    </button>
  );
}

function Tasks({ today }) {
  const { tasks, api } = useData();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [calFor, setCalFor] = useState(null);
  const [stuck, setStuck] = useState(null);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const once = tasks.filter((t) => t.type === 'once');
  const active = once.filter((t) => !t.done && t.dueDate <= today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || byTime(a, b));
  const upcoming = once.filter((t) => !t.done && t.dueDate > today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || byTime(a, b));
  const doneToday = once.filter((t) => t.done && t.doneDate === today);

  const complete = (t) => api.update('tasks', t.id, { done: true, doneDate: today });
  const undo = (t) => api.update('tasks', t.id, { done: false, doneDate: null });
  const postpone = (t) => {
    const n = (t.postponeCount || 0) + 1;
    api.update('tasks', t.id, { dueDate: addDays(today, 1), postponeCount: n, inCalendar: false });
    if (n >= 3) toast('Tugas ini sudah ditunda 3x. Coba pecah jadi langkah kecil.', 'warn');
    else if (t.inCalendar) toast('Ditunda ke besok. Jangan lupa ubah acaranya di Kalender iPhone.', 'info');
  };

  return (
    <Card title="Tugas" action={<button className="btn btn-sm" onClick={() => setAdding(true)}>+ Tugas</button>}>
      {!active.length && !doneToday.length && <Empty>Tidak ada tugas untuk hari ini.</Empty>}
      <ul className="checklist">
        {active.map((t) => (
          <li key={t.id} className={t.postponeCount >= 3 ? 'stuck' : ''}>
            <button className="check" onClick={() => complete(t)} aria-label="Tandai selesai" />
            <div className="grow">
              <div className="task-title" onClick={() => setEditing(t)} role="button" tabIndex={0}>
                {t.time && <span className="task-time">{t.time}</span>}{t.title}
              </div>
              <div className="meta">
                {t.dueDate < today && <span className="overdue">Terlambat sejak {fmtShort(t.dueDate)}</span>}
                {t.postponeCount > 0 && <span>Ditunda {t.postponeCount}x</span>}
                {t.time && (t.inCalendar ? <span>Pengingat: Kalender iPhone</span> : <span>Pengingat: notifikasi Fokus</span>)}
              </div>
              {t.postponeCount >= 3 && (
                <button className="link-btn warn" onClick={() => setStuck(t)}>⚠ Sudah ditunda {t.postponeCount}x — atasi sekarang</button>
              )}
            </div>
            <TaskRowExtras t={t} onCal={() => setCalFor(t)} />
            <button className="btn btn-ghost btn-sm" onClick={() => postpone(t)} title="Tunda ke besok">Besok →</button>
          </li>
        ))}
        {doneToday.map((t) => (
          <li key={t.id} className="done">
            <button className="check" aria-pressed="true" onClick={() => undo(t)} aria-label="Batalkan">✓</button>
            <span className="grow">{t.time && <span className="task-time">{t.time}</span>}{t.title}</span>
          </li>
        ))}
      </ul>
      {upcoming.length > 0 && (
        <>
          <button className="link-btn" onClick={() => setShowUpcoming((s) => !s)}>
            {showUpcoming ? 'Sembunyikan' : 'Lihat'} {upcoming.length} tugas mendatang
          </button>
          {showUpcoming && (
            <ul className="plainlist">
              {upcoming.map((t) => (
                <li key={t.id}>
                  <span className="muted small">{fmtShort(t.dueDate)}{t.time ? ` ${t.time}` : ''}</span>
                  <span className="grow clickable" onClick={() => setEditing(t)}>{t.title}</span>
                  <TaskRowExtras t={t} onCal={() => setCalFor(t)} />
                  <button className="icon-btn sm" aria-label="Hapus" onClick={() => api.remove('tasks', t.id)}>✕</button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {adding && <TaskModal today={today} onClose={() => setAdding(false)} onCreated={(t) => t.time && setCalFor(t)} />}
      {editing && <TaskModal today={today} task={editing} onClose={() => setEditing(null)} onCreated={(t) => t.time && setCalFor(t)} />}
      {calFor && <CalendarModal task={calFor} today={today} onClose={() => setCalFor(null)} />}
      {stuck && <StuckModal task={stuck} today={today} onClose={() => setStuck(null)} />}
    </Card>
  );
}

function StuckModal({ task, today, onClose }) {
  const { api } = useData();
  const [step, setStep] = useState('');
  const [date, setDate] = useState(addDays(today, 1));
  const split = () => {
    if (!step.trim()) return toast('Tulis langkah kecil pertamanya', 'error');
    api.add('tasks', { title: `${step.trim()} (langkah 1: ${task.title})`, type: 'once', dueDate: today, done: false, postponeCount: 0 });
    api.update('tasks', task.id, { postponeCount: 0, dueDate: addDays(today, 1) });
    toast('Langkah kecil ditambahkan untuk hari ini', 'success');
    onClose();
  };
  return (
    <Modal title="Tugas ini terus tertunda" onClose={onClose}>
      <p className="muted">“{task.title}” sudah ditunda {task.postponeCount}x. Biasanya ini tanda tugasnya terlalu besar, belum jelas, atau memang tidak penting. Pilih salah satu:</p>
      <div className="option-block">
        <h4>1. Pecah jadi langkah kecil (5–15 menit)</h4>
        <input value={step} onChange={(e) => setStep(e.target.value)} placeholder="mis. Buka file & tulis 3 poin outline" />
        <button className="btn btn-primary btn-sm" onClick={split}>Kerjakan langkah ini hari ini</button>
      </div>
      <div className="option-block">
        <h4>2. Jadwal ulang dengan sengaja</h4>
        <div className="row-inline">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button className="btn btn-sm" onClick={() => { api.update('tasks', task.id, { dueDate: date, postponeCount: 0 }); onClose(); }}>Jadwalkan</button>
        </div>
      </div>
      <div className="option-block">
        <h4>3. Hapus — ternyata tidak penting</h4>
        <button className="btn btn-danger btn-sm" onClick={() => { api.remove('tasks', task.id); onClose(); }}>Hapus tugas</button>
      </div>
    </Modal>
  );
}

export function TaskModal({ today, onClose, defaultType = 'once', task, onCreated }) {
  const { api } = useData();
  const [type, setType] = useState(task?.type || defaultType);
  const [title, setTitle] = useState(task?.title || '');
  const [due, setDue] = useState(task?.dueDate || today);
  const [time, setTime] = useState(task?.time || '');
  const [daysSel, setDaysSel] = useState(task?.days || [1, 2, 3, 4, 5]);
  const save = () => {
    if (!title.trim()) return toast('Isi nama tugas dulu', 'error');
    if (type === 'routine' && !daysSel.length) return toast('Pilih minimal 1 hari', 'error');
    const data = type === 'once'
      ? { title: title.trim(), type, dueDate: due, time: time || null }
      : { title: title.trim(), type, days: [...daysSel].sort(), time: time || null, active: true };
    if (task) {
      const scheduleChanged = task.time !== data.time || (type === 'once' ? task.dueDate !== due : String(task.days) !== String(data.days));
      if (scheduleChanged && task.inCalendar) {
        data.inCalendar = false;
        toast('Jadwal berubah — hapus acara lama di Kalender iPhone, lalu tambahkan lagi.', 'warn');
      }
      if (scheduleChanged) data.remindedOn = null;
      api.update('tasks', task.id, data);
      onClose();
      if (scheduleChanged && data.time && onCreated) onCreated({ ...task, ...data });
      return;
    }
    const extra = type === 'once' ? { done: false, postponeCount: 0 } : {};
    const p = api.add('tasks', { ...data, ...extra, inCalendar: false });
    onClose();
    if (data.time && onCreated && p?.id) onCreated({ id: p.id, ...data, ...extra, inCalendar: false });
  };
  const remove = () => {
    if (!confirm('Hapus tugas ini?')) return;
    api.remove('tasks', task.id);
    if (task.inCalendar) toast('Tugas dihapus. Hapus juga acaranya di Kalender iPhone.', 'info');
    onClose();
  };
  return (
    <Modal title={task ? 'Edit Tugas' : 'Tambah Tugas'} onClose={onClose}
      footer={<>
        {task && <button className="btn btn-danger" onClick={remove}>Hapus</button>}
        <span className="grow" />
        <button className="btn" onClick={onClose}>Batal</button>
        <button className="btn btn-primary" onClick={save}>Simpan</button>
      </>}>
      {!task && (
        <div className="segmented">
          <button className={type === 'once' ? 'active' : ''} onClick={() => setType('once')}>Sekali jadi</button>
          <button className={type === 'routine' ? 'active' : ''} onClick={() => setType('routine')}>Rutinitas</button>
        </div>
      )}
      <Field label="Nama tugas"><input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={!task}
        placeholder={type === 'once' ? 'mis. Meeting progres proyek' : 'mis. Olahraga pagi'} onKeyDown={(e) => e.key === 'Enter' && save()} /></Field>
      {type === 'once' ? (
        <div className="row2">
          <Field label="Tanggal"><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
          <Field label="Jam (opsional)"><TimeInput value={time} onChange={setTime} /></Field>
        </div>
      ) : (
        <>
          <Field label="Ulangi setiap">
            <div className="chips">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <button type="button" key={d} className={daysSel.includes(d) ? 'chip active' : 'chip'}
                  onClick={() => setDaysSel((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]))}>{HARI_PENDEK[d]}</button>
              ))}
            </div>
          </Field>
          <Field label="Jam (opsional)"><TimeInput value={time} onChange={setTime} /></Field>
        </>
      )}
      <p className="muted small">{time
        ? '⏰ Tugas berjam bisa ditambahkan ke Kalender iPhone agar pengingatnya berbunyi tepat waktu.'
        : 'Isi jam bila tugas ini perlu pengingat.'}</p>
    </Modal>
  );
}

function TimeInput({ value, onChange }) {
  return (
    <div className="time-input">
      <input type="time" value={value} onChange={(e) => onChange(e.target.value)} />
      {value && <button type="button" className="icon-btn sm" aria-label="Hapus jam" onClick={() => onChange('')}>✕</button>}
    </div>
  );
}

// ---------------- Rutinitas ----------------
function Routines({ today }) {
  const { tasks, days, api } = useData();
  const [adding, setAdding] = useState(false);
  const [manage, setManage] = useState(false);
  const [editing, setEditing] = useState(null);
  const [calFor, setCalFor] = useState(null);
  const dow = dayOfWeek(today);
  const routines = tasks.filter((t) => t.type === 'routine' && t.active !== false);
  const todays = routines.filter((t) => (t.days || []).includes(dow)).sort(byTime);
  const doneMap = days[today]?.routineDone || {};
  const toggle = (t) => saveDay(api, days, today, { routineDone: { ...doneMap, [t.id]: !doneMap[t.id] } });
  const count = todays.filter((t) => doneMap[t.id]).length;
  return (
    <Card title="Rutinitas" action={
      <div className="row-inline">
        {routines.length > 0 && <button className="link-btn" onClick={() => setManage(true)}>Kelola</button>}
        <button className="btn btn-sm" onClick={() => setAdding(true)}>+ Rutin</button>
      </div>}>
      {!todays.length ? <Empty>{routines.length ? 'Tidak ada rutinitas terjadwal hari ini.' : 'Belum ada rutinitas. Contoh: “Olahraga 30 menit”, “Review kalender konten”.'}</Empty> : (
        <>
          <Progress value={count / todays.length} thin />
          <ul className="checklist">
            {todays.map((t) => (
              <li key={t.id} className={doneMap[t.id] ? 'done' : ''}>
                <button className="check" aria-pressed={!!doneMap[t.id]} onClick={() => toggle(t)} aria-label="Tandai">{doneMap[t.id] ? '✓' : ''}</button>
                <span className="grow task-title" onClick={() => setEditing(t)} role="button" tabIndex={0}>
                  {t.time && <span className="task-time">{t.time}</span>}{t.title}
                </span>
                <TaskRowExtras t={t} onCal={() => setCalFor(t)} />
              </li>
            ))}
          </ul>
        </>
      )}
      {adding && <TaskModal today={today} defaultType="routine" onClose={() => setAdding(false)} onCreated={(t) => t.time && setCalFor(t)} />}
      {editing && <TaskModal today={today} task={editing} onClose={() => setEditing(null)} onCreated={(t) => t.time && setCalFor(t)} />}
      {calFor && <CalendarModal task={calFor} today={today} onClose={() => setCalFor(null)} />}
      {manage && (
        <Modal title="Kelola Rutinitas" onClose={() => setManage(false)}>
          <ul className="plainlist">
            {routines.map((t) => (
              <li key={t.id}>
                <span className="grow clickable" onClick={() => { setManage(false); setEditing(t); }}>{t.title}<br /><span className="muted small">{(t.days || []).map((d) => HARI_PENDEK[d]).join(', ')}{t.time ? ` · ${t.time}` : ''}{t.inCalendar ? ' · 📅' : ''}</span></span>
                <button className="btn btn-danger btn-sm" onClick={() => api.remove('tasks', t.id)}>Hapus</button>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </Card>
  );
}

// ---------------- Ringkas olahraga minggu ini ----------------
function WorkoutMini({ today }) {
  const data = useData();
  const g = data.goals.find((x) => x.kind === 'weekly');
  if (!g) return null;
  const a = analyze(g, data, today);
  const wk = weekWorkout(data.workouts, today);
  return (
    <Card title="Olahraga Minggu Ini" action={<a className="link-btn" href="#/sehat">Catat →</a>}>
      <div className="stat-row">
        <div><div className="stat">{fmtMin(wk.minutes)}</div><div className="muted small">dari {fmtMin(a.targetMin)}</div></div>
        <div><div className="stat">{wk.strength}/{a.targetStr}</div><div className="muted small">sesi latihan otot</div></div>
      </div>
      <Progress value={a.pct} color="var(--c-health)" />
      {a.status !== 'done' && a.remainingMin > 0 && (
        <p className="muted small">Sisa {fmtMin(a.remainingMin)} dalam {a.daysLeft} hari → ±{fmtMin(a.perDay)}/hari.</p>
      )}
      {a.status === 'done' && <p className="small success-text">Target minggu ini tercapai 💪</p>}
    </Card>
  );
}
