// Mengurai teks hasil OCR screenshot olahraga (Huawei Health / Strava, Inggris & Indonesia)
// menjadi data aktivitas. Fungsi murni → mudah dites.

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, mei: 5, jun: 6, jul: 7, aug: 8, agu: 8, agt: 8, agus: 8,
  sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12,
};
const monthNum = (s) => MONTHS[s.toLowerCase().slice(0, 3)] || MONTHS[s.toLowerCase().slice(0, 4)] || null;
const pad = (n) => String(n).padStart(2, '0');
const num = (s) => Number(String(s).replace(',', '.'));
const digits = (s) => Number(String(s).replace(/[^\d]/g, ''));

const TYPE_RULES = [
  ['Sepak bola', /\b(football|soccer|futsal|sepak\s*bola|mini\s*soccer)\b/i],
  ['Lari', /\b(outdoor run|indoor run|trail run|running|run|lari|treadmill)\b/i],
  ['Bersepeda', /\b(cycling|ride|bike|bersepeda|sepeda)\b/i],
  ['Renang', /\b(swim|swimming|renang)\b/i],
  ['Jalan cepat', /\b(outdoor walk|walking|walk|hike|hiking|jalan kaki|jalan)\b/i],
  ['Latihan otot / Gym', /\b(strength|weight training|gym|latihan kekuatan|latihan beban)\b/i],
];

