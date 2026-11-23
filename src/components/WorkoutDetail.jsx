import { useEffect, useRef, useState } from 'react';
import { Modal, toast } from './ui.jsx';
import { useData } from '../lib/store.jsx';
import { WORKOUT_ICON } from '../lib/constants.js';
import { fmtKm, fmtPaceOrSpeed, fmtDuration } from '../lib/workout.js';
import { fmtLong } from '../lib/dates.js';
import { compressImage } from '../lib/image.js';
import RouteMap from './RouteMap.jsx';

export function usePhoto(photoId) {
  const { api } = useData();
  const [photo, setPhoto] = useState(null);
  useEffect(() => {
    let alive = true;
    setPhoto(null);
    if (photoId) api.get('photos', photoId).then((p) => alive && setPhoto(p)).catch(() => {});
    return () => { alive = false; };
  }, [photoId, api]);
  return photo;
}

export function PhotoPicker({ onPicked, label = '📷 Tambah foto / screenshot' }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try { onPicked(await compressImage(file)); }
    catch (err) { toast(err.message, 'error'); }
    finally { setBusy(false); }
  };
  return (
    <>
      <input ref={ref} type="file" accept="image/*" hidden onChange={pick} />
      <button type="button" className="btn" onClick={() => ref.current.click()} disabled={busy}>{busy ? 'Memproses foto…' : label}</button>
    </>
  );
}

export async function savePhoto(api, workoutId, img, oldPhotoId) {
  const p = api.add('photos', { data: img.data, width: img.width, height: img.height, workoutId });
  api.update('workouts', workoutId, { photoId: p.id });
  if (oldPhotoId) api.remove('photos', oldPhotoId);
  return p.id;
}

export default function WorkoutDetail({ workout: w, onClose }) {
  const { api } = useData();
  const photo = usePhoto(w.photoId);
  const [preview, setPreview] = useState(null);
  const stats = [
    ['Durasi', fmtDuration(w)],
    ['Jarak', fmtKm(w.distanceM)],
    [w.type === 'Lari' || w.type === 'Jalan cepat' ? 'Pace' : 'Kecepatan', fmtPaceOrSpeed(w)],
    ['❤️ Rata-rata', w.avgHr ? `${w.avgHr} bpm` : null],
    ['❤️ Maks', w.maxHr ? `${w.maxHr} bpm` : null],
    ['🔥 Kalori', w.calories ? `${w.calories} kkal` : null],
    ['⛰️ Elevasi', w.elevationM ? `${w.elevationM} m` : null],
  ].filter(([, v]) => v);
  const addPhoto = async (img) => {
    setPreview(img.data);
    await savePhoto(api, w.id, img, w.photoId);
    toast('Foto tersimpan', 'success');
  };
  const remove = () => {
    if (!confirm('Hapus aktivitas ini dari Fokus?')) return;
    // Aktivitas Strava hanya disembunyikan agar tidak masuk lagi saat sinkron berikutnya
    if (w.source === 'strava') api.update('workouts', w.id, { hidden: true });
    else api.remove('workouts', w.id);
    if (w.photoId) api.remove('photos', w.photoId);
    onClose();
  };
  const img = preview || photo?.data;
  return (
    <Modal title={`${WORKOUT_ICON[w.type] || '🤸'} ${w.name || w.type}`} onClose={onClose}
      footer={<>
        <button className="btn btn-danger" onClick={remove}>Hapus</button>
        <span className="grow" />
        <button className="btn btn-primary" onClick={onClose}>Tutup</button>
      </>}>
      <p className="muted small">
        {fmtLong(w.date)}{w.startTime ? ` · ${w.startTime}` : ''} · {w.type}{w.strength ? ' · 💪 latihan otot' : ''}
        {w.source === 'strava' && <> · <a href={`https://www.strava.com/activities/${w.stravaId}`} target="_blank" rel="noreferrer" className="strava-link">Strava ↗</a></>}
      </p>
      <div className="stat-grid">
        {stats.map(([k, v]) => <div key={k}><div className="stat-sm">{v}</div><div className="muted small">{k}</div></div>)}
      </div>
      {w.polyline && <RouteMap polyline={w.polyline} />}
      {img && <img className="workout-photo" src={img} alt="Foto olahraga" />}
      {w.photoId && !img && <p className="muted small">Memuat foto…</p>}
      <PhotoPicker onPicked={addPhoto} label={img ? '📷 Ganti foto' : '📷 Tambah foto / screenshot'} />
    </Modal>
  );
}
