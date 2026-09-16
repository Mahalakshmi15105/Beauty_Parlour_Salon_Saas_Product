import React, { useState, useEffect } from "react";
import API from "../services/api";
import {
  Gift,
  Search,
  RefreshCw,
  SlidersHorizontal,
  RotateCcw,
  Check,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Clock,
  Sparkles,
} from "lucide-react";

export default function VisitMembershipRecords() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("last_visit");
  const [requiredVisits, setRequiredVisits] = useState(6);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Reset Modal State
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [newCount, setNewCount] = useState(0);
  const [resetting, setResetting] = useState(false);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const activeBranchId = user.branch_id || null;

  useEffect(() => {
    fetchRecords();
  }, [page, sortBy, search]);

  const fetchRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await API.get("/visit-membership/customer-records", {
        params: {
          branch_id: activeBranchId,
          search: search,
          sort: sortBy,
          page: page,
          limit: limit,
        },
      });
      const data = res.data || res;
      setRecords(data.items || []);
      setTotal(data.total || 0);
      if (data.required_visits) {
        setRequiredVisits(data.required_visits);
      }
    } catch (err) {
      setError(err.message || "Failed to load customer visit records.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenResetModal = (record) => {
    setSelectedRecord(record);
    setNewCount(0);
  };

  const handleConfirmReset = async (e) => {
    e.preventDefault();
    if (!selectedRecord) return;

    setResetting(true);
    setError(null);
    try {
      await API.post("/visit-membership/reset-counter", {
        customer_id: selectedRecord.customer_id,
        branch_id: activeBranchId,
        new_count: parseInt(newCount) || 0,
      });

      setSuccessMsg(`Updated visit count for ${selectedRecord.customer_name} to ${newCount}!`);
      setTimeout(() => setSuccessMsg(null), 4000);
      setSelectedRecord(null);
      fetchRecords();
    } catch (err) {
      setError(err.message || "Failed to update visit counter.");
    } finally {
      setResetting(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "Never Visited";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return dateStr;
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-surface border border-border-soft p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-xl">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Customer Visit Loyalty Records</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Track client visit progress towards earned 100% FREE services for this location.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-xs font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
            Active Mode: Visit-Based Free Service ({requiredVisits} Visits)
          </span>
          <button
            onClick={fetchRecords}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
            title="Refresh Table"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-primary" : ""}`} />
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold flex items-center space-x-2 animate-fade-in">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Control Bar: Search & Sort */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-surface border border-border-soft p-4 rounded-2xl">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by customer name or phone..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-background border border-border-soft pl-10 pr-4 py-2 rounded-xl text-xs font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-pink-500/20"
          />
        </div>

        {/* Sort selector */}
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <SlidersHorizontal className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-600 shrink-0">Sort By:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-background border border-border-soft px-3 py-2 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-primary"
          >
            <option value="last_visit">Last Visit Date (Recent First)</option>
            <option value="visit_count">Current Visit Count (Highest First)</option>
            <option value="name">Customer Name (A - Z)</option>
          </select>
        </div>
      </div>

      {/* Customer Visit Records Table */}
      <div className="bg-surface border border-border-soft rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-background border-b border-border-soft text-sm font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3.5">Customer</th>
                <th className="px-4 py-3.5">Phone Number</th>
                <th className="px-4 py-3.5">Visit Progress</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Last Visit Date</th>
                <th className="px-4 py-3.5 text-center">Total Free Claimed</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border-soft text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 font-bold">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading customer visit progress records...</span>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 font-medium">
                    No customer visit records found matching your search filter.
                  </td>
                </tr>
              ) : (
                records.map((row) => {
                  const pct = Math.min(100, Math.round((row.current_visit_count / requiredVisits) * 100));

                  return (
                    <tr key={row.customer_id} className="hover:bg-slate-50/80 transition">
                      {/* Customer Name */}
                      <td className="px-5 py-4 font-extrabold text-slate-900">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-xs shrink-0">
                            {row.customer_name.charAt(0).toUpperCase()}
                          </div>
                          <span>{row.customer_name}</span>
                        </div>
                      </td>

                      {/* Phone Number */}
                      <td className="px-4 py-4 font-bold text-slate-600">{row.phone || "N/A"}</td>

                      {/* Visit Progress Bar */}
                      <td className="px-4 py-4">
                        <div className="space-y-1 w-36">
                          <div className="flex justify-between items-center text-[11px] font-extrabold">
                            <span className="text-slate-800">
                              {row.current_visit_count} / {requiredVisits} Visits
                            </span>
                            <span className="text-slate-400">{pct}%</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                            <div
                              className={`h-full transition-all duration-300 ${
                                row.is_eligible
                                  ? "bg-emerald-500 animate-pulse"
                                  : row.current_visit_count > 0
                                  ? "bg-primary"
                                  : "bg-slate-300"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="px-4 py-4">
                        {row.is_eligible ? (
                          <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-500 text-white rounded-full text-[10px] font-black shadow-2xs animate-bounce">
                            <Sparkles className="w-3 h-3" />
                            <span>🎁 Reward Ready</span>
                          </span>
                        ) : row.current_visit_count > 0 ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-[10px] font-bold">
                            <Clock className="w-3 h-3 text-blue-500" />
                            <span>In Progress</span>
                          </span>
                        ) : row.total_free_services_claimed > 0 ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-bold">
                            <Check className="w-3 h-3 text-amber-600" />
                            <span>Redeemed</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold">
                            New Client
                          </span>
                        )}
                      </td>

                      {/* Last Visit Date */}
                      <td className="px-4 py-4 text-slate-600 font-medium">
                        {formatDate(row.last_visit_date)}
                      </td>

                      {/* Total Free Claimed */}
                      <td className="px-4 py-4 text-center font-extrabold text-slate-900">
                        {row.total_free_services_claimed > 0 ? (
                          <span className="inline-block px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-black text-xs">
                            {row.total_free_services_claimed}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>

                      {/* Manual Reset Action */}
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => handleOpenResetModal(row)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition inline-flex items-center space-x-1.5"
                          title="Manually adjust or reset customer visit count"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                          <span>Reset Count</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 bg-background border-t border-border-soft flex justify-between items-center">
          <p className="text-xs font-semibold text-slate-500">
            Showing <span className="font-extrabold text-slate-800">{records.length}</span> of{" "}
            <span className="font-extrabold text-slate-800">{total}</span> customers
          </p>

          <div className="flex items-center space-x-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="p-2 border border-border-soft bg-white text-slate-700 rounded-xl disabled:opacity-40 hover:bg-slate-100 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs font-extrabold text-slate-800 px-2">
              Page {page} of {totalPages}
            </span>

            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="p-2 border border-border-soft bg-white text-slate-700 rounded-xl disabled:opacity-40 hover:bg-slate-100 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Manual Counter Reset Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border-soft p-6 rounded-2xl max-w-sm w-full space-y-4 shadow-xl animate-fade-in">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                  <RotateCcw className="w-4 h-4 text-primary" />
                  <span>Adjust Visit Counter</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update visit count for <strong className="text-slate-800">{selectedRecord.customer_name}</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmReset} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  New Visit Count (Required threshold: {requiredVisits})
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={newCount}
                  onChange={(e) => setNewCount(e.target.value)}
                  className="w-full bg-background border border-border-soft px-3.5 py-2 rounded-xl text-xs font-extrabold text-slate-900 focus:outline-none focus:border-primary"
                  required
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Set to <strong>0</strong> to reset, or enter any custom count for promotions or manual adjustments.
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-border-soft">
                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={resetting}
                  className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-extrabold shadow-md shadow-pink-500/20 hover:bg-primary-hover disabled:opacity-50"
                >
                  {resetting ? "Saving..." : "Confirm Update"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
