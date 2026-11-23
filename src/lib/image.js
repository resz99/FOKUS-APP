// Mengecilkan foto di perangkat sebelum disimpan (target < ~450 KB agar muat di Firestore).
export async function compressImage(file, maxSide = 1280) {
  const bitmap = await loadImage(file);
  let w = bitmap.width, h = bitmap.height;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  w = Math.round(w * scale); h = Math.round(h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  let q = 0.78, data = canvas.toDataURL('image/jpeg', q);
  while (data.length > 600000 && q > 0.35) { q -= 0.1; data = canvas.toDataURL('image/jpeg', q); }
  if (data.length > 900000) throw new Error('Foto terlalu besar, coba foto lain.');
  return { data, width: w, height: h };
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
