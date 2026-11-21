// Dijalankan oleh GitHub Actions (lihat .github/workflows/reminders.yml).
// Pemakaian: node scripts/send-reminders.mjs pagi|malam|mingguan
// Env: FIREBASE_SERVICE_ACCOUNT (JSON), APP_URL, TZ=Asia/Jakarta
import admin from 'firebase-admin';
import { todayKey } from '../src/lib/dates.js';
import { buildMessage } from './reminder-messages.mjs';

const type = process.argv[2];
if (!['pagi', 'malam', 'mingguan'].includes(type)) {
  console.error('Jenis pengingat harus: pagi | malam | mingguan');
  process.exit(1);
}
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error('Secret FIREBASE_SERVICE_ACCOUNT belum diisi.');
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();
const APP_URL = (process.env.APP_URL || '').replace(/\/?$/, '/');
const today = todayKey();

async function loadUser(ref) {
  const get = async (name) => (await ref.collection(name).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  const [goals, contents, workouts, weights, tokens] = await Promise.all(
    ['goals', 'contents', 'workouts', 'weights', 'tokens'].map(get),
  );
  const daySnap = await ref.collection('days').doc(today).get();
  return {
    goals: goals.filter((g) => !g.archived),
    contents, workouts, tokens,
    weights: weights.sort((a, b) => a.date.localeCompare(b.date)),
    day: daySnap.exists ? daySnap.data() : {},
  };
}

const userRefs = await db.collection('users').listDocuments();
let sent = 0;
for (const ref of userRefs) {
  const data = await loadUser(ref);
  if (!data.tokens.length) continue;
  const msg = buildMessage(type, data, today);
  if (!msg) { console.log(`${ref.id}: dilewati (sudah evaluasi)`); continue; }
  const res = await admin.messaging().sendEachForMulticast({
    tokens: data.tokens.map((t) => t.token),
    webpush: {
      notification: { title: msg.title, body: msg.body, icon: `${APP_URL}icon-192.png`, badge: `${APP_URL}icon-192.png`, tag: `fokus-${type}` },
      fcmOptions: APP_URL.startsWith('https') ? { link: APP_URL } : undefined,
    },
  });
  sent += res.successCount;
  // Hapus token yang sudah tidak berlaku
  await Promise.all(res.responses.map((r, i) => {
    const code = r.error?.code || '';
    if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token') || code.includes('invalid-argument')) {
      return ref.collection('tokens').doc(data.tokens[i].id).delete();
    }
    if (r.error) console.warn('Gagal kirim:', code, r.error.message);
    return null;
  }));
}
console.log(`[${type}] ${today}: ${sent} notifikasi terkirim.`);
