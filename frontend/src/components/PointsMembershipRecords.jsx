import React, { useState, useEffect } from "react";
import API from "../services/api";
import {
  Coins,
  Search,
  RefreshCw,
  SlidersHorizontal,
  Target,
  Percent,
  Check,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Clock,
  Sparkles,
  TrendingUp,
  CircleDollarSign,
  Gift
} from "lucide-react";
import { useLanguageCurrency } from "../context/LanguageCurrencyContext";

export default function PointsMembershipRecords() {
  const { formatCurrency } = useLanguageCurrency();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("points");
  
  const [pointsTarget, setPointsTarget] = useState(100);
  const [pointsSpendAmount, setPointsSpendAmount] = useState(100);
  const [pointsPerUnit, setPointsPerUnit] = useState(5);
  const [pointsDiscountPercentage, setPointsDiscountPercentage] = useState(5);

  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Adjust Points Modal State
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [newPoints, setNewPoints] = useState(0);
  const [adjusting, setAdjusting] = useState(false);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const activeBranchId = user.branch_id || null;

  useEffect(() => {
    fetchRecords();
  }, [page, sortBy, search, statusFilter]);

  const fetchRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await API.get("/visit-membership/points-customer-records", {
        params: {
          branch_id: activeBranchId,
          search: search,
          status: statusFilter,
          sort: sortBy,
          page: page,
          limit: limit,
        },
      });
      const data = res.data || res;
      setRecords(data.items || []);
      setTotal(data.total || 0);
      if (data.points_target !== undefined && data.points_target !== null) setPointsTarget(data.points_target);
      if (data.points_spend_amount !== undefined && data.points_spend_amount !== null) setPointsSpendAmount(data.points_spend_amount);
      if (data.points_per_unit !== undefined && data.points_per_unit !== null) setPointsPerUnit(data.points_per_unit);
      if (data.points_discount_percentage !== undefined && data.points_discount_percentage !== null) setPointsDiscountPercentage(data.points_discount_percentage);
    } catch (err) {
      setError(err.message || "Failed to load customer points records.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdjustModal = (record) => {
    setSelectedRecord(record);
    setNewPoints(record.current_points);
  };

  const handleConfirmAdjust = async (e) => {
    e.preventDefault();
    if (!selectedRecord) return;

    setAdjusting(true);
    setError(null);
    try {
      await API.post("/visit-membership/points-adjust", {
        customer_id: selectedRecord.customer_id,
        branch_id: activeBranchId,
        new_points: parseFloat(newPoints) || 0,
      });

      setSuccessMsg(`Updated points balance for ${selectedRecord.customer_name} to ${newPoints} points!`);
      setTimeout(() => setSuccessMsg(null), 4000);
      setSelectedRecord(null);
      fetchRecords();
    } catch (err) {
      setError(err.message || "Failed to update points.");
    } finally {
      setAdjusting(false);
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

  // Compute stat metrics
  const targetReachedCount = records.filter((r) => r.is_target_reached).length;
  const inProgressCount = records.filter((r) => r.current_points > 0 && !r.is_target_reached).length;
  const totalPointsAccumulated = records.reduce((sum, r) => sum + (r.current_points || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-surface border border-border-soft p-4 sm:p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-amber-500/10 text-amber-600 rounded-xl">
              <Coins className="w-5 h-5" />
            </span>
            <h3 className="text-sm font-extrabold text-slate-900">
              Points-Based Customer Loyalty & Rewards
            </h3>
            <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
              Type C Active
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Rule: Every <strong className="text-slate-800">₹{pointsSpendAmount}</strong> spend gives <strong className="text-amber-700">{pointsPerUnit} points</strong>. Hitting <strong className="text-emerald-700">{pointsTarget} points</strong> unlocks <strong className="text-rose-600">{pointsDiscountPercentage}% Off</strong> during POS checkout.
          </p>
        </div>

        <button
          onClick={fetchRecords}
          disabled={loading}
          className="flex items-center space-x-1.5 px-3.5 py-2 bg-background hover:bg-slate-100 border border-border-soft text-slate-700 rounded-xl text-xs font-bold transition shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-primary" : ""}`} />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-surface border border-border-soft p-4 rounded-xl flex items-center space-x-3 shadow-2xs">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 font-bold">Total Clients</p>
            <p className="text-lg font-black text-slate-900">{total}</p>
          </div>
        </div>

        <div className="bg-surface border border-border-soft p-4 rounded-xl flex items-center space-x-3 shadow-2xs">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl shrink-0">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 font-bold">Active Points Balance</p>
            <p className="text-lg font-black text-amber-600">{Math.round(totalPointsAccumulated)} pts</p>
          </div>
        </div>

        <div className="bg-surface border border-border-soft p-4 rounded-xl flex items-center space-x-3 shadow-2xs">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 font-bold">Target Reached ({pointsDiscountPercentage}% Ready)</p>
            <p className="text-lg font-black text-emerald-600">{targetReachedCount}</p>
          </div>
        </div>

        <div className="bg-surface border border-border-soft p-4 rounded-xl flex items-center space-x-3 shadow-2xs">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 font-bold">In Progress</p>
            <p className="text-lg font-black text-purple-600">{inProgressCount}</p>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold flex items-center space-x-2 animate-fade-in">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-surface border border-border-soft p-4 rounded-2xl flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search clients by name or mobile number..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-background border border-border-soft pl-9 pr-4 py-2 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-primary font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-background border border-border-soft px-3 py-2 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="all">All Clients</option>
            <option value="target_reached">🎯 Target Reached ({pointsDiscountPercentage}% Ready)</option>
            <option value="in_progress">In Progress</option>
          </select>

          {/* Sort Filter */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-background border border-border-soft px-3 py-2 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="points">Sort by: Highest Points</option>
            <option value="last_transaction">Sort by: Last Transaction</option>
            <option value="name">Sort by: Name (A-Z)</option>
            <option value="redemptions">Sort by: Total Redemptions</option>
          </select>
        </div>
      </div>

      {/* Customer Points Records Table */}
      <div className="bg-surface border border-border-soft rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[750px]">
            <thead>
              <tr className="bg-slate-50/80 border-b border-border-soft text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Client Name & Contact</th>
                <th className="py-3.5 px-4">Points Balance</th>
                <th className="py-3.5 px-4">Progress to Target</th>
                <th className="py-3.5 px-4">Reward Status</th>
                <th className="py-3.5 px-4">Total Redemptions</th>
                <th className="py-3.5 px-4">Last Activity</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft/60 text-xs">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400 font-medium">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading Points Loyalty Records...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400 font-medium">
                    No clients found matching your search.
                  </td>
                </tr>
              ) : (
                records.map((r) => {
                  const pct = Math.min(100, Math.round((r.current_points / pointsTarget) * 100));
                  return (
                    <tr key={r.customer_id} className="hover:bg-slate-50/70 transition">
                      {/* Name & Phone */}
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-slate-900">{r.customer_name}</div>
                        <div className="text-[11px] text-slate-500 font-medium">{r.phone}</div>
                      </td>

                      {/* Points Balance */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-1.5 font-black text-slate-900 text-sm">
                          <Coins className="w-4 h-4 text-amber-500" />
                          <span>{r.current_points}</span>
                          <span className="text-[10px] text-slate-400 font-normal">/ {pointsTarget} pts</span>
                        </div>
                      </td>

                      {/* Progress Bar */}
                      <td className="py-3.5 px-4 w-48">
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[10px] font-bold">
                            <span className={r.is_target_reached ? "text-emerald-700" : "text-slate-600"}>
                              {pct}%
                            </span>
                            <span className="text-slate-400 font-normal">
                              {r.is_target_reached ? "Target Met!" : `${Math.max(0, pointsTarget - r.current_points)} pts needed`}
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                r.is_target_reached
                                  ? "bg-gradient-to-r from-emerald-500 to-emerald-600 animate-pulse"
                                  : "bg-gradient-to-r from-amber-400 to-amber-500"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {r.is_target_reached ? (
                          <span className="inline-flex items-center space-x-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-[11px] font-extrabold shadow-2xs">
                            <Percent className="w-3 h-3" />
                            <span>{pointsDiscountPercentage}% Off Ready</span>
                          </span>
                        ) : r.current_points > 0 ? (
                          <span className="inline-flex items-center bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full text-[11px] font-bold">
                            In Progress
                          </span>
                        ) : (
                          <span className="inline-flex items-center bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-full text-[11px] font-medium">
                            New Client
                          </span>
                        )}
                      </td>

                      {/* Redemptions */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{r.total_redemptions || 0} times</div>
                        {r.total_discount_amount_claimed > 0 && (
                          <div className="text-[10px] text-emerald-600 font-medium">
                            Saved {formatCurrency(r.total_discount_amount_claimed)}
                          </div>
                        )}
                      </td>

                      {/* Last Activity */}
                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{formatDate(r.last_transaction_date)}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleOpenAdjustModal(r)}
                          className="px-3 py-1.5 bg-background hover:bg-slate-100 border border-border-soft text-slate-700 hover:text-primary rounded-xl text-xs font-bold transition flex items-center space-x-1 ml-auto"
                        >
                          <SlidersHorizontal className="w-3 h-3" />
                          <span>Adjust</span>
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
        <div className="p-4 bg-slate-50/50 border-t border-border-soft flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-bold text-slate-600">
          <div>
            Showing {records.length} of {total} total clients
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-1.5 bg-white border border-border-soft rounded-lg hover:bg-slate-100 disabled:opacity-40 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="p-1.5 bg-white border border-border-soft rounded-lg hover:bg-slate-100 disabled:opacity-40 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Manual Adjust Points Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center space-x-3 text-amber-600 border-b border-slate-100 pb-3">
              <div className="p-2.5 bg-amber-100 rounded-xl">
                <Coins className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-900">Adjust Customer Points</h4>
                <p className="text-xs text-slate-500 font-medium">{selectedRecord.customer_name} ({selectedRecord.phone})</p>
              </div>
            </div>

            <form onSubmit={handleConfirmAdjust} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  New Points Balance (Current: {selectedRecord.current_points} pts) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={newPoints}
                  onChange={(e) => setNewPoints(e.target.value)}
                  className="w-full bg-slate-50 border border-border-soft px-3.5 py-2.5 rounded-xl text-xs font-extrabold text-slate-900 focus:outline-none focus:border-primary focus:bg-white"
                  required
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 space-y-1">
                <p className="font-bold">🎯 Target Points: {pointsTarget} pts</p>
                <p>If set to ≥ {pointsTarget} pts, this customer will immediately unlock {pointsDiscountPercentage}% off on their next salon checkout.</p>
              </div>

              <div className="flex justify-end space-x-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjusting}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-extrabold shadow-md shadow-pink-500/20 transition disabled:opacity-50"
                >
                  {adjusting ? "Saving..." : "Save Points Balance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
