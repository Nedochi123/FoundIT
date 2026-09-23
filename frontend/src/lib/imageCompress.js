// Client-side downscale+recompress via canvas before upload. A raw
// phone camera photo is routinely 3-8MB; the photo is only ever
// displayed back as a small gallery thumbnail (h-44 in a 2-column
// grid), so 800px wide is already well above what that ever needs at
// retina density — compressing to that at 0.8 quality cuts a multi-MB
// original to tens of KB, which matters both for the uploader's mobile
// data and for every other student re-downloading it in the gallery.
// The server's own 5MB limit + mimetype check remain the real safety
// net — this is a bandwidth/storage optimization, not a security control.
export async function compressImage(file, { maxWidth = 800, quality = 0.8 } = {}) {
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
