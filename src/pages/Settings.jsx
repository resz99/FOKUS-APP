import { useState } from 'react';
import { useData } from '../lib/store.jsx';
import { enablePush, pushStatus } from '../lib/push.js';
import { doLogout } from '../App.jsx';
import { Card, Field, toast } from '../components/ui.jsx';
import { COLLECTIONS } from '../lib/backend.js';
import { todayKey } from '../lib/dates.js';

export default function Settings({ user }) {
  const data = useData();
  const [status, setStatus] = useState(pushStatus());
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('fokus-theme') || 'dark'; } catch { return 'dark'; } });

  const turnOn = async () => {
    setBusy(true);
    try {
      await enablePush(user.uid);
      setStatus('granted');
      toast('Notifikasi aktif di perangkat ini ✓', 'success');
    } catch (e) {
      toast(e.message, 'error');
      setStatus(pushStatus());
    } finally { setBusy(false); }
  };
  const saveSetting = (key, value) => {
    const { id, ...cur } = data.settings;
    data.api.put('meta', 'settings', { ...cur, [key]: value });
    toast(`Jam notifikasi diubah ke ${value}`, 'success');
  };
  const changeTheme = (t) => {
    setTheme(t);
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('fokus-theme', t); } catch { /* abaikan */ }
  };
  const exportData = () => {
    const out = {};
    COLLECTIONS.forEach((c) => {
      if (c === 'meta') return;
      out[c] = c === 'days' ? Object.values(data.days) : c === 'goals' ? [...data.goals, ...data.archivedGoals] : data[c];
    });
    out.settings = data.settings;
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fokus-backup-${todayKey()}.json`;
    a.click();
  };

  return (
    <div className="page">
      <div className="page-head"><h1>Pengaturan</h1></div>
      <div className="grid">
        <Card title="Akun">
          {user.demo ? (
            <p className="small">Kamu sedang di <b>Mode Demo</b>: data hanya tersimpan di browser ini, tanpa sinkron dan notifikasi push. Isi <code>src/firebase-config.js</code> untuk mengaktifkan mode cloud (lihat PANDUAN-SETUP.md).</p>
          ) : (
            <>
              <p className="small">Masuk sebagai <b>{user.email}</b>. Data tersinkron otomatis di semua perangkat.</p>
              <button className="btn" onClick={doLogout}>Keluar</button>
            </>
          )}
        </Card>

        <Card title="Notifikasi">
          <div className="row2">
            <Field label="☀️ 3 Prioritas & kuota">
              <TimeSelect value={data.settings.morningTime} onChange={(v) => saveSetting('morningTime', v)} />
            </Field>
            <Field label="🌙 Evaluasi harian">
              <TimeSelect value={data.settings.eveningTime} onChange={(v) => saveSetting('eveningTime', v)} />
            </Field>
          </div>
          <ul className="tips">
            <li><b>Minggu 20.00</b> — Ringkasan mingguan + pengingat timbang</li>
            <li><b>Tugas berjam</b> — diingatkan di jamnya, kecuali yang sudah masuk Kalender iPhone</li>
            <li>Evaluasi tidak dikirim bila sudah diisi. Notifikasi bisa telat ±5–20 menit.</li>
          </ul>
          {status === 'granted' && <p className="small success-text">✓ Notifikasi aktif di perangkat ini.</p>}
          {status === 'denied' && <p className="small danger-text">Izin notifikasi diblokir. Buka pengaturan situs di browser → izinkan Notifikasi, lalu tekan tombol di bawah.</p>}
          {status === 'unsupported' && <p className="small danger-text">Browser ini tidak mendukung notifikasi. Di iPhone: buka di Safari → Bagikan → “Tambah ke Layar Utama”, lalu buka dari ikon tersebut.</p>}
          {status === 'demo' && <p className="small muted">Notifikasi push butuh mode cloud (Firebase).</p>}
          {status !== 'demo' && (
            <button className="btn btn-primary" onClick={turnOn} disabled={busy}>
              {busy ? 'Mengaktifkan…' : status === 'granted' ? 'Daftarkan ulang perangkat ini' : 'Aktifkan notifikasi di perangkat ini'}
            </button>
          )}
          <p className="muted small">Aktifkan di setiap perangkat (HP & laptop) yang ingin menerima pengingat.</p>
        </Card>

        <Card title="Tampilan">
          <div className="segmented">
            <button className={theme === 'dark' ? 'active' : ''} onClick={() => changeTheme('dark')}>Gelap</button>
            <button className={theme === 'light' ? 'active' : ''} onClick={() => changeTheme('light')}>Terang</button>
          </div>
        </Card>

        <Card title="Data">
          <p className="small muted">Unduh cadangan semua data (JSON).</p>
          <button className="btn" onClick={exportData}>Ekspor data</button>
        </Card>
      </div>
    </div>
  );
}

const TIMES = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`);
function TimeSelect({ value, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {TIMES.map((t) => <option key={t} value={t}>{t.replace(':', '.')}</option>)}
    </select>
  );
}
