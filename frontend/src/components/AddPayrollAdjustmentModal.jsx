import React, { useState, useEffect } from "react";
import API from "../services/api";
import { useToast } from "../context/ToastContext";
import { X, DollarSign, PlusCircle } from "lucide-react";

export default function AddPayrollAdjustmentModal({ isOpen, onClose, defaultEmployeeId, onSuccess }) {
  const { showSuccess, showError } = useToast();
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState(defaultEmployeeId || "");
  const [type, setType] = useState("Advance"); // Advance, Deduction
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (defaultEmployeeId) setEmployeeId(defaultEmployeeId);
      fetchEmployees();
    }
  }, [isOpen, defaultEmployeeId]);

  const fetchEmployees = () => {
    API.get("/employees?limit=100")
      .then((res) => {
        setEmployees(res.data.items || []);
        if (!employeeId && res.data.items?.length > 0) {
          setEmployeeId(res.data.items[0].id);
        }
      })
      .catch(() => {});
  };

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const amtVal = parseFloat(amount);
    if (!employeeId) {
      showError("Please select an employee.");
      return;
    }
    if (!amount || isNaN(amtVal) || amtVal <= 0) {
      showError("Please enter a valid amount > 0.");
      return;
    }

    setSubmitting(true);
    API.post("/payroll-adjustments", {
      employee_id: parseInt(employeeId, 10),
      type,
      amount: amtVal,
      note,
      date,
    })
      .then(() => {
        showSuccess(`${type} logged successfully!`);
        setSubmitting(false);
        setAmount("");
        setNote("");
        if (onSuccess) onSuccess();
        onClose();
      })
      .catch((err) => {
        showError(err.message || "Failed to log payroll adjustment.");
        setSubmitting(false);
      });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="glowe-glass-card max-w-md w-full rounded-3xl shadow-2xl border border-white/70 overflow-hidden">
        <div className="px-6 py-4 border-b border-pink-100/60 flex justify-between items-center bg-white/50 backdrop-blur-md">
          <div className="flex items-center space-x-2">
            <DollarSign className="w-5 h-5 text-indigo-600" />
            <h3 className="text-md font-bold text-slate-900">Log Advance / Deduction</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Select Employee *</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full bg-white/90 border border-pink-100 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-pink-500"
            >
              <option value="">-- Choose Employee --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name || ""} ({emp.role || "Staff"})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Adjustment Type *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-white/90 border border-pink-100 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-pink-500"
              >
                <option value="Advance">Advance Paid (+)</option>
                <option value="Deduction">Deduction (-)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="e.g. 1000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-white/90 border border-pink-100 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-pink-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Reason / Note</label>
            <textarea
              rows="2"
              placeholder="e.g. Festival advance, Loss damage deduction"
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
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-md disabled:opacity-50"
            >
              {submitting ? "Logging..." : "Log Adjustment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
