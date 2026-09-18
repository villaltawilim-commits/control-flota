// Phone cameras produce 3-12 MB photos; invoices/pump readouts stay
// perfectly legible resized down and re-encoded as JPEG, which cuts that to
// a few hundred KB — much faster to upload on mobile data and cheaper to
// store. Runs entirely in the browser (canvas), nothing server-side.
export async function compressImage(file, { maxDimension = 1600, quality = 0.8 } = {}) {
  if (!file || !file.type || !file.type.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;

    if (width > maxDimension || height > maxDimension) {
      const scale = maxDimension / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file; // never make it bigger

    const newName = file.name ? file.name.replace(/\.[^.]+$/, "") + ".jpg" : "photo.jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch {
    // Unsupported format (rare) or canvas failure — fall back to the
    // original file rather than block the upload.
    return file;
  }
}
