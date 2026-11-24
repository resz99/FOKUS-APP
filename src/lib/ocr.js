// Membaca angka dari screenshot olahraga, sepenuhnya di perangkat (tanpa server).
import { parseWorkoutText } from './parse-workout.js';

const BASE = `${import.meta.env.BASE_URL}ocr`;
let workerPromise = null;

function getWorker(onProgress) {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      return createWorker('eng', 1, {
        workerPath: `${BASE}/worker.min.js`,
        corePath: BASE,
        langPath: BASE,
        gzip: true,
        logger: (m) => onProgress && m.status && onProgress(m),
      });
    })().catch((e) => { workerPromise = null; throw e; });
  }
  return workerPromise;
}

// Ubah screenshot jadi teks hitam di latar putih:
// - latar transparan (stiker Strava) → ditempel di atas hitam
// - deteksi tema gelap/terang, buang warna mencolok (garis rute, ikon)
export async function preprocess(file) {
  const img = await loadImage(file);
  const scale = Math.min(2, Math.max(1, 1600 / img.width));
  const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const p = data.data;
  // Median kecerahan (sampel) untuk menentukan tema
  const hist = new Uint32Array(256);
  for (let i = 0; i < p.length; i += 4 * 7) hist[(p[i] * 299 + p[i + 1] * 587 + p[i + 2] * 114) / 1000 | 0]++;
  let acc = 0, half = hist.reduce((a, b) => a + b, 0) / 2, med = 0;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= half) { med = i; break; } }
  const dark = med < 128;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], g = p[i + 1], b = p[i + 2];
    const lum = (r * 299 + g * 587 + b * 114) / 1000;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    const text = sat < 70 && (dark ? lum > 140 : lum < 110);
    const v = text ? 0 : 255;
    p[i] = p[i + 1] = p[i + 2] = v; p[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

export async function readWorkoutScreenshot(file, onProgress) {
  const [worker, canvas] = await Promise.all([getWorker(onProgress), preprocess(file)]);
  const { data } = await worker.recognize(canvas);
  console.debug('[OCR]', data.text);
  return { fields: parseWorkoutText(data.text), text: data.text, confidence: data.confidence };
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('File bukan gambar yang didukung.')); };
    img.src = url;
  });
}
