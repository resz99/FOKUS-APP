import { useEffect, useState } from 'react';

// ---------- Toast sederhana ----------
let pushToast = null;
export function toast(msg, type = 'info') {
  if (pushToast) pushToast({ msg, type, id: Math.random() });
}
export function Toasts() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    pushToast = (t) => {
      setItems((x) => [...x, t]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== t.id)), 3500);
    };
    return () => { pushToast = null; };
  }, []);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}
    </div>
  );
}

// ---------- Modal ----------
export function Modal({ title, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Tutup">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Progress({ value, color, thin }) {
  const pct = Math.round(Math.max(0, Math.min(1, value || 0)) * 100);
  return (
    <div className={`progress ${thin ? 'thin' : ''}`} role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100">
      <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Card({ title, action, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="card-head">
          {title && <h2>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({ children }) {
  return <p className="empty">{children}</p>;
}

export function StatusBadge({ status, label }) {
  return <span className={`badge badge-${status}`}>{label}</span>;
}

export function Segmented({ options, value, onChange }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const fmtMin = (m) => {
  m = Math.round(m || 0);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r}m`;
  return r ? `${h}j ${r}m` : `${h}j`;
};
