// Helper format & pemetaan aktivitas olahraga (dipakai aplikasi DAN skrip sinkron Strava).
import { PACE_TYPES } from './constants.js';

// Strava sport_type → jenis olahraga Fokus
const STRAVA_MAP = {
  Run: 'Lari', TrailRun: 'Lari', VirtualRun: 'Lari',
  Walk: 'Jalan cepat', Hike: 'Jalan cepat',
  Ride: 'Bersepeda', VirtualRide: 'Bersepeda', MountainBikeRide: 'Bersepeda', GravelRide: 'Bersepeda', EBikeRide: 'Bersepeda', EMountainBikeRide: 'Bersepeda',
  Swim: 'Renang',
  Soccer: 'Sepak bola',
  WeightTraining: 'Latihan otot / Gym', Crossfit: 'Latihan otot / Gym',
};
const STRENGTH = ['WeightTraining', 'Crossfit'];

export function mapStravaActivity(a) {
  const sport = a.sport_type || a.type || 'Workout';
  const local = a.start_date_local || a.start_date || '';
  return {
    source: 'strava',
    stravaId: a.id,
    name: a.name || '',
    sport,
    type: STRAVA_MAP[sport] || 'Olahraga lain',
    strength: STRENGTH.includes(sport),
    date: local.slice(0, 10),
    startTime: local.slice(11, 16),
    minutes: Math.max(1, Math.round((a.moving_time || a.elapsed_time || 0) / 60)),
    movingSec: a.moving_time || null,
    elapsedSec: a.elapsed_time || null,
    distanceM: a.distance ? Math.round(a.distance) : null,
    avgSpeed: a.average_speed || null, // m/detik
    avgHr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
    maxHr: a.max_heartrate ? Math.round(a.max_heartrate) : null,
    calories: a.calories ? Math.round(a.calories) : a.kilojoules ? Math.round(a.kilojoules / 4.184) : null,
    elevationM: a.total_elevation_gain ? Math.round(a.total_elevation_gain) : null,
    polyline: a.map?.polyline || a.map?.summary_polyline || null,
  };
}

export const fmtKm = (m) => (m ? `${(m / 1000).toFixed(m >= 10000 ? 1 : 2).replace('.', ',')} km` : null);

export function fmtPaceOrSpeed(w) {
  const sec = w.movingSec || (w.minutes ? w.minutes * 60 : 0);
  if (!w.distanceM || !sec) return null;
  if (PACE_TYPES.includes(w.type)) {
    const pace = sec / (w.distanceM / 1000); // detik per km
    if (!isFinite(pace) || pace > 3600) return null;
    return `${Math.floor(pace / 60)}:${String(Math.round(pace % 60)).padStart(2, '0')} /km`;
  }
  const kmh = (w.distanceM / 1000) / (sec / 3600);
  return `${kmh.toFixed(1).replace('.', ',')} km/j`;
}

export function fmtDuration(w) {
  const sec = w.movingSec || (w.minutes || 0) * 60;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return w.movingSec ? `${m}:${String(s).padStart(2, '0')}` : `${m} menit`;
}

// Google encoded polyline → [[lat, lng], ...]
export function decodePolyline(str) {
  if (!str) return [];
  let index = 0, lat = 0, lng = 0;
  const out = [];
  while (index < str.length) {
    for (const which of [0, 1]) {
      let result = 0, shift = 0, b;
      do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += delta; else lng += delta;
    }
    out.push([lat / 1e5, lng / 1e5]);
  }
  return out;
}