export function parseWorkoutText(raw) {
  const text = String(raw || '').replace(/\r/g, '');
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const r = {};

  // ---- Jenis olahraga (cek 6 baris teratas dulu: judul) ----
  const head = lines.slice(0, 6).join('\n');
  for (const src of [head, text]) {
    const hit = TYPE_RULES.find(([, re]) => re.test(src));
    if (hit) { r.type = hit[0]; break; }
  }

  // ---- Tanggal & jam mulai ----
  let m = text.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})(?:[^\d\n]{1,8}(\d{1,2})[:.](\d{2})(?:\s*(AM|PM))?)?/i);
  if (m && monthNum(m[2])) setDate(r, +m[3], monthNum(m[2]), +m[1], m[4], m[5], m[6]);
  if (!r.date) {
    m = text.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})(?:[^\d\n]{1,8}(\d{1,2})[:.](\d{2})(?:\s*(AM|PM))?)?/i);
    if (m && monthNum(m[1])) setDate(r, +m[3], monthNum(m[1]), +m[2], m[4], m[5], m[6]);
  }
  if (!r.date) {
    m = text.match(/\b(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:\s+(\d{1,2})[:.](\d{2}))?/);
    if (m) setDate(r, +m[1], +m[2], +m[3], m[4], m[5]);
  }

  // ---- Durasi (detik) ----
  if ((m = text.match(/\b(\d{1,2}):(\d{2}):(\d{2})\b/))) r.sec = +m[1] * 3600 + +m[2] * 60 + +m[3];
  else if ((m = text.match(/\b(\d{1,2})\s*(?:h|j|jam)\s*(\d{1,2})\s*m(?:in|nt)?\b/i))) r.sec = +m[1] * 3600 + +m[2] * 60;
  else if ((m = text.match(/\b(\d{1,3})\s*m(?:in)?\s*(\d{1,2})\s*(?:s|d|dtk)\b/i))) r.sec = +m[1] * 60 + +m[2];
  else if ((r.sec = minSecNearLabel(lines))) { /* mm:ss di dekat label waktu */ }
  else if ((m = text.match(/\b(\d{1,3})\s*(?:min|menit)\b/i))) r.sec = +m[1] * 60;

  // ---- Jarak ----
  if ((m = text.match(/(\d{1,3}(?:[.,]\d{1,3})?)[ \t]*km(?![ \t]*\/)(?![ \t]*\/?[ \t]*[hj]\b)/i))) r.distanceM = Math.round(num(m[1]) * 1000);
  else if ((m = text.match(/(?:distance|jarak)[^\n]*\n?\s*(\d{2,5})\s*m\b/i))) r.distanceM = +m[1];

  // ---- Kecepatan / pace ----
  if ((m = text.match(/(\d{1,3}(?:[.,]\d{1,2})?)\s*km\s*\/\s*[hj]\b/i))) r.avgSpeed = num(m[1]) / 3.6;
  else if ((m = text.match(/\b(\d{1,2})['′’:](\d{2})["″”]?\s*\/\s*km/i))) r.paceSec = +m[1] * 60 + +m[2];

  // ---- Detak jantung ----
  const bpm = [...text.matchAll(/(\d(?:[ \t]?\d){1,2})[ \t]*bpm/gi)].map((x) => ({ v: digits(x[1]), i: x.index }));
  if (bpm.length) {
    const avgIdx = text.search(/(avg|average|rata-rata|rata2)[^\n]*(heart|hr|jantung)/i);
    const maxIdx = text.search(/(max|maks)[^\n]*(heart|hr|jantung)/i);
    const pick = avgIdx >= 0 ? bpm.find((b) => b.i > avgIdx) || bpm[0] : bpm[0];
    if (pick && pick.v >= 50 && pick.v <= 230) r.avgHr = pick.v;
    if (maxIdx >= 0) {
      const mx = bpm.find((b) => b.i > maxIdx && b !== pick);
      if (mx && mx.v >= 60 && mx.v <= 240) r.maxHr = mx.v;
    }
  }

  // ---- Kalori: aktif diutamakan ----
  const kcal = [];
  for (const line of lines) {
    for (const x of line.matchAll(/(\d(?:[ .,]?\d){0,5})[ \t]*(?:kcal|kkal|ical|kcai|kca1|kca|cal)\b/gi)) {
      kcal.push({ v: digits(x[1]), total: /total/i.test(line) });
    }
  }
  const active = kcal.find((k) => !k.total);
  const total = kcal.find((k) => k.total);
  if (active) r.calories = active.v;
  else if (total) r.calories = total.v;
  if (total) r.caloriesTotal = total.v;

  // ---- Langkah ----
  if ((m = text.match(/(\d[\d.,]{0,7})[ \t]*(?:steps|langkah)\b/i))) r.steps = digits(m[1]);

  // ---- Elevasi ----
  if ((m = text.match(/(?:elev(?:ation)?\s*gain|total ascent|kenaikan elevasi|naik)\s*\n?\s*(\d{1,4})\s*m\b/i))) r.elevationM = +m[1];

  // Hitung kecepatan dari jarak & durasi bila belum ada
  if (!r.avgSpeed && r.distanceM && r.sec) r.avgSpeed = r.distanceM / r.sec;
  return r;
}

// Cari mm:ss pada baris label waktu atau baris di bawahnya (bukan pace "/km", bukan jam AM/PM)
function minSecNearLabel(lines) {
  for (let i = 0; i < lines.length; i++) {
    if (!/(moving time|elapsed time|duration|durasi|waktu|\btime\b)/i.test(lines[i])) continue;
    for (const line of [lines[i], lines[i + 1] || '']) {
      for (const x of line.matchAll(/\b(\d{1,3}):(\d{2})\b(?!\s*(?:\/|am|pm))/gi)) {
        if (+x[2] < 60) return +x[1] * 60 + +x[2];
      }
    }
  }
  return undefined;
}

function setDate(r, y, mo, d, hh, mm, ampm) {
  if (!(y >= 2000 && y <= 2100 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return;
  r.date = `${y}-${pad(mo)}-${pad(d)}`;
  if (hh != null && mm != null) {
    let h = +hh;
    if (ampm) { const pm = /pm/i.test(ampm); if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
    if (h < 24 && +mm < 60) r.startTime = `${pad(h)}:${pad(+mm)}`;
  }
}
