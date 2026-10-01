import React from "react";
import { HardDrive, X, ArrowRight, ShieldCheck, Zap, Sparkles } from "lucide-react";

export default function GoogleDriveGuardModal({ isOpen, onClose, onNavigateToSettings }) {
  if (!isOpen) return null;

  const handleGoToSettings = () => {
    if (onNavigateToSettings) {
      onNavigateToSettings();
    } else {
      // Set settings tab and trigger global navigation event
      window.dispatchEvent(new CustomEvent("navigate_tab", { detail: "settings" }));
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "google_drive");
      window.history.pushState({}, "", url.pathname + url.search);
      window.dispatchEvent(new CustomEvent("settings_tab_changed", { detail: "google_drive" }));
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="glowe-glass-card max-w-md w-full rounded-3xl shadow-2xl border border-white/70 overflow-hidden bg-white/95 text-slate-800 animate-scale-up">
        {/* Header */}
        <div className="px-6 py-5 border-b border-pink-100/60 flex justify-between items-center bg-gradient-to-r from-pink-50/70 via-purple-50/50 to-white">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-emerald-500 to-blue-500 p-0.5 flex items-center justify-center shadow-sm">
              <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
                <HardDrive className="w-5 h-5 text-indigo-600" />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">Google Drive Setup Required</h3>
              <p className="text-[11px] text-slate-500 font-medium">Cloud Media Storage & WebP Optimization</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="bg-gradient-to-br from-indigo-50/80 to-purple-50/50 border border-indigo-100 p-4 rounded-2xl space-y-2.5">
            <div className="flex items-center space-x-2 text-indigo-700">
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="text-xs font-bold">Why connect your Google Drive?</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              To keep your salon software fast and free up server space, all service photos, product catalog images, and logos are saved directly in a private folder inside your own Google Drive.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold shrink-0">
                <Zap className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-800">Auto WebP</p>
                <p className="text-[10px] text-slate-500">70% lighter images</p>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-bold shrink-0">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-800">100% Private</p>
                <p className="text-[10px] text-slate-500">Stored in your Drive</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end space-x-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGoToSettings}
            className="px-4 py-2 bg-gradient-to-r from-primary to-primary-hover text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition flex items-center space-x-1.5"
          >
            <span>Connect Google Drive</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
