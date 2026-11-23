// Sinkron Strava → Fokus. Dijalankan GitHub Actions setelah pengirim pengingat.
// Env: FIREBASE_SERVICE_ACCOUNT, STRAVA_CLIENT_SECRET
import admin from 'firebase-admin';
import { STRAVA_CLIENT_ID, STRAVA_SYNC_FROM } from '../src/strava-config.js';
import { mapStravaActivity } from '../src/lib/workout.js';

const SECRET = process.env.STRAVA_CLIENT_SECRET;
if (!STRAVA_CLIENT_ID || !SECRET) {
  console.log('Strava belum dikonfigurasi (Client ID / STRAVA_CLIENT_SECRET kosong) — dilewati.');
  process.exit(0);
}
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();
const MIN_INTERVAL = 10 * 60 * 1000; // sinkron rutin paling sering tiap 10 menit (hemat kuota API Strava)

async function strava(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`https://www.strava.com${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* bukan JSON */ }
  if (!res.ok) {
    const msg = json?.message || text.slice(0, 120) || res.statusText;
    const err = new Error(`Strava ${res.status}: ${msg}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

const tokenRef = (uid) => db.collection('stravaTokens').doc(uid); // tidak bisa dibaca aplikasi (aturan Firestore)

async function exchangeCode(uid, metaRef, meta) {
  const t = await strava('/oauth/token', {
    method: 'POST',
    body: { client_id: STRAVA_CLIENT_ID, client_secret: SECRET, code: meta.code, grant_type: 'authorization_code' },
  });
  await tokenRef(uid).set({ access_token: t.access_token, refresh_token: t.refresh_token, expires_at: t.expires_at, athleteId: t.athlete?.id || null });
  const name = [t.athlete?.firstname, t.athlete?.lastname].filter(Boolean).join(' ');
  await metaRef.set({
    status: 'connected', athleteName: name, athleteId: t.athlete?.id || null, connectedAt: Date.now(),
    syncFrom: meta.syncFrom || STRAVA_SYNC_FROM, requestSync: Date.now(),
  });
  console.log(`${uid.slice(0, 6)}…: Strava tersambung (${name})`);
}

async function accessToken(uid) {
  const snap = await tokenRef(uid).get();
  if (!snap.exists) throw new Error('Token Strava hilang — sambungkan ulang.');
  const t = snap.data();
  if (t.expires_at * 1000 > Date.now() + 5 * 60 * 1000) return t.access_token;
  const n = await strava('/oauth/token', {
    method: 'POST',
    body: { client_id: STRAVA_CLIENT_ID, client_secret: SECRET, grant_type: 'refresh_token', refresh_token: t.refresh_token },
  });
  await tokenRef(uid).set({ ...t, access_token: n.access_token, refresh_token: n.refresh_token, expires_at: n.expires_at });
  return n.access_token;
}

async function syncActivities(uid, userRef, metaRef, meta) {
  const token = await accessToken(uid);
  const fromKey = meta.syncFrom || STRAVA_SYNC_FROM;
  // Ambil sedikit ke belakang (2 hari) dari aktivitas terakhir agar unggahan Huawei yang telat tetap tertangkap
  const fromEpoch = Math.floor(new Date(`${fromKey}T00:00:00+07:00`).getTime() / 1000);
  const after = Math.max(fromEpoch, (meta.lastActivityEpoch || 0) - 2 * 86400);
  const existing = new Set((await userRef.collection('workouts').where('source', '==', 'strava').select('stravaId').get()).docs.map((d) => String(d.data().stravaId)));
  let page = 1, added = 0, newest = meta.lastActivityEpoch || 0;
  while (page <= 5) {
    const list = await strava(`/api/v3/athlete/activities?after=${after}&per_page=50&page=${page}`, { token });
    if (!list?.length) break;
    for (const a of list) {
      newest = Math.max(newest, Math.floor(new Date(a.start_date).getTime() / 1000));
      if (existing.has(String(a.id))) continue;
      let full = a;
      try { full = await strava(`/api/v3/activities/${a.id}`, { token }); } catch (e) { console.warn('Detail gagal', a.id, e.message); }
      await userRef.collection('workouts').doc(`strava-${a.id}`).set({ ...mapStravaActivity(full), createdAt: Date.now() }, { merge: true });
      added++;
    }
    if (list.length < 50) break;
    page++;
  }
  await metaRef.update({ lastSyncAt: Date.now(), lastActivityEpoch: newest, requestSync: admin.firestore.FieldValue.delete(), error: admin.firestore.FieldValue.delete() });
  console.log(`${uid.slice(0, 6)}…: ${added} aktivitas Strava baru`);
}

async function disconnect(uid, metaRef) {
  try { await strava('/oauth/deauthorize', { method: 'POST', token: await accessToken(uid) }); } catch (e) { console.warn('Deauthorize:', e.message); }
  await tokenRef(uid).delete();
  await metaRef.set({ status: 'none', disconnectedAt: Date.now() });
  console.log(`${uid.slice(0, 6)}…: Strava diputus`);
}

for (const userRef of await db.collection('users').listDocuments()) {
  const uid = userRef.id;
  const metaRef = userRef.collection('meta').doc('strava');
  const snap = await metaRef.get();
  if (!snap.exists) continue;
  const meta = snap.data();
  try {
    if (meta.status === 'pending' && meta.code) {
      await exchangeCode(uid, metaRef, meta);
      await syncActivities(uid, userRef, metaRef, (await metaRef.get()).data());
    }
    else if (meta.status === 'disconnecting') await disconnect(uid, metaRef);
    else if (meta.status === 'connected') {
      const due = meta.requestSync || !meta.lastSyncAt || Date.now() - meta.lastSyncAt >= MIN_INTERVAL;
      if (due) await syncActivities(uid, userRef, metaRef, meta);
    }
  } catch (e) {
    console.error(`${uid.slice(0, 6)}…: ${e.message}`);
    const fatal = meta.status === 'pending' || e.status === 400 || e.status === 401;
    await metaRef.set({ ...(fatal ? { status: 'error' } : {}), error: e.message.slice(0, 200), code: admin.firestore.FieldValue.delete() }, { merge: true });
  }
}
