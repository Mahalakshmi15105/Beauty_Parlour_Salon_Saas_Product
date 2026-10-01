/**
 * Google Drive Cloud Media Storage API Service
 * ============================================
 */

import API from "./api";
import { convertImageToWebP } from "../utils/imageOptimizer";

export const StorageService = {
  /**
   * Fetch current Google Drive connection status and folder IDs
   */
  async getStatus() {
    const res = await API.get("/storage/google-drive/status");
    return res.data || res;
  },

  /**
   * Get Google OAuth2 authorization URL
   */
  async getAuthUrl(redirectUri) {
    const uri = redirectUri || `${window.location.origin}/settings?tab=google_drive`;
    const res = await API.get(`/storage/google-drive/auth-url?redirect_uri=${encodeURIComponent(uri)}`);
    return res.data || res;
  },

  /**
   * Exchange OAuth authorization code for credentials and provision folders
   */
  async handleCallback(code, redirectUri) {
    const uri = redirectUri || `${window.location.origin}/settings?tab=google_drive`;
    const res = await API.post("/storage/google-drive/callback", { code, redirect_uri: uri });
    return res.data || res;
  },

  /**
   * Disconnect Google Drive storage
   */
  async disconnect() {
    const res = await API.post("/storage/google-drive/disconnect");
    return res.data || res;
  },

  /**
   * Save custom Google Cloud OAuth credentials
   */
  async saveCredentials(googleClientId, googleClientSecret) {
    const res = await API.post("/storage/google-drive/credentials", {
      google_client_id: googleClientId,
      google_client_secret: googleClientSecret,
    });
    return res.data || res;
  },

  /**
   * Converts any image to WebP and uploads to Google Drive under the specified category
   *
   * @param {File} rawFile - Original image file
   * @param {string} category - "services" | "products" | "logos" | "campaigns"
   * @param {Function} onProgress - Optional progress callback (0-100)
   */
  async uploadImage(rawFile, category = "general", onProgress = null) {
    if (onProgress) onProgress(15);

    // 1. Client-side WebP conversion & optimization
    const optimized = await convertImageToWebP(rawFile, { category });
    if (onProgress) onProgress(45);

    // 2. Prepare FormData
    const formData = new FormData();
    formData.append("file", optimized.file);
    formData.append("category", category);

    // 3. Upload to Google Drive via backend
    const res = await API.post("/storage/upload-image", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percent = 45 + Math.round((progressEvent.loaded * 50) / progressEvent.total);
          onProgress(Math.min(95, percent));
        }
      },
    });

    if (onProgress) onProgress(100);

    const data = res.data || res;
    return {
      ...data,
      savingsPercent: optimized.savingsPercent,
      originalSize: optimized.originalSize,
      optimizedSize: optimized.optimizedSize,
      localPreview: optimized.previewUrl,
    };
  },
};

export default StorageService;
