import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { app, db } from './firebase.js';
import { firebaseConfig, vapidKey, isFirebaseConfigured } from '../firebase-config.js';

const BASE = import.meta.env.BASE_URL;

export function registerSW() {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null);
  const cfg = isFirebaseConfigured ? `?config=${encodeURIComponent(JSON.stringify(firebaseConfig))}` : '';
  return navigator.serviceWorker.register(`${BASE}firebase-messaging-sw.js${cfg}`, { scope: BASE }).catch((e) => {
    console.warn('SW gagal', e);
    return null;
  });
}

export function pushStatus() {
  if (!isFirebaseConfigured) return 'demo';
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'unsupported';
  return Notification.permission; // default | granted | denied
}

export async function enablePush(uid) {
  if (!isFirebaseConfigured) throw new Error('Firebase belum dikonfigurasi (Mode Demo).');
  if (!(await isSupported())) {
    throw new Error('Browser ini belum mendukung notifikasi push. Di iPhone: tambahkan ke Layar Utama dulu (iOS 16.4+).');
  }
  if (!vapidKey) throw new Error('vapidKey belum diisi di src/firebase-config.js');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Izin notifikasi ditolak. Aktifkan dari pengaturan browser.');
  const reg = (await registerSW()) || (await navigator.serviceWorker.ready);
  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: reg });
  if (!token) throw new Error('Gagal mendapatkan token notifikasi.');
  await setDoc(doc(db, 'users', uid, 'tokens', token.slice(-40)), {
    token,
    ua: navigator.userAgent.slice(0, 160),
    updatedAt: Date.now(),
  });
  return token;
}

// Saat aplikasi sedang terbuka, tampilkan notifikasi juga.
export async function listenForeground() {
  if (!isFirebaseConfigured || !(await isSupported())) return;
  const messaging = getMessaging(app);
  onMessage(messaging, async (payload) => {
    const n = payload.notification || {};
    const reg = await navigator.serviceWorker.ready;
    reg.showNotification(n.title || 'Fokus', { body: n.body, icon: `${BASE}icon-192.png` });
  });
}
