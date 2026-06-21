const DEFAULT_MAX_SIDE = 360;
const DEFAULT_MAX_CHARS = 60000;
const JPEG_QUALITIES = [0.82, 0.72, 0.62, 0.52];

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

function fitSize(width, height, maxSide) {
  const w = Math.max(1, Number(width || 1));
  const h = Math.max(1, Number(height || 1));
  const scale = Math.min(1, Math.max(1, Number(maxSide || DEFAULT_MAX_SIDE)) / Math.max(w, h));
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

export async function readCompressedPreviewImage(file, options = {}) {
  if (!file) return '';
  const maxSide = Math.max(96, Number(options.maxSide || DEFAULT_MAX_SIDE));
  const maxChars = Math.max(12000, Number(options.maxChars || DEFAULT_MAX_CHARS));
  const original = await readFileAsDataUrl(file);

  if (
    typeof document === 'undefined' ||
    typeof Image === 'undefined' ||
    !original.startsWith('data:image/')
  ) {
    return original.length <= maxChars ? original : '';
  }

  const img = await loadImage(original);
  const size = fitSize(img.naturalWidth || img.width, img.naturalHeight || img.height, maxSide);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return original.length <= maxChars ? original : '';

  ctx.drawImage(img, 0, 0, size.width, size.height);

  let best = '';
  for (const quality of JPEG_QUALITIES) {
    const candidate = canvas.toDataURL('image/jpeg', quality);
    best = candidate;
    if (candidate.length <= maxChars) return candidate;
  }

  return best.length <= Math.max(maxChars, DEFAULT_MAX_CHARS) ? best : '';
}
