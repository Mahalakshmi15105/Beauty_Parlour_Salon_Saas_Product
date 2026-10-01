import React, { useState, useEffect } from "react";
import StorageService from "../services/storageService";
import { useToast } from "../context/ToastContext";
import { formatBytes } from "../utils/imageOptimizer";
import {
  HardDrive,
  CheckCircle2,
  AlertCircle,
  Folder,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Zap,
  Layers,
  Key,
  ChevronDown,
  ChevronUp,
  UploadCloud,
  Check,
  ArrowRight,
} from "lucide-react";

export default function GoogleDriveSettings() {
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [statusData, setStatusData] = useState({
    connected: false,
    email: "",
    root_folder_id: "",
    services_folder_id: "",
    products_folder_id: "",
    logos_folder_id: "",
    campaigns_folder_id: "",
    has_custom_credentials: false,
  });

  // Test Upload State
  const [testUploading, setTestUploading] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await StorageService.getStatus();
      setStatusData(res);
    } catch (err) {
      showError(err.message || "Failed to fetch Google Drive status.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Check if OAuth code is in URL search params
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get("code");
    if (code) {
      handleOAuthCallback(code);
    }
  }, []);

  const handleOAuthCallback = async (code) => {
    try {
      setConnecting(true);
      // Clean code from URL
      const url = new URL(window.location.href);
      url.searchParams.delete("code");
      url.searchParams.delete("scope");
      url.searchParams.delete("authuser");
      url.searchParams.delete("prompt");
      url.searchParams.delete("state");
      window.history.replaceState({}, "", url.pathname + url.search);

      const redirectUri = `${window.location.origin}/settings?tab=google_drive`;
      const res = await StorageService.handleCallback(code, redirectUri);
      showSuccess(res.message || "Google Drive connected and folders created!");
      fetchStatus();
    } catch (err) {
      showError(err.message || "Failed to complete Google Drive authorization.");
    } finally {
      setConnecting(false);
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      const redirectUri = `${window.location.origin}/settings?tab=google_drive`;
      const res = await StorageService.getAuthUrl(redirectUri);

      if (res.auth_url) {
        window.location.href = res.auth_url;
      } else {
        showError("Google Client ID is not configured on the backend server.");
        setConnecting(false);
      }
    } catch (err) {
      showError(err.response?.data?.message || err.message || "Google OAuth is not configured on the server.");
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Are you sure you want to disconnect Google Drive? New image uploads will be paused until reconnected.")) {
      return;
    }

    try {
      setDisconnecting(true);
      await StorageService.disconnect();
      showSuccess("Google Drive disconnected.");
      fetchStatus();
    } catch (err) {
      showError(err.message || "Failed to disconnect Google Drive.");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleTestUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setTestUploading(true);
      setTestResult(null);
      const res = await StorageService.uploadImage(file, "general");
      setTestResult(res);
      showSuccess("Test image converted to WebP and saved to Google Drive!");
    } catch (err) {
      showError(err.message || "Test upload failed.");
    } finally {
      setTestUploading(false);
    }
  };

  if (loading && !connecting) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-6 bg-border-soft rounded animate-pulse w-1/3"></div>
        <div className="h-28 bg-border-soft rounded-2xl animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="border-b border-border-soft pb-4 flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold text-text-primary flex items-center space-x-2">
            <HardDrive className="w-4 h-4 text-pink-600" />
            <span>Google Drive Cloud Media Storage</span>
          </h3>
          <p className="text-[11px] text-text-secondary mt-0.5">
            Store salon photos (Services, Products, Logo, Campaigns) in your personal Google Drive with automatic WebP compression.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchStatus}
          className="p-1.5 rounded-lg border border-border-soft text-text-secondary hover:text-text-primary hover:bg-background transition"
          title="Refresh Status"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Connection Card */}
      {statusData.connected ? (
        <div className="bg-gradient-to-br from-emerald-50/60 via-surface to-background border border-emerald-200/80 rounded-2xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="text-sm font-extrabold text-slate-900">Google Drive Connected</h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Active
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-medium mt-0.5">
                  Linked Account: <span className="font-semibold text-slate-900">{statusData.email || "Google Account"}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5">
              {statusData.root_folder_id && (
                <a
                  href={`https://drive.google.com/drive/folders/${statusData.root_folder_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 transition flex items-center space-x-1.5 shadow-2xs"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                  <span>Open Drive Folder</span>
                </a>
              )}
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="px-3.5 py-2 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition disabled:opacity-50"
              >
                {disconnecting ? "Disconnecting..." : "Disconnect"}
              </button>
            </div>
          </div>

          {/* Provisioned Folders Grid */}
          <div className="pt-4 border-t border-emerald-100/80">
            <p className="text-xs font-bold text-slate-800 mb-3 flex items-center space-x-1.5">
              <Folder className="w-3.5 h-3.5 text-amber-500" />
              <span>Organized Cloud Folders (Auto-Provisioned)</span>
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { name: "Services", id: statusData.services_folder_id, count: "Service Photos" },
                { name: "Products", id: statusData.products_folder_id, count: "Product Catalog" },
                { name: "Logos", id: statusData.logos_folder_id, count: "Salon Branding" },
                { name: "Campaigns", id: statusData.campaigns_folder_id, count: "WhatsApp Offers" },
              ].map((f) => (
                <div
                  key={f.name}
                  className="bg-white/90 border border-slate-200/80 p-3.5 rounded-xl flex flex-col justify-between space-y-2 hover:border-primary/40 transition shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Folder className="w-4 h-4" />
                    </div>
                    {f.id && (
                      <a
                        href={`https://drive.google.com/drive/folders/${f.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-400 hover:text-primary transition"
                        title="View folder in Google Drive"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">{f.name}</p>
                    <p className="text-[10px] text-slate-500">{f.count}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Live Test Upload */}
          <div className="pt-4 border-t border-emerald-100/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white/60 p-4 rounded-xl">
            <div>
              <p className="text-xs font-bold text-slate-800">Verify WebP Drive Upload</p>
              <p className="text-[11px] text-slate-500">Pick any image to test client-side WebP compression and Drive storage.</p>
            </div>
            <div>
              <input
                type="file"
                accept="image/*"
                id="test-drive-upload"
                onChange={handleTestUpload}
                className="hidden"
              />
              <button
                type="button"
                disabled={testUploading}
                onClick={() => document.getElementById("test-drive-upload")?.click()}
                className="px-3.5 py-1.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition flex items-center space-x-1.5"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>{testUploading ? "Optimizing & Uploading..." : "Upload Test Image"}</span>
              </button>
            </div>
          </div>

          {testResult && (
            <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-xs space-y-1.5 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-800">✓ WebP Upload Successful!</span>
                <span className="bg-emerald-200/60 text-emerald-900 px-2 py-0.5 rounded-full text-[10px] font-extrabold">
                  {testResult.savingsPercent}% Size Reduction
                </span>
              </div>
              <p className="text-slate-600 text-[11px]">
                Original: {formatBytes(testResult.originalSize)} → WebP: {formatBytes(testResult.size_bytes)} ({testResult.width}x{testResult.height}px)
              </p>
              <a
                href={testResult.image_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1 text-primary hover:underline text-[11px] font-semibold"
              >
                <span>View Stored Image</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gradient-to-br from-pink-50/60 via-purple-50/40 to-white border border-pink-100 rounded-3xl p-7 space-y-6 shadow-md">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
            <div className="space-y-1.5 max-w-xl">
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                  Not Connected
                </span>
                <h4 className="text-base font-extrabold text-slate-900 tracking-tight">Connect Your Google Drive</h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Connect your Google Drive once. When you upload photos for services, products, or your salon logo, they will be automatically compressed to WebP and stored directly in your Google Drive without using local server space.
              </p>
            </div>

            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting}
              className="px-6 py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-2xl text-xs font-extrabold shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 flex items-center space-x-2.5 shrink-0 disabled:opacity-50 cursor-pointer"
            >
              <HardDrive className="w-4 h-4" />
              <span>{connecting ? "Connecting to Google..." : "Connect Google Drive"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
            <div className="bg-white/90 border border-pink-100 p-4 rounded-2xl space-y-1.5 shadow-2xs">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Zap className="w-4 h-4" />
              </div>
              <h5 className="text-xs font-bold text-slate-800">Auto WebP Compression</h5>
              <p className="text-[11px] text-slate-500 leading-normal">
                Any uploaded JPG or PNG is automatically converted to WebP (60-80% smaller) for instantaneous app loading.
              </p>
            </div>

            <div className="bg-white/90 border border-pink-100 p-4 rounded-2xl space-y-1.5 shadow-2xs">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h5 className="text-xs font-bold text-slate-800">Total Ownership & Privacy</h5>
              <p className="text-[11px] text-slate-500 leading-normal">
                Media remains in your personal Google Drive account. You can view, organize, or backup your files anytime.
              </p>
            </div>

            <div className="bg-white/90 border border-pink-100 p-4 rounded-2xl space-y-1.5 shadow-2xs">
              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <h5 className="text-xs font-bold text-slate-800">Auto Folder Hierarchy</h5>
              <p className="text-[11px] text-slate-500 leading-normal">
                Automatically creates dedicated sub-folders for Services, Products, Logos, and Marketing Campaigns.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
