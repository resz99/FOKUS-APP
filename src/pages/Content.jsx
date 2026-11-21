import { useState } from 'react';
import { useData } from '../lib/store.jsx';
import { ACCOUNTS, ACCOUNT_KEYS } from '../lib/constants.js';
import { todayKey, fmtShort, toKey, HARI_PENDEK } from '../lib/dates.js';
import { Card, Empty, Segmented } from '../components/ui.jsx';
import { PostModal, IdeaModal } from '../components/ContentForms.jsx';

export default function Content() {
  const { contents, api } = useData();
  const [acc, setAcc] = useState('pmo');
  const [view, setView] = useState('ide');
  const [modal, setModal] = useState(null); // {type:'idea'|'post', item?}
  const today = todayKey();
  const mine = contents.filter((c) => acc === 'semua' || c.account === acc);
  const ideas = mine.filter((c) => c.status === 'idea').sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const scheduled = mine.filter((c) => c.status === 'scheduled').sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  const posted = mine.filter((c) => c.status === 'posted').sort((a, b) => b.postedDate.localeCompare(a.postedDate));
  const accForNew = acc === 'semua' ? 'pmo' : acc;

  return (
    <div className="page">
      <div className="page-head row-between">
        <div><h1>Konten</h1><p className="muted">Bank ide → jadwal → sudah posting.</p></div>
        <div className="row-inline">
          <button className="btn" onClick={() => setModal({ type: 'idea' })}>+ Ide</button>
          <button className="btn btn-primary" onClick={() => setModal({ type: 'post' })}>+ Sudah Posting</button>
        </div>
      </div>

      <div className="acc-tabs">
        {[...ACCOUNT_KEYS, 'semua'].map((k) => (
          <button key={k} className={acc === k ? 'acc-tab active' : 'acc-tab'} onClick={() => setAcc(k)}>
            {k !== 'semua' && <span className="dot" style={{ background: ACCOUNTS[k].color }} />}
            {k === 'semua' ? 'Semua' : ACCOUNTS[k].label}
          </button>
        ))}
      </div>

      <Segmented value={view} onChange={setView} options={[
        { value: 'ide', label: `Ide (${ideas.length})` },
        { value: 'jadwal', label: `Terjadwal (${scheduled.length})` },
        { value: 'kalender', label: 'Kalender' },
        { value: 'posted', label: `Terposting (${posted.length})` },
      ]} />

      {view === 'ide' && (
        <Card>
          {!ideas.length && <Empty>Belum ada ide. Simpan ide sekecil apa pun di sini supaya tidak bingung mulai dari mana.</Empty>}
          <ul className="content-list">
            {ideas.map((c) => <ContentRow key={c.id} c={c} showAcc={acc === 'semua'} onEdit={() => setModal({ type: 'idea', item: c })} onPost={() => setModal({ type: 'post', item: c })} onDelete={() => api.remove('contents', c.id)} />)}
          </ul>
        </Card>
      )}
      {view === 'jadwal' && (
        <Card>
          {!scheduled.length && <Empty>Belum ada konten terjadwal. Tambahkan tanggal pada ide untuk menjadwalkannya.</Empty>}
          <ul className="content-list">
            {scheduled.map((c) => <ContentRow key={c.id} c={c} today={today} showAcc={acc === 'semua'} onEdit={() => setModal({ type: 'idea', item: c })} onPost={() => setModal({ type: 'post', item: c })} onDelete={() => api.remove('contents', c.id)} />)}
          </ul>
        </Card>
      )}
      {view === 'kalender' && <Calendar items={mine} today={today} onOpen={(c) => setModal({ type: c.status === 'posted' ? 'post' : 'idea', item: c })} />}
      {view === 'posted' && (
        <Card>
          {!posted.length && <Empty>Belum ada konten yang tercatat diposting.</Empty>}
          <ul className="content-list">
            {posted.map((c) => (
              <li key={c.id} className="content-row">
                <span className="dot" style={{ background: ACCOUNTS[c.account]?.color }} />
                <div className="grow">
                  <div className="content-title">{c.title}</div>
                  <div className="meta">
                    <span>{fmtShort(c.postedDate)}</span>
                    {acc === 'semua' && <span>{ACCOUNTS[c.account]?.label}</span>}
                    {(c.platforms || []).length > 0 && <span>{c.platforms.join(' · ')}</span>}
                    {c.views != null && <span>{Number(c.views).toLocaleString('id-ID')} views</span>}
                    {c.link && <a href={c.link} target="_blank" rel="noreferrer">Buka ↗</a>}
                  </div>
                </div>
                <button className="link-btn" onClick={() => setModal({ type: 'post', item: c })}>Edit</button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {modal?.type === 'idea' && <IdeaModal account={accForNew} item={modal.item} onClose={() => setModal(null)} />}
      {modal?.type === 'post' && <PostModal account={accForNew} item={modal.item} onClose={() => setModal(null)} />}
    </div>
  );
}

function ContentRow({ c, today, showAcc, onEdit, onPost, onDelete }) {
  const late = today && c.scheduledDate && c.scheduledDate < today;
  return (
    <li className="content-row">
      <span className="dot" style={{ background: ACCOUNTS[c.account]?.color }} />
      <div className="grow" onClick={onEdit} role="button" tabIndex={0}>
        <div className="content-title">{c.title}</div>
        <div className="meta">
          {c.scheduledDate && <span className={late ? 'overdue' : ''}>{late ? 'Lewat jadwal ' : '📅 '}{fmtShort(c.scheduledDate)}</span>}
          {showAcc && <span>{ACCOUNTS[c.account]?.label}</span>}
          {c.notes && <span className="truncate">{c.notes}</span>}
        </div>
      </div>
      <button className="btn btn-sm" onClick={onPost}>✓ Posting</button>
      <button className="icon-btn sm" aria-label="Hapus" onClick={() => confirm('Hapus konten ini?') && onDelete()}>✕</button>
    </li>
  );
}

function Calendar({ items, today, onOpen }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [sel, setSel] = useState(today);
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toKey(new Date(year, month, d)));
  const byDay = {};
  items.forEach((c) => {
    const k = c.status === 'posted' ? c.postedDate : c.scheduledDate;
    if (k) (byDay[k] ||= []).push(c);
  });
  const monthName = cursor.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  const selItems = byDay[sel] || [];
  return (
    <Card>
      <div className="cal-head">
        <button className="icon-btn" onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="Bulan sebelumnya">‹</button>
        <strong>{monthName}</strong>
        <button className="icon-btn" onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="Bulan berikutnya">›</button>
      </div>
      <div className="cal-grid">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => <div key={d} className="cal-dow">{HARI_PENDEK[d]}</div>)}
        {cells.map((k, i) => k ? (
          <button key={k} className={`cal-cell ${k === today ? 'today' : ''} ${k === sel ? 'sel' : ''}`} onClick={() => setSel(k)}>
            <span>{Number(k.slice(8))}</span>
            <span className="cal-dots">
              {(byDay[k] || []).slice(0, 4).map((c) => (
                <i key={c.id} className={c.status === 'posted' ? 'filled' : 'ring'} style={{ '--dc': ACCOUNTS[c.account]?.color }} />
              ))}
            </span>
          </button>
        ) : <div key={`e${i}`} />)}
      </div>
      <p className="muted small legend"><i className="filled" /> sudah posting <i className="ring" /> terjadwal</p>
      <h4 className="cal-sel-title">{fmtShort(sel)}</h4>
      {!selItems.length ? <Empty>Tidak ada konten di tanggal ini.</Empty> : (
        <ul className="plainlist">
          {selItems.map((c) => (
            <li key={c.id} onClick={() => onOpen(c)} className="clickable">
              <span className="dot" style={{ background: ACCOUNTS[c.account]?.color }} />
              <span className="grow">{c.title}</span>
              <span className="muted small">{c.status === 'posted' ? 'Terposting' : 'Terjadwal'}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
