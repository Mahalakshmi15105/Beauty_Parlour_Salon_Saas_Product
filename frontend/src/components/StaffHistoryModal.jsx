import React, { useState, useEffect } from "react";
import API from "../services/api";
import { 
  X, History, Phone, User, Calendar, DollarSign, Briefcase, 
  Search, Printer, FileSpreadsheet, Check, Copy, Clock, Sparkles
} from "lucide-react";
import { exportToExcel, printDataList } from "../utils/exportUtils";

export default function StaffHistoryModal({ isOpen, onClose, employee }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedField, setCopiedField] = useState(null);

  useEffect(() => {
    if (isOpen && employee?.id) {
      fetchHistory(employee.id);
    } else {
      setHistoryData(null);
      setSearchTerm("");
      setError(null);
    }
  }, [isOpen, employee?.id]);

  const fetchHistory = (empId) => {
    setLoading(true);
    setError(null);
    API.get(`/employees/${empId}/history`)
      .then((res) => {
        const payload = res?.data !== undefined ? res.data : res;
        setHistoryData(payload || {});
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load staff history.");
        setLoading(false);
      });
  };

  if (!isOpen || !employee) return null;

  const emp = historyData?.employee || employee;
  const stats = historyData?.stats || {
    total_services: 0,
    total_revenue: 0,
    total_clients: 0,
    this_month_services: 0,
    this_month_revenue: 0,
  };
  const allHistory = historyData?.history || [];

  const filteredHistory = allHistory.filter((item) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (item.client_name || "").toLowerCase().includes(term) ||
      (item.client_phone || "").toLowerCase().includes(term) ||
      (item.service_name || "").toLowerCase().includes(term) ||
      (item.invoice_number || "").toLowerCase().includes(term)
    );
  });

  const handleExportExcel = () => {
    const columns = [
      { header: "Date & Time", accessor: "date_formatted" },
      { header: "Invoice #", accessor: "invoice_number" },
      { header: "Client Name", accessor: "client_name" },
      { header: "Client Phone", accessor: "client_phone" },
      { header: "Service Name", accessor: "service_name" },
      { header: "Quantity", accessor: "quantity" },
      { header: "Unit Price", accessor: (row) => `₹${parseFloat(row.unit_price || 0).toFixed(2)}` },
      { header: "Total (₹)", accessor: (row) => parseFloat(row.line_total || 0).toFixed(2) },
      { header: "Status", accessor: "invoice_status" },
    ];
    exportToExcel(
      `Staff History - ${emp.full_name || emp.first_name}`,
      filteredHistory,
      columns,
      `staff_history_${emp.first_name}_${new Date().toISOString().split("T")[0]}`,
      "Salon Staff Performance"
    );
  };

  const handlePrint = () => {
    const columns = [
      { header: "Date", accessor: "date_formatted" },
      { header: "Invoice #", accessor: "invoice_number" },
      { header: "Client Name", accessor: "client_name" },
      { header: "Client Phone", accessor: "client_phone" },
      { header: "Service Taken", accessor: "service_name" },
      { header: "Total (₹)", accessor: (row) => `₹${parseFloat(row.line_total || 0).toLocaleString("en-IN")}` },
      { header: "Status", accessor: "invoice_status" },
    ];
    printDataList(
      `Service History for ${emp.full_name || emp.first_name}`,
      filteredHistory,
      columns,
      "Salon Staff History"
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 z-50 animate-fade-in">
      <div className="glowe-glass-card max-w-5xl w-full max-h-[92vh] flex flex-col rounded-3xl shadow-2xl border border-white/70 overflow-hidden bg-white/95">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-pink-100 flex justify-between items-center bg-gradient-to-r from-pink-50/80 via-white to-pink-50/50 backdrop-blur-md shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 text-white flex items-center justify-center shadow-md shadow-pink-500/20">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  Staff History & Records
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  emp.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                }`}>
                  {emp.status || "active"}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Detailed profile, clients served, and service transaction history
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {filteredHistory.length > 0 && (
              <>
                <button
                  onClick={handlePrint}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-sm"
                  title="Print History"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                  <span>Print</span>
                </button>
                <button
                  onClick={handleExportExcel}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition shadow-sm"
                  title="Export to Excel"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Excel</span>
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <div className="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-semibold text-slate-500">Loading staff history and services...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm font-semibold">
              {error}
            </div>
          ) : (
            <>
              {/* Employee Overview Card */}
              <div className="bg-gradient-to-br from-pink-50/70 via-rose-50/30 to-purple-50/50 p-4 sm:p-5 rounded-2xl border border-pink-100/80 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-pink-600 to-rose-400 text-white flex items-center justify-center font-black text-xl shadow-md">
                      {emp.first_name?.[0]?.toUpperCase() || "S"}
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-slate-900">
                        {emp.full_name || `${emp.first_name} ${emp.last_name || ""}`.trim()}
                      </h4>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        <span className="text-xs font-bold text-pink-700 bg-pink-100/70 px-2 py-0.5 rounded-md">
                          {emp.role || "Salon Staff"}
                        </span>
                        <span className="text-xs font-semibold text-slate-600 bg-white/80 px-2 py-0.5 rounded-md border border-slate-200/80">
                          Level: <strong className="numeric">{emp.level || "L1"}</strong>
                        </span>
                        <span className="text-xs font-semibold text-slate-600 bg-white/80 px-2 py-0.5 rounded-md border border-slate-200/80">
                          {emp.branch_name || "Main Branch"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <div className="bg-white/90 px-3 py-2 rounded-xl border border-pink-100 shadow-sm">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Commission</span>
                      <span className="text-sm font-black text-emerald-600 numeric">{emp.commission_percentage || 0}%</span>
                    </div>
                    <div className="bg-white/90 px-3 py-2 rounded-xl border border-pink-100 shadow-sm">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Base Salary</span>
                      <span className="text-sm font-black text-slate-800 numeric">₹{parseFloat(emp.salary || 0).toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-pink-100/70 text-xs">
                  <div className="bg-white/80 p-2.5 rounded-xl border border-pink-100/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Phone</span>
                    <span className="font-bold text-slate-900 numeric">{emp.phone || "-"}</span>
                  </div>
                  <div className="bg-white/80 p-2.5 rounded-xl border border-pink-100/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Email / Username</span>
                    <span className="font-semibold text-slate-900 truncate block">{emp.email || emp.username || "-"}</span>
                  </div>
                  <div className="bg-white/80 p-2.5 rounded-xl border border-pink-100/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Specialization</span>
                    <span className="font-semibold text-slate-900">{emp.specialization || "All Services"}</span>
                  </div>
                  <div className="bg-white/80 p-2.5 rounded-xl border border-pink-100/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Shift Hours</span>
                    <span className="font-semibold text-slate-900 numeric">{emp.shift_hours || "09:00 - 18:00"}</span>
                  </div>
                </div>
              </div>

              {/* Quick Stat Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-pink-100 text-pink-700 flex items-center justify-center shrink-0 font-bold">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block">Total Services</span>
                    <span className="text-lg font-black text-slate-900 numeric">{stats.total_services}</span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block">Revenue Billed</span>
                    <span className="text-lg font-black text-emerald-600 numeric">₹{parseFloat(stats.total_revenue || 0).toLocaleString("en-IN")}</span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 font-bold">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block">Unique Clients</span>
                    <span className="text-lg font-black text-indigo-900 numeric">{stats.total_clients}</span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 font-bold">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block">This Month</span>
                    <span className="text-lg font-black text-amber-900 numeric">₹{parseFloat(stats.this_month_revenue || 0).toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </div>

              {/* Service & Client History Section */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                      Client Services History
                    </h4>
                    <span className="bg-pink-100 text-pink-800 text-xs font-black px-2 py-0.5 rounded-full numeric">
                      {filteredHistory.length}
                    </span>
                  </div>

                  {/* Search Filter */}
                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search client, phone, service..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {/* Table of Services */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                  {filteredHistory.length === 0 ? (
                    <div className="py-12 text-center space-y-2">
                      <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                        <History className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-slate-700">No Service Records Found</p>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        {searchTerm ? "No services match your search filter." : "This employee has not been assigned to any billed services yet."}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-[380px]">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-50/80 sticky top-0 border-b border-slate-200 z-10 backdrop-blur-sm">
                          <tr>
                            <th className="px-4 py-3 font-bold text-slate-600 uppercase">#</th>
                            <th className="px-4 py-3 font-bold text-slate-600 uppercase">Date & Time</th>
                            <th className="px-4 py-3 font-bold text-slate-600 uppercase">Invoice #</th>
                            <th className="px-4 py-3 font-bold text-slate-600 uppercase">Client Name</th>
                            <th className="px-4 py-3 font-bold text-slate-600 uppercase">Client Phone</th>
                            <th className="px-4 py-3 font-bold text-slate-600 uppercase">Service Provided</th>
                            <th className="px-4 py-3 font-bold text-slate-600 uppercase text-right">Amount</th>
                            <th className="px-4 py-3 font-bold text-slate-600 uppercase text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredHistory.map((item, idx) => (
                            <tr key={item.id || idx} className="hover:bg-pink-50/30 transition">
                              <td className="px-4 py-3 font-semibold text-slate-400 numeric">{idx + 1}</td>
                              <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap numeric">
                                {item.date_formatted}
                              </td>
                              <td className="px-4 py-3">
                                <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md font-mono text-[11px]">
                                  {item.invoice_number}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-bold text-slate-900">
                                <div className="flex items-center space-x-1.5">
                                  <User className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                                  <span>{item.client_name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 font-medium text-slate-600 numeric">
                                <div className="flex items-center space-x-1">
                                  <Phone className="w-3 h-3 text-slate-400" />
                                  <span>{item.client_phone}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-block px-2.5 py-1 rounded-lg bg-pink-50 text-pink-800 font-bold border border-pink-100">
                                  {item.service_name}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-black text-slate-900 text-right numeric">
                                ₹{parseFloat(item.line_total || 0).toLocaleString("en-IN")}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  item.invoice_status === "Paid" 
                                    ? "bg-emerald-100 text-emerald-800" 
                                    : "bg-amber-100 text-amber-800"
                                }`}>
                                  {item.invoice_status || "Paid"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-800">{filteredHistory.length}</strong> service records
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}

