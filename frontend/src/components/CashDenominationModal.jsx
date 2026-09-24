import React, { useState, useEffect } from "react";
import API from "../services/api";
import { useToast } from "../context/ToastContext";
import { X, Banknote, Save } from "lucide-react";

const DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1];

export default function CashDenominationModal({ isOpen, onClose, date: initialDate, onSuccess }) {
  const { showSuccess, showError } = useToast();
  const [date, setDate] = useState(initialDate || new Date().toISOString().split("T")[0]);
  const [counts, setCounts] = useState({
    500: 0,
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    5: 0,
    2: 0,
    1: 0,
  });
  const [expectedCashTotal, setExpectedCashTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchDenomination();
      fetchExpectedCash();
    }
  }, [isOpen, date]);

  const fetchExpectedCash = () => {
    API.get(`/reports/daily-sales-statement?date=${date}`)
      .then((res) => {
        const cashVal = res?.data?.totals?.cash || res?.data?.balance?.cash_pay || 0;
        setExpectedCashTotal(parseFloat(cashVal) || 0);
      })
      .catch(() => {
        setExpectedCashTotal(0);
      });
  };

  const fetchDenomination = () => {
    setLoading(true);
    API.get(`/cash-denominations?date=${date}`)
      .then((res) => {
        const d = res.data || {};
        setCounts({
          500: d.count_500 || 0,
          200: d.count_200 || 0,
          100: d.count_100 || 0,
          50: d.count_50 || 0,
          20: d.count_20 || 0,
          10: d.count_10 || 0,
          5: d.count_5 || 0,
          2: d.count_2 || 0,
          1: d.count_1 || 0,
        });
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  };

  const handleCountChange = (denom, val) => {
    const num = parseInt(val, 10);
    setCounts((prev) => ({
      ...prev,
      [denom]: isNaN(num) || num < 0 ? 0 : num,
    }));
  };

  const calculateTotal = () => {
    return DENOMINATIONS.reduce((sum, d) => sum + d * (counts[d] || 0), 0);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      date,
      count_500: counts[500] || 0,
      count_200: counts[200] || 0,
      count_100: counts[100] || 0,
      count_50: counts[50] || 0,
      count_20: counts[20] || 0,
      count_10: counts[10] || 0,
      count_5: counts[5] || 0,
      count_2: counts[2] || 0,
      count_1: counts[1] || 0,
    };

    API.post("/cash-denominations", payload)
      .then(() => {
        showSuccess("End-of-day Cash Denominations saved successfully!");
        setSubmitting(false);
        if (onSuccess) onSuccess();
        onClose();
      })
      .catch((err) => {
        showError(err.message || "Failed to save cash denomination.");
        setSubmitting(false);
      });
  };

  if (!isOpen) return null;

  const grandTotal = calculateTotal();
  const diff = grandTotal - expectedCashTotal;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="glowe-glass-card max-w-lg w-full rounded-3xl shadow-2xl border border-white/70 overflow-hidden">
        <div className="px-6 py-4 border-b border-pink-100/60 flex justify-between items-center bg-white/50 backdrop-blur-md">
          <div className="flex items-center space-x-2">
            <Banknote className="w-5 h-5 text-emerald-600" />
            <h3 className="text-md font-bold text-slate-900">End-of-Day Cash Denominations</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Header Stats: System Cash vs Counted Cash & Tally Status */}
          <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <label className="block text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-emerald-950 focus:outline-none numeric"
                />
              </div>
              <div className="text-right">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Expected System Cash</span>
                <span className="text-sm font-extrabold text-emerald-900 numeric">₹ {expectedCashTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="border-t border-emerald-200/80 pt-2.5 flex justify-between items-center">
              <div>
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Tally Status</span>
                {diff === 0 ? (
                  <span className="inline-flex items-center space-x-1 text-xs font-extrabold text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full">
                    <span>✓ Cash Balanced</span>
                  </span>
                ) : diff > 0 ? (
                  <span className="inline-flex items-center space-x-1 text-xs font-extrabold text-indigo-700 bg-indigo-100/80 px-2.5 py-0.5 rounded-full numeric">
                    <span>+₹ {diff.toLocaleString("en-IN", { minimumFractionDigits: 2 })} (Excess Cash)</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1 text-xs font-extrabold text-rose-700 bg-rose-100/80 px-2.5 py-0.5 rounded-full numeric">
                    <span>-₹ {Math.abs(diff).toLocaleString("en-IN", { minimumFractionDigits: 2 })} (Shortage)</span>
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Counted Total</span>
                <span className="text-lg font-black text-emerald-700 numeric">₹ {grandTotal.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {DENOMINATIONS.map((d) => {
              const count = counts[d] || 0;
              const subtotal = d * count;
              return (
                <div key={d} className="py-2.5 flex items-center justify-between space-x-4">
                  <div className="w-24 font-bold text-sm text-slate-700 numeric">₹ {d}</div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-slate-400">×</span>
                    <input
                      type="number"
                      min="0"
                      value={count === 0 ? "" : count}
                      placeholder="0"
                      onChange={(e) => handleCountChange(d, e.target.value)}
                      className="w-24 bg-white/90 border border-pink-100 px-3 py-1.5 rounded-xl text-sm font-extrabold text-slate-900 text-center focus:outline-none focus:border-pink-500 numeric"
                    />
                  </div>
                  <div className="w-28 text-right font-black text-sm text-slate-900 numeric">
                    = ₹ {subtotal.toLocaleString("en-IN")}
                  </div>
                </div>
              );
            })}
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
              disabled={submitting || loading}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-md disabled:opacity-50 flex items-center space-x-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{submitting ? "Saving..." : "Save Denominations"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
