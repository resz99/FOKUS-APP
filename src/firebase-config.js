// ===================================================================
//  ISI BAGIAN INI DENGAN CONFIG DARI FIREBASE CONSOLE
//  (Project settings → General → Your apps → Web app → SDK setup)
//  Config ini BUKAN rahasia — aman disimpan di repository.
//  Selama masih kosong, aplikasi berjalan dalam "Mode Demo"
//  (data hanya tersimpan di browser ini, tanpa sinkron & notifikasi).
// ===================================================================
export const firebaseConfig = {
  apiKey: 'AIzaSyBNMlQGtfoLCcThLpZK8kEGGg1X0Aj1h-g',
  authDomain: 'fokus-app-rezz99.firebaseapp.com',
  projectId: 'fokus-app-rezz99',
  storageBucket: 'fokus-app-rezz99.firebasestorage.app',
  messagingSenderId: '1077787950222',
  appId: '1:1077787950222:web:287c56aab9833f72f49ddf',
};

// Cloud Messaging → Web Push certificates → "Key pair"
export const vapidKey = 'BMd4Cw3RLongikHK6hiXZLpQnVGzT6QM_8FhFGb4W5OrFsi8l78c-H1S4FPGq5y_E6gTEcYLohb0_G1WfS6zXUQ';

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
