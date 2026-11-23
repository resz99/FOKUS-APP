import { useEffect, useMemo, useState } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import { auth } from './lib/firebase.js';
import { isFirebaseConfigured } from './firebase-config.js';
import { firestoreBackend, localBackend } from './lib/backend.js';
import { DataProvider, useData } from './lib/store.jsx';
import { listenForeground } from './lib/push.js';
import { handleStravaCallback } from './lib/strava.js';
import { Toasts, toast } from './components/ui.jsx';
import Today from './pages/Today.jsx';
import Goals from './pages/Goals.jsx';
import Content from './pages/Content.jsx';
import Health from './pages/Health.jsx';
import Review from './pages/Review.jsx';
import Settings from './pages/Settings.jsx';

const PAGES = [
  { id: 'hari-ini', label: 'Hari Ini', icon: IconToday, Comp: Today },
  { id: 'target', label: 'Target', icon: IconTarget, Comp: Goals },
  { id: 'konten', label: 'Konten', icon: IconContent, Comp: Content },
  { id: 'sehat', label: 'Sehat', icon: IconHealth, Comp: Health },
  { id: 'evaluasi', label: 'Evaluasi', icon: IconReview, Comp: Review },
];

function useHashRoute() {
  const read = () => window.location.hash.replace(/^#\/?/, '') || 'hari-ini';
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => { setRoute(read()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export default function App() {
  const [user, setUser] = useState(isFirebaseConfigured ? undefined : { uid: 'demo', demo: true });

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return onAuthStateChanged(auth, (u) => setUser(u || null));
  }, []);

  const backend = useMemo(() => {
    if (!user) return null;
    if (user.demo) return localBackend();
    const b = firestoreBackend(user.uid);
    b.putRoot({ email: user.email || '', lastSeen: Date.now() }).catch(() => {});
    return b;
  }, [user?.uid]);

  useEffect(() => { if (user && !user.demo) listenForeground(); }, [user?.uid]);

  if (user === undefined) return <Splash />;
  if (!user) return <Login />;
  return (
    <DataProvider backend={backend}>
      <Shell user={user} />
      <Toasts />
    </DataProvider>
  );
}

function Shell({ user }) {
  const route = useHashRoute();
  const { loading, api } = useData();
  useEffect(() => { handleStravaCallback(api, toast); }, [api]);
  const page = route === 'pengaturan'
    ? { id: 'pengaturan', Comp: Settings }
    : PAGES.find((p) => p.id === route) || PAGES[0];
  const Comp = page.Comp;
  return (
    <div className="app">
      <nav className="sidebar" aria-label="Navigasi utama">
        <div className="brand"><Logo /> Fokus</div>
        {PAGES.map((p) => (
          <a key={p.id} href={`#/${p.id}`} className={page.id === p.id ? 'nav-item active' : 'nav-item'}>
            <p.icon /> <span>{p.label}</span>
          </a>
        ))}
        <a href="#/pengaturan" className={page.id === 'pengaturan' ? 'nav-item active' : 'nav-item'}>
          <IconGear /> <span>Pengaturan</span>
        </a>
      </nav>
      <main className="main">
        <header className="topbar">
          <div className="brand brand-mobile"><Logo /> Fokus</div>
          {user.demo && <span className="demo-pill" title="Data hanya tersimpan di browser ini">Mode Demo</span>}
          <a href="#/pengaturan" className="icon-btn topbar-gear" aria-label="Pengaturan"><IconGear /></a>
        </header>
        {loading ? <div className="loading">Memuat data…</div> : <Comp user={user} />}
      </main>
      <nav className="bottomnav" aria-label="Navigasi">
        {PAGES.map((p) => (
          <a key={p.id} href={`#/${p.id}`} className={page.id === p.id ? 'active' : ''}>
            <p.icon /><span>{p.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}

function Splash() {
  return <div className="splash"><Logo size={48} /></div>;
}

function Login() {
  const [busy, setBusy] = useState(false);
  const login = async () => {
    setBusy(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, provider);
      } else {
        toast('Login gagal: ' + (e.code || e.message), 'error');
      }
    } finally { setBusy(false); }
  };
  return (
    <div className="login">
      <Logo size={56} />
      <h1>Fokus</h1>
      <p>Tracker tugas harian, target, konten & kesehatan — tersinkron di HP dan laptop.</p>
      <button className="btn btn-primary btn-lg" onClick={login} disabled={busy}>
        {busy ? 'Menghubungkan…' : 'Masuk dengan Google'}
      </button>
      <Toasts />
    </div>
  );
}

export function doLogout() { if (auth) signOut(auth); }

// ---------- Ikon (garis, 20px) ----------
const I = (p) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p} />;
function IconToday() { return <I><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M8 2v4M16 2v4M3 10h18M9 15l2 2 4-4" /></I>; }
function IconTarget() { return <I><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></I>; }
function IconContent() { return <I><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M10 8.5v7l6-3.5z" /></I>; }
function IconHealth() { return <I><path d="M3 12h4l2-5 4 10 2-5h6" /></I>; }
function IconReview() { return <I><path d="M12 3a9 9 0 1 0 9 9" /><path d="M12 7v5l3 2" /><path d="M17 3l4 0 0 4" /></I>; }
function IconGear() { return <I><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></I>; }
export function Logo({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      <circle cx="256" cy="256" r="190" fill="none" stroke="var(--line)" strokeWidth="56" />
      <path d="M256 66 A190 190 0 1 1 74 312" fill="none" stroke="var(--accent)" strokeWidth="56" strokeLinecap="round" />
      <circle cx="256" cy="256" r="60" fill="var(--accent)" />
    </svg>
  );
}
