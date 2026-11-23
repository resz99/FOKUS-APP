import { STRAVA_CLIENT_ID, STRAVA_SYNC_FROM } from '../strava-config.js';

export const stravaConfigured = Boolean(STRAVA_CLIENT_ID);

const redirectUri = () => `${window.location.origin}${import.meta.env.BASE_URL}?strava=1`;

export function stravaAuthorizeUrl() {
  const p = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'read,activity:read_all',
  });
  return `https://www.strava.com/oauth/authorize?${p.toString()}`;
}

// Dipanggil sekali setelah login: tangkap ?strava=1&code=… dari Strava
export function handleStravaCallback(api, toast) {
  const q = new URLSearchParams(window.location.search);
  if (!q.has('strava')) return;
  const code = q.get('code');
  const scope = q.get('scope') || '';
  const error = q.get('error');
  window.history.replaceState(null, '', `${window.location.pathname}#/sehat`);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  if (api.mode === 'demo') return toast('Strava hanya bisa disambungkan di mode cloud.', 'error');
  if (error || !code) return toast('Sambungan Strava dibatalkan.', 'error');
  if (!scope.includes('activity:read')) {
    return toast('Izin "lihat aktivitas" belum dicentang. Coba sambungkan lagi dan centang semua izin.', 'error');
  }
  api.put('meta', 'strava', { status: 'pending', code, scope, requestedAt: Date.now(), syncFrom: STRAVA_SYNC_FROM });
  toast('Strava diizinkan ✓ Data akan masuk dalam ±5–15 menit.', 'success');
}
