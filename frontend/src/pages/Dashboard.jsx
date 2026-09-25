import React, { useState, useEffect } from "react";
import API from "../services/api";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { AlertTriangle, Clock, Calendar, UserCheck, CheckCircle, QrCode, Sparkles, ArrowRight, Award, Target, TrendingUp } from "lucide-react";
import { useLanguageCurrency } from "../context/LanguageCurrencyContext";
import { useTheme } from "../context/ThemeContext";

function Dashboard() {
  const { formatCurrency, t } = useLanguageCurrency();
  const { getChartColors } = useTheme();
  const chartColors = getChartColors();
  const COLORS = [chartColors.primary, chartColors.secondary, chartColors.tertiary, chartColors.quaternary, chartColors.quinary];

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isEmployee = user?.role === "Employee";

  const [summary, setSummary] = useState(null);
  const [charts, setCharts] = useState(null);
  const [activities, setActivities] = useState(null);
  const [employeeAttendance, setEmployeeAttendance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [range, setRange] = useState(7);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchDashboardData = () => {
    setLoading(true);
    let chartUrl = `/dashboard/charts?range=${range}`;
    if (startDate && endDate) {
      chartUrl = `/dashboard/charts?start_date=${startDate}&end_date=${endDate}`;
    }

    const requests = [
      API.get("/dashboard/summary"),
      API.get(chartUrl),
      API.get("/dashboard/activities"),
    ];

    if (isEmployee) {
      requests.push(API.get("/attendance?limit=10").catch(() => ({ data: { items: [] } })));
    }

    Promise.all(requests)
      .then(([sumRes, chartRes, actRes, attRes]) => {
        setSummary(sumRes.data);
        setCharts(chartRes.data);
        setActivities(actRes.data);
        if (attRes) {
          setEmployeeAttendance(attRes.data?.items || attRes.data || []);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load analytics dashboard.");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchDashboardData();
  }, [range, startDate, endDate]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-border-soft rounded animate-pulse w-1/4"></div>
        <div className="grid grid-cols-4 gap-6">
          <div className="h-28 bg-surface border border-border-soft rounded-lg animate-pulse"></div>
          <div className="h-28 bg-surface border border-border-soft rounded-lg animate-pulse"></div>
          <div className="h-28 bg-surface border border-border-soft rounded-lg animate-pulse"></div>
          <div className="h-28 bg-surface border border-border-soft rounded-lg animate-pulse"></div>
        </div>
        <div className="h-64 bg-surface border border-border-soft rounded-lg animate-pulse"></div>
      </div>
    );
  }

  if (error) {
    return <div className="p-8 text-center text-danger text-sm font-medium">{error}</div>;
  }

  // EMPLOYEE SPECIFIC OVERVIEW DASHBOARD
  if (isEmployee) {
    const todayLog = (employeeAttendance || []).find((item) => {
      if (!item.timestamp && !item.created_at) return false;
      const logDate = new Date(item.timestamp || item.created_at).toDateString();
      return logDate === new Date().toDateString();
    });

    return (
      <div className="space-y-8 pb-12">
        {/* Welcome Banner */}
        <div className="glowe-glass-card p-6 rounded-3xl glowe-glow-shadow border border-pink-200/80 bg-gradient-to-r from-pink-500/10 via-rose-500/5 to-purple-500/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-pink-600 animate-pulse" />
              <h1 className="text-xl font-extrabold text-slate-900">
                Welcome back, {user?.email?.split("@")[0] || "Staff Member"}!
              </h1>
            </div>
            <p className="text-xs font-semibold text-slate-600 mt-1">
              Employee Portal Overview • View your shift status, personal service performance, and attendance log.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/attendance/checkin?branch_id=1"
              target="_blank"
              rel="noreferrer"
              className="glowe-pink-gradient text-white px-4 py-2.5 rounded-2xl text-xs font-extrabold shadow-md flex items-center space-x-2 hover:opacity-95 transition"
            >
              <QrCode className="w-4 h-4" />
              <span>QR Check-In / Out</span>
            </a>
          </div>
        </div>

        {/* Employee Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: Attendance Status */}
          <div className="glowe-glass-card p-6 rounded-2xl glowe-glow-shadow flex flex-col justify-between" style={{ boxShadow: "0 8px 24px rgba(255, 117, 143, 0.2)" }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-pink-600 uppercase tracking-wider">Today's Shift Status</p>
              <UserCheck className="w-5 h-5 text-pink-500" />
            </div>
            <p className="text-xl font-black text-slate-900 mt-3">
              {todayLog
                ? todayLog.check_out_time
                  ? "Checked Out ✅"
                  : "Checked In 🟢"
                : "Not Checked In Yet"}
            </p>
            <p className="text-[11px] font-semibold text-slate-500 mt-2">
              {todayLog
                ? `In: ${todayLog.checkin_time || todayLog.timestamp || "Logged"}`
                : "Scan Reception QR code to check-in"}
            </p>
          </div>

          {/* Card 2: Services Completed This Month */}
          <div className="glowe-glass-card p-6 rounded-2xl glowe-glow-shadow flex flex-col justify-between" style={{ boxShadow: "0 8px 24px rgba(16, 185, 129, 0.15)" }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Services This Month</p>
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-2xl font-black text-slate-900 mt-3">
              {summary?.invoices?.this_month || 0}
            </p>
            <p className="text-[11px] font-semibold text-slate-500 mt-2">Total parlour services logged</p>
          </div>

          {/* Card 3: Attendance Record Count */}
          <div className="glowe-glass-card p-6 rounded-2xl glowe-glow-shadow flex flex-col justify-between" style={{ boxShadow: "0 8px 24px rgba(245, 158, 11, 0.15)" }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Attendance Logs</p>
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-2xl font-black text-slate-900 mt-3">
              {(employeeAttendance || []).length} Logs
            </p>
            <p className="text-[11px] font-semibold text-slate-500 mt-2">Past check-in & out history</p>
          </div>
        </div>

        {/* Employee Recent Attendance Logs Card */}
        <div className="glowe-glass-card p-6 rounded-3xl glowe-glow-shadow space-y-4 border border-pink-100 max-w-3xl">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
              <Clock className="w-4 h-4 text-pink-600" />
              <span>My Recent Attendance Logs</span>
            </h3>
          </div>

          {(!employeeAttendance || employeeAttendance.length === 0) ? (
            <div className="p-6 text-center text-xs font-semibold text-slate-500 bg-pink-50/50 rounded-2xl border border-pink-100">
              No attendance logs found yet. Scan the reception QR code to check in!
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {employeeAttendance.slice(0, 5).map((log, idx) => (
                <div key={log.id || idx} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900">
                      {log.timestamp ? new Date(log.timestamp).toLocaleDateString() : "Today"}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {log.branch_name || "Main Branch"} • {log.checkin_method || "QR"}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                      log.status === "P" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}>
                      {log.status === "P" ? "Present" : log.status || "P"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Title & Filter Bar */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">{t("dashboard_overview")}</h1>
          <p className="text-xs text-text-secondary">Real-time revenue metrics, staff performance, and inventory health.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-1.5 text-xs">
            <span className="font-semibold text-text-secondary">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-surface border border-border-soft px-3 py-1 rounded-lg text-xs text-text-primary focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex items-center space-x-1.5 text-xs">
            <span className="font-semibold text-text-secondary">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-surface border border-border-soft px-3 py-1 rounded-lg text-xs text-text-primary focus:outline-none focus:border-primary"
            />
          </div>

          {(startDate || endDate) && (
            <button
              type="button"
              onClick={() => {
                setStartDate("");
                setEndDate("");
              }}
              className="text-xs text-rose-600 hover:text-rose-800 font-bold underline px-1"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Low Stock Banner Alert */}
      {summary?.low_stock_alerts?.length > 0 && (
        <div className="bg-warning/10 border border-warning/30 p-4 rounded-lg flex items-center justify-between">
          <div className="flex items-center space-x-3 text-warning">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <div>
              <p className="text-xs font-semibold">Low Stock Warning</p>
              <p className="text-[11px] text-text-secondary">
                {summary.low_stock_alerts.length} product(s) have fallen below reorder thresholds ({summary.low_stock_alerts.map((x) => x.name).join(", ")}).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="glowe-glass-card p-6 rounded-2xl glowe-glow-shadow flex flex-col justify-between" style={{ boxShadow: "0 8px 24px rgba(255, 117, 143, 0.2)" }}>
          <p className="text-xs font-bold text-pink-600 uppercase tracking-wider">Today's Revenue</p>
          <p className="text-2xl font-black text-text-primary mt-2 numeric">{formatCurrency(summary?.revenue?.today)}</p>
          <p className="text-[10px] text-success font-medium mt-2"><span className="numeric">▲ {summary?.invoices?.today}</span> Bills Processed</p>
        </div>

        <div className="glowe-glass-card p-6 rounded-2xl glowe-glow-shadow flex flex-col justify-between" style={{ boxShadow: "0 8px 24px rgba(99, 102, 241, 0.15)" }}>
          <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Weekly Revenue</p>
          <p className="text-2xl font-black text-text-primary mt-2 numeric">{formatCurrency(summary?.revenue?.weekly)}</p>
          <p className="text-[10px] text-text-secondary mt-2">Last <span className="numeric">7</span> Days Rolling</p>
        </div>

        <div className="glowe-glass-card p-6 rounded-2xl glowe-glow-shadow flex flex-col justify-between" style={{ boxShadow: "0 8px 24px rgba(16, 185, 129, 0.15)" }}>
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Monthly Revenue</p>
          <p className="text-2xl font-black text-text-primary mt-2 numeric">{formatCurrency(summary?.revenue?.monthly)}</p>
          <p className="text-[10px] text-text-secondary mt-2"><span className="numeric">{summary?.invoices?.this_month}</span> Bills This Month</p>
        </div>

        <div className="glowe-glass-card p-6 rounded-2xl glowe-glow-shadow flex flex-col justify-between" style={{ boxShadow: "0 8px 24px rgba(168, 85, 247, 0.15)" }}>
          <p className="text-xs font-bold text-purple-600 uppercase tracking-wider">Today's Attendance</p>
          <p className="text-2xl font-black text-text-primary mt-2"><span className="numeric">{summary?.attendance?.total_checked_in || 0}</span> Checked In</p>
          <p className="text-[10px] text-purple-700 font-medium mt-2">
            <span className="numeric">{summary?.attendance?.present || 0}</span> Present • <span className="numeric">{summary?.attendance?.half_day || 0}</span> Half-Day
          </p>
        </div>

        <div className="glowe-glass-card p-6 rounded-2xl glowe-glow-shadow flex flex-col justify-between" style={{ boxShadow: "0 8px 24px rgba(245, 158, 11, 0.15)" }}>
          <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">{t("active_customers")}</p>
          <p className="text-2xl font-black text-text-primary mt-2 numeric">{summary?.memberships?.active || 0}</p>
          <p className="text-[10px] text-warning font-medium mt-2"><span className="numeric">{summary?.memberships?.expiring_soon || 0}</span> Expiring Soon</p>
        </div>
      </div>

      {/* Top 3 Employee Target Performers Section */}
      <div className="glowe-glass-card p-6 rounded-3xl glowe-glow-shadow border border-pink-100/80 space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
              <Award className="w-5 h-5 text-amber-500 fill-amber-500" />
              <span>Top 3 Target Performers (This Month)</span>
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">Employees leading in sales target completion for the current month.</p>
          </div>
          <span className="text-xs font-bold text-pink-600 bg-pink-50 border border-pink-200 px-3 py-1 rounded-full">
            Monthly Target Tracking
          </span>
        </div>

        {(!summary?.top_performers || summary.top_performers.length === 0) ? (
          <div className="p-8 text-center text-xs font-semibold text-text-secondary bg-slate-50/50 rounded-2xl border border-slate-100">
            No employee target data available for this period.
          </div>
        ) : (
          <div className="flex flex-col space-y-4">
            {summary.top_performers.map((emp, idx) => {
              const ranks = [
                { badge: "🥇 Rank 1", color: "from-amber-400 to-yellow-500", text: "text-amber-700", border: "border-amber-300", bg: "bg-amber-50" },
                { badge: "🥈 Rank 2", color: "from-slate-300 to-slate-400", text: "text-slate-700", border: "border-slate-300", bg: "bg-slate-50" },
                { badge: "🥉 Rank 3", color: "from-amber-600 to-amber-700", text: "text-amber-900", border: "border-amber-200", bg: "bg-orange-50" }
              ];
              const rank = ranks[idx] || ranks[2];
              const pct = Math.min(100, Math.round(emp.percentage || 0));

              return (
                <div
                  key={emp.id || idx}
                  className={`p-4 md:p-5 rounded-2xl border ${rank.border} ${rank.bg} flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm hover:shadow-md transition`}
                >
                  <div className="flex items-center space-x-4 min-w-[200px]">
                    <span className="text-xs font-extrabold px-3 py-1.5 rounded-full bg-white text-slate-800 border border-slate-200 shadow-2xs shrink-0">
                      {rank.badge}
                    </span>
                    <div className="truncate">
                      <h4 className="text-base font-extrabold text-slate-900 truncate">{emp.name}</h4>
                      <p className="text-xs text-text-secondary font-medium">{emp.role || "Salon Staff"}</p>
                    </div>
                  </div>

                  {/* Progress Bar & Amounts stacked vertically in row */}
                  <div className="flex-1 w-full max-w-xl space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-slate-700">
                        Achieved: <strong className="text-emerald-600 numeric">{formatCurrency(emp.achieved)}</strong>
                        <span className="text-text-secondary font-normal mx-2">/</span>
                        Target: <strong className="numeric">{formatCurrency(emp.target)}</strong>
                      </span>
                      <span className={`text-xs font-black ${rank.text}`}>
                        {emp.percentage}% Achieved
                      </span>
                    </div>

                    <div className="w-full bg-white/80 rounded-full h-3 overflow-hidden border border-slate-200/60">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${rank.color} transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
