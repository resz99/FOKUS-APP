// ===================================================================
//  ISI BAGIAN INI DENGAN CONFIG DARI FIREBASE CONSOLE
//  (Project settings → General → Your apps → Web app → SDK setup)
//  Config ini BUKAN rahasia — aman disimpan di repository.
//  Selama masih kosong, aplikasi berjalan dalam "Mode Demo"
//  (data hanya tersimpan di browser ini, tanpa sinkron & notifikasi).
// ===================================================================
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

// Cloud Messaging → Web Push certificates → "Key pair"
export const vapidKey = '';

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
