// Client-side downscale+recompress via canvas before upload. A raw
// phone camera photo is routinely 3-8MB; compressing to ~1600px wide
// JPEG at 0.8 quality cuts that to a few hundred KB, which matters on
// campus mobile data and keeps storage from filling with full-size
// originals for what's ultimately shown as a gallery thumbnail. The
// server's own 5MB limit + mimetype check remain the real safety net —
// this is a bandwidth/storage optimization, not a security control.
export async function compressImage(file, { maxWidth = 1600, quality = 0.8 } = {}) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxWidth / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality)
    );
    return blob || file;
  } catch {
    // If compression fails for any reason (unsupported format, etc.),
    // fall back to the original file rather than blocking the upload.
    return file;
  }
}
