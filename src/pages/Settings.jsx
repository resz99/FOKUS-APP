import { useState } from 'react';
import { useData } from '../lib/store.jsx';
import { enablePush, pushStatus } from '../lib/push.js';
import { doLogout } from '../App.jsx';
import { Card, toast } from '../components/ui.jsx';
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
  const changeTheme = (t) => {
    setTheme(t);
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('fokus-theme', t); } catch { /* abaikan */ }
  };
  const exportData = () => {
    const out = {};
    COLLECTIONS.forEach((c) => {
      out[c] = c === 'days' ? Object.values(data.days) : c === 'goals' ? [...data.goals, ...data.archivedGoals] : data[c];
    });
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
          <ul className="tips">
            <li><b>08.00</b> — Tentukan 3 prioritas + kuota konten hari ini</li>
            <li><b>23.00</b> — Evaluasi harian (dilewati bila sudah diisi)</li>
            <li><b>Minggu 20.00</b> — Ringkasan mingguan + pengingat timbang</li>
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
