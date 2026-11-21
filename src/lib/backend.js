// Dua "backend" dengan antarmuka yang sama:
//  - Firestore (data tersinkron di semua perangkat)
//  - Lokal / Mode Demo (localStorage, hanya di browser ini)
import {
  collection, doc, onSnapshot, addDoc, updateDoc, setDoc, deleteDoc, getDoc,
} from 'firebase/firestore';
import { db } from './firebase.js';

export const COLLECTIONS = ['goals', 'contents', 'tasks', 'days', 'workouts', 'weights'];

export function firestoreBackend(uid) {
  const col = (name) => collection(db, 'users', uid, name);
  const ref = (name, id) => doc(db, 'users', uid, name, id);
  return {
    mode: 'cloud',
    subscribe(name, cb, onError) {
      return onSnapshot(col(name), (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
    },
    add: (name, data) => addDoc(col(name), { ...data, createdAt: Date.now() }),
    update: (name, id, data) => updateDoc(ref(name, id), data),
    put: (name, id, data) => setDoc(ref(name, id), data),
    remove: (name, id) => deleteDoc(ref(name, id)),
    async get(name, id) {
      const s = await getDoc(ref(name, id));
      return s.exists() ? { id: s.id, ...s.data() } : null;
    },
    putRoot: (data) => setDoc(doc(db, 'users', uid), data, { merge: true }),
  };
}

const LS_KEY = 'fokus-demo-data';
export function localBackend() {
  let store = {};
  try { store = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { store = {}; }
  const listeners = {};
  const list = (name) => Object.entries(store[name] || {}).map(([id, v]) => ({ id, ...v }));
  const save = (name) => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(store)); } catch { /* storage penuh/diblokir */ }
    (listeners[name] || []).forEach((cb) => cb(list(name)));
  };
  const bucket = (name) => (store[name] ||= {});
  const newId = () => Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  return {
    mode: 'demo',
    subscribe(name, cb) {
      (listeners[name] ||= []).push(cb);
      cb(list(name));
      return () => { listeners[name] = listeners[name].filter((x) => x !== cb); };
    },
    async add(name, data) { const id = newId(); bucket(name)[id] = { ...data, createdAt: Date.now() }; save(name); return { id }; },
    async update(name, id, data) { bucket(name)[id] = { ...bucket(name)[id], ...data }; save(name); },
    async put(name, id, data) { bucket(name)[id] = { ...data }; save(name); },
    async remove(name, id) { delete bucket(name)[id]; save(name); },
    async get(name, id) { const v = bucket(name)[id]; return v ? { id, ...v } : null; },
    async putRoot() {},
  };
}
