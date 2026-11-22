import { Modal } from './ui.jsx';
import { useData } from '../lib/store.jsx';
import { openIcs, googleCalendarUrl, taskEventDate, EVENT_MINUTES } from '../lib/ics.js';
import { fmtShort, HARI_PENDEK } from '../lib/dates.js';

export default function CalendarModal({ task, today, onClose }) {
  const { api } = useData();
  const when = task.type === 'routine'
    ? `Setiap ${(task.days || []).map((d) => HARI_PENDEK[d]).join(', ')} · ${task.time}`
    : `${fmtShort(taskEventDate(task, today))} · ${task.time}`;
  const mark = (v) => { api.update('tasks', task.id, { inCalendar: v }); onClose(); };
  return (
    <Modal title="Tambah ke Kalender" onClose={onClose}>
      <div className="cal-event">
        <strong>{task.title}</strong>
        <span className="muted small">{when} ({EVENT_MINUTES} menit) · pengingat tepat di jam tugas</span>
      </div>
      <ol className="steps">
        <li>Ketuk <b>Buka di Kalender</b>.</li>
        <li>iPhone menampilkan detail acara → ketuk <b>Tambahkan</b> / <b>Add to Calendar</b> lalu <b>Selesai</b>.</li>
        <li>Kembali ke sini dan ketuk <b>Sudah masuk kalender</b>, supaya Fokus tidak mengirim notifikasi ganda.</li>
      </ol>
      <button className="btn btn-primary" onClick={() => openIcs(task, today)}>📅 Buka di Kalender</button>
      <a className="link-btn" href={googleCalendarUrl(task, today)} target="_blank" rel="noreferrer">Tidak muncul? Pakai Google Calendar →</a>
      <div className="option-block">
        <h4>🔔 Supaya bunyinya terdengar jelas</h4>
        <p className="small">Pengaturan iPhone → <b>Notifikasi</b> → <b>Kalender</b> → aktifkan <b>Suara</b>, dan pilih gaya peringatan <b>Persisten</b>. Pastikan tombol senyap di samping iPhone tidak aktif.</p>
      </div>
      <div className="modal-actions">
        {task.inCalendar
          ? <button className="btn" onClick={() => mark(false)}>Tandai belum di kalender</button>
          : <button className="btn" onClick={onClose}>Nanti saja</button>}
        <button className="btn btn-primary" onClick={() => mark(true)}>✓ Sudah masuk kalender</button>
      </div>
    </Modal>
  );
}
