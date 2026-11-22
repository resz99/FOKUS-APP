// Dijalankan oleh GitHub Actions setiap 15 menit (lihat .github/workflows/reminders.yml).
//
//   node scripts/send-reminders.mjs            → mode otomatis: kirim yang sudah jatuh tempo
//   node scripts/send-reminders.mjs pagi       → paksa kirim (untuk tes): pagi | malam | mingguan | tugas
//
// Env: FIREBASE_SERVICE_ACCOUNT (JSON), APP_URL, TZ=Asia/Jakarta
import admin from 'firebase-admin';
import { todayKey, addDays } from '../src/lib/dates.js';
import { planJobs } from './plan.mjs';

const MODES = ['auto', 'pagi', 'malam', 'mingguan', 'tugas'];
const mode = process.argv[2] || 'auto';
if (!MODES.includes(mode)) {
  console.error(`Mode harus salah satu: ${MODES.join(' | ')}`);
  process.exit(1);
}
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error('Secret FIREBASE_SERVICE_ACCOUNT belum diisi.');
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();
const APP_URL = (process.env.APP_URL || '').replace(/\/?$/, '/');
const now = new Date();
const today = todayKey(now);

async function loadUser(ref) {
  const get = async (name) => (await ref.collection(name).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  const [goals, contents, workouts, weights, tokens, tasks, meta] = await Promise.all(
    ['goals', 'contents', 'workouts', 'weights', 'tokens', 'tasks', 'meta'].map(get),
  );
  const days = {};
  for (const k of [addDays(today, -1), today]) {
    const s = await ref.collection('days').doc(k).get();
    days[k] = s.exists ? s.data() : {};
  }
  const strip = (o) => { if (!o) return {}; const { id, ...rest } = o; return rest; };
  return {
    goals: goals.filter((g) => !g.archived),
    contents, workouts, tokens, tasks, days,
    weights: weights.sort((a, b) => a.date.localeCompare(b.date)),
    settings: strip(meta.find((m) => m.id === 'settings')),
    log: strip(meta.find((m) => m.id === 'notifLog')),
  };
}

async function send(ref, tokens, msg, tag) {
  const res = await admin.messaging().sendEachForMulticast({
    tokens: tokens.map((t) => t.token),
    webpush: {
      notification: { title: msg.title, body: msg.body, icon: `${APP_URL}icon-192.png`, badge: `${APP_URL}icon-192.png`, tag },
      fcmOptions: APP_URL.startsWith('https') ? { link: APP_URL } : undefined,
    },
  });
  await Promise.all(res.responses.map((r, i) => {
    const code = r.error?.code || '';
    if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token') || code.includes('invalid-argument')) {
      return ref.collection('tokens').doc(tokens[i].id).delete();
    }
    if (r.error) console.warn('Gagal kirim:', code, r.error.message);
    return null;
  }));
  return res.successCount;
}

let sent = 0;
for (const ref of await db.collection('users').listDocuments()) {
  const data = await loadUser(ref);
  if (!data.tokens.length) continue;
  const { jobs, log, logChanged } = planJobs(mode, data, now);
  for (const j of jobs) {
    sent += await send(ref, data.tokens, j.msg, j.tag);
    if (j.taskId) await ref.collection('tasks').doc(j.taskId).update({ remindedOn: j.date });
    console.log(`${ref.id.slice(0, 6)}…: ${j.msg.title}`);
  }
  if (logChanged) await ref.collection('meta').doc('notifLog').set(log);
}
const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
console.log(`[${mode}] ${today} ${hm} WIB — ${sent} notifikasi terkirim.`);
