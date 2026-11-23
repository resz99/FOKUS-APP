import { useEffect, useRef, useState } from 'react';
import { decodePolyline } from '../lib/workout.js';

// Peta rute (OpenStreetMap). Leaflet dimuat hanya saat peta dibuka.
export default function RouteMap({ polyline, height = 260 }) {
  const el = useRef(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    const pts = decodePolyline(polyline);
    if (!pts.length || !el.current) return;
    let map;
    let cancelled = false;
    (async () => {
      try {
        const L = (await import('leaflet')).default;
        await import('leaflet/dist/leaflet.css');
        if (cancelled) return;
        map = L.map(el.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false });
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap',
        }).addTo(map);
        const line = L.polyline(pts, { color: '#ff6a3d', weight: 4, opacity: 0.95 }).addTo(map);
        L.circleMarker(pts[0], { radius: 6, color: '#fff', weight: 2, fillColor: '#2ecc71', fillOpacity: 1 }).addTo(map);
        L.circleMarker(pts[pts.length - 1], { radius: 6, color: '#fff', weight: 2, fillColor: '#e74c3c', fillOpacity: 1 }).addTo(map);
        map.fitBounds(line.getBounds(), { padding: [20, 20] });
      } catch (e) { setErr('Peta gagal dimuat (cek koneksi internet).'); }
    })();
    return () => { cancelled = true; if (map) map.remove(); };
  }, [polyline]);
  if (!polyline) return null;
  return (
    <>
      <div ref={el} className="route-map" style={{ height }} />
      {err && <p className="small muted">{err}</p>}
    </>
  );
}
