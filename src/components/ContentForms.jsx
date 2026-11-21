import { useState } from 'react';
import { Modal, Field, toast } from './ui.jsx';
import { useData } from '../lib/store.jsx';
import { ACCOUNTS, ACCOUNT_KEYS } from '../lib/constants.js';
import { todayKey } from '../lib/dates.js';

export function AccountSelect({ value, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {ACCOUNT_KEYS.map((k) => <option key={k} value={k}>{ACCOUNTS[k].label}</option>)}
    </select>
  );
}

// Tandai konten "Sudah Posting" (dari ide yang ada, atau langsung baru)
export function PostModal({ account = 'pmo', item, onClose }) {
  const { api } = useData();
  const [f, setF] = useState({
    account: item?.account || account,
    title: item?.title || '',
    link: item?.link || '',
    postedDate: item?.postedDate || todayKey(),
    platforms: item?.platforms || ACCOUNTS[item?.account || account].platforms.slice(0, 2),
    views: item?.views ?? '',
  });
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const plats = ACCOUNTS[f.account].platforms;
  const save = () => {
    if (!f.title.trim()) return toast('Isi judul konten dulu', 'error');
    const data = {
      account: f.account, title: f.title.trim(), link: f.link.trim(), postedDate: f.postedDate,
      platforms: f.platforms.filter((p) => plats.includes(p)), views: f.views === '' ? null : Number(f.views), status: 'posted',
    };
    if (item) api.update('contents', item.id, data);
    else api.add('contents', { ...data, notes: '', scheduledDate: null });
    toast(`✓ Konten ${ACCOUNTS[f.account].label} tercatat`, 'success');
    onClose();
  };
  return (
    <Modal title="Catat Sudah Posting" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Batal</button><button className="btn btn-primary" onClick={save}>Simpan</button></>}>
      <Field label="Akun"><AccountSelect value={f.account} onChange={(v) => setF((x) => ({ ...x, account: v, platforms: ACCOUNTS[v].platforms.slice(0, 2) }))} /></Field>
      <Field label="Judul / topik"><input value={f.title} onChange={(e) => set('title')(e.target.value)} placeholder="mis. Tips manajemen risiko proyek" autoFocus /></Field>
      <Field label="Link postingan" hint="Opsional, tapi berguna untuk arsip"><input value={f.link} onChange={(e) => set('link')(e.target.value)} placeholder="https://…" inputMode="url" /></Field>
      <div className="row2">
        <Field label="Tanggal posting"><input type="date" value={f.postedDate} onChange={(e) => set('postedDate')(e.target.value)} /></Field>
        <Field label="Views" hint="Opsional"><input type="number" min="0" value={f.views} onChange={(e) => set('views')(e.target.value)} placeholder="—" /></Field>
      </div>
      <Field label="Diposting di" hint="Satu konten di beberapa platform tetap dihitung 1">
        <div className="chips">
          {plats.map((p) => (
            <button type="button" key={p} className={f.platforms.includes(p) ? 'chip active' : 'chip'}
              onClick={() => set('platforms')(f.platforms.includes(p) ? f.platforms.filter((x) => x !== p) : [...f.platforms, p])}>{p}</button>
          ))}
        </div>
      </Field>
    </Modal>
  );
}

export function IdeaModal({ account = 'pmo', item, onClose }) {
  const { api } = useData();
  const [f, setF] = useState({
    account: item?.account || account,
    title: item?.title || '',
    notes: item?.notes || '',
    scheduledDate: item?.scheduledDate || '',
  });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = () => {
    if (!f.title.trim()) return toast('Isi judul ide dulu', 'error');
    const data = { account: f.account, title: f.title.trim(), notes: f.notes, scheduledDate: f.scheduledDate || null };
    if (item) api.update('contents', item.id, { ...data, status: item.status === 'posted' ? 'posted' : f.scheduledDate ? 'scheduled' : 'idea' });
    else api.add('contents', { ...data, status: f.scheduledDate ? 'scheduled' : 'idea', link: '', postedDate: null });
    onClose();
  };
  return (
    <Modal title={item ? 'Edit Ide Konten' : 'Ide Konten Baru'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Batal</button><button className="btn btn-primary" onClick={save}>Simpan</button></>}>
      <Field label="Akun"><AccountSelect value={f.account} onChange={(v) => setF((x) => ({ ...x, account: v }))} /></Field>
      <Field label="Judul / topik"><input value={f.title} onChange={set('title')} placeholder="mis. 5 KPI wajib untuk PMO" autoFocus /></Field>
      <Field label="Catatan" hint="Format (reels/carousel/motion graphic), poin-poin, referensi"><textarea rows="4" value={f.notes} onChange={set('notes')} /></Field>
      <Field label="Jadwal posting" hint="Kosongkan bila masih sekadar ide"><input type="date" value={f.scheduledDate} onChange={set('scheduledDate')} /></Field>
    </Modal>
  );
}
