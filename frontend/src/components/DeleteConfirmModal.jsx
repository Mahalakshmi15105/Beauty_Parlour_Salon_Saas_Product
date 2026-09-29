import React from "react";
import { Trash2, X } from "lucide-react";

export default function DeleteConfirmModal({
  isOpen,
  title = "Delete Employee?",
  itemName = "",
  itemType = "employee",
  onConfirm,
  onClose,
  loading = false,
}) {
  if (!isOpen) return null;

  const displayType = itemType ? itemType.charAt(0).toUpperCase() + itemType.slice(1) : "Record";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
      <div
        className="bg-surface w-full max-w-sm rounded-2xl border border-border-soft shadow-2xl p-6 space-y-4 animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <Trash2 className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-extrabold text-text-primary">
              {title || `Delete ${displayType}?`}
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-text-secondary hover:text-text-primary p-1 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2 Simple Lines */}
        <div className="text-xs text-text-secondary space-y-1">
          <p>
            Are you sure you want to delete{" "}
            <span className="font-extrabold text-text-primary">"{itemName || itemType}"</span>?
          </p>
          <p className="text-slate-500">
            This action is permanent and cannot be undone.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl border border-border-soft text-xs font-bold text-text-secondary hover:bg-background transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
          >
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

