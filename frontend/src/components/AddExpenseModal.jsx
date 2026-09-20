import React, { useState } from "react";
import API from "../services/api";
import { useToast } from "../context/ToastContext";
import { X, Receipt, PlusCircle } from "lucide-react";

export default function AddExpenseModal({ isOpen, onClose, onSuccess }) {
  const { showSuccess, showError } = useToast();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const amtVal = parseFloat(amount);
    if (!amount || isNaN(amtVal) || amtVal <= 0) {
      showError("Please enter a valid expense amount > 0.");
      return;
    }

    setSubmitting(true);
    API.post("/expenses", { amount: amtVal, note, date })
      .then(() => {
        showSuccess("Expense added successfully!");
        setSubmitting(false);
        setAmount("");
        setNote("");
        if (onSuccess) onSuccess();
        onClose();
      })
      .catch((err) => {
        showError(err.message || "Failed to save expense.");
        setSubmitting(false);
      });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="glowe-glass-card max-w-md w-full rounded-3xl shadow-2xl border border-white/70 overflow-hidden">
        <div className="px-6 py-4 border-b border-pink-100/60 flex justify-between items-center bg-white/50 backdrop-blur-md">
          <div className="flex items-center space-x-2">
            <Receipt className="w-5 h-5 text-pink-600" />
            <h3 className="text-md font-bold text-slate-900">Add Daily Expense</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Expense Amount (₹) *</label>
            <input
              type="number"
              step="0.01"
              required
              placeholder="e.g. 350"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-white/90 border border-pink-100 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-pink-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Description / Note</label>
            <textarea
              rows="2"
              placeholder="e.g. Tea/Coffee, Cleaning supplies, Salon Refreshments"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-white/90 border border-pink-100 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-pink-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-white/90 border border-pink-100 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-pink-500"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 glowe-pink-gradient text-white rounded-xl text-xs font-extrabold shadow-md disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save Expense"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
