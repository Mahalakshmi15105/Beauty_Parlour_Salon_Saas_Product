/**
 * Client-Side WebP Image Converter & Optimizer
 * ============================================
 * Converts incoming images (JPG, PNG, GIF, BMP, HEIC, etc.) to ultra-lightweight
 * WebP format in the browser canvas before uploading to Google Drive.
 */

export const MAX_DIMENSIONS = {
  logos: { maxWidth: 600, maxHeight: 600 },
  services: { maxWidth: 1200, maxHeight: 1200 },
  products: { maxWidth: 1200, maxHeight: 1200 },
  campaigns: { maxWidth: 1200, maxHeight: 1200 },
  general: { maxWidth: 1200, maxHeight: 1200 },
};

/**
 * Formats byte size into human readable string (KB / MB)
 */
export function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

/**
 * Converts any image file to an optimized WebP File
 *
 * @param {File} file - Original uploaded image file
 * @param {Object} options - Category, max dimensions, quality
 * @returns {Promise<{ file: File, blob: Blob, previewUrl: string, originalSize: number, optimizedSize: number, width: number, height: number, savingsPercent: number }>}
 */
export function convertImageToWebP(file, options = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      return reject(new Error("Please select a valid image file."));
    }

    const category = options.category || "general";
    const defaults = MAX_DIMENSIONS[category] || MAX_DIMENSIONS.general;
    const maxWidth = options.maxWidth || defaults.maxWidth;
    const maxHeight = options.maxHeight || defaults.maxHeight;
    const quality = options.quality !== undefined ? options.quality : 0.82;

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to decode image data."));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect-ratio preserved dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        // High quality smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return reject(new Error("WebP conversion failed in browser."));
            }

            // Generate clean WebP filename
            const cleanName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
            const webpFile = new File([blob], cleanName, { type: "image/webp" });
            const previewUrl = URL.createObjectURL(blob);
            const savingsPercent = Math.max(
              0,
              Math.round(((file.size - blob.size) / file.size) * 100)
            );

            resolve({
              file: webpFile,
              blob,
              previewUrl,
              originalSize: file.size,
              optimizedSize: blob.size,
              width,
              height,
              savingsPercent,
            });
          },
          "image/webp",
          quality
        );
      };
      img.src = event.target.result;
    };

    reader.readAsDataURL(file);
  });
}
