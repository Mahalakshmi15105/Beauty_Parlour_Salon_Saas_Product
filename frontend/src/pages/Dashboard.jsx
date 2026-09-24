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
import { AlertTriangle, Clock, Calendar, UserCheck, CheckCircle, QrCode, Sparkles, ArrowRight } from "lucide-react";
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

  const fetchDashboardData = () => {
    setLoading(true);
    const requests = [
      API.get("/dashboard/summary"),
      API.get(`/dashboard/charts?range=${range}`),
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
  }, [range]);

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
              Employee Portal Overview • View shift status, today's appointments, and attendance history.
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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

          {/* Card 2: Today's Appointments */}
          <div className="glowe-glass-card p-6 rounded-2xl glowe-glow-shadow flex flex-col justify-between" style={{ boxShadow: "0 8px 24px rgba(99, 102, 241, 0.15)" }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Today's Appointments</p>
              <Calendar className="w-5 h-5 text-indigo-500" />
            </div>
            <p className="text-2xl font-black text-slate-900 mt-3">
              {summary?.invoices?.today || 0}
            </p>
            <p className="text-[11px] font-semibold text-slate-500 mt-2">Scheduled client appointments</p>
          </div>

          {/* Card 3: Monthly Services Completed */}
          <div className="glowe-glass-card p-6 rounded-2xl glowe-glow-shadow flex flex-col justify-between" style={{ boxShadow: "0 8px 24px rgba(16, 185, 129, 0.15)" }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Services This Month</p>
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-2xl font-black text-slate-900 mt-3">
              {summary?.invoices?.this_month || 0}
            </p>
            <p className="text-[11px] font-semibold text-slate-500 mt-2">Treatments & services logged</p>
          </div>

          {/* Card 4: Attendance Record Count */}
          <div className="glowe-glass-card p-6 rounded-2xl glowe-glow-shadow flex flex-col justify-between" style={{ boxShadow: "0 8px 24px rgba(245, 158, 11, 0.15)" }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Attendance Logs</p>
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-2xl font-black text-slate-900 mt-3">
              {(employeeAttendance || []).length} Logs
            </p>
            <p className="text-[11px] font-semibold text-slate-500 mt-2">Past check-in history records</p>
          </div>
        </div>

        {/* Employee Activity Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Recent Attendance Logs Feed */}
          <div className="glowe-glass-card p-6 rounded-3xl glowe-glow-shadow space-y-4 border border-pink-100">
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

          {/* Today's Salon Activity Summary */}
          <div className="glowe-glass-card p-6 rounded-3xl glowe-glow-shadow space-y-4 border border-pink-100">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>Recent Salon Appointments</span>
            </h3>

            {activities?.recent_invoices?.length === 0 ? (
              <p className="text-xs text-slate-500 font-medium">No recent appointment activity.</p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {activities?.recent_invoices?.slice(0, 5).map((inv) => (
                  <div key={inv.id} className="py-3 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-slate-900">{inv.customer_name || "Client"}</p>
                      <p className="text-[10px] text-slate-500 font-medium">{inv.invoice_number}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        inv.status === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                      }`}>
                        {inv.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
        <div className="flex items-center space-x-3">
          <label className="text-xs text-text-secondary font-medium">Timeframe:</label>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="bg-surface border border-border-soft px-3 py-1.5 rounded-lg text-xs text-text-primary focus:outline-none"
          >
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
          </select>
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

      {/* Charts Row 1: Daily Revenue Trend & Top Services */}
      <div className="grid grid-cols-12 gap-8">
        {/* Daily Revenue Area Chart */}
        <div className="col-span-8 glowe-glass-card p-6 rounded-2xl glowe-glow-shadow space-y-4">
          <h3 className="text-sm font-bold text-text-primary">{t("revenue_chart")}</h3>
          <div className="h-64">
            {charts?.daily_trend?.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-text-secondary">No billing activity recorded in this period.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts?.daily_trend}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF758F" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#FF758F" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#FFE4E8" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => [formatCurrency(value), "Revenue"]} />
                  <Area type="monotone" dataKey="revenue" stroke="#FF758F" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Services Bar Chart */}
        <div className="col-span-4 glowe-glass-card p-6 rounded-2xl glowe-glow-shadow space-y-4">
          <h3 className="text-sm font-bold text-text-primary">Top Treatments by Sales</h3>
          <div className="h-64">
            {charts?.top_services?.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-text-secondary">No treatment data.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts?.top_services} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
                  <Tooltip formatter={(value) => [formatCurrency(value), "Revenue"]} />
                  <Bar dataKey="revenue" fill="#10B981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Activity Feeds */}
      <div className="grid grid-cols-2 gap-8">
        {/* Latest Checkout Invoices */}
        <div className="glowe-glass-card p-6 rounded-2xl glowe-glow-shadow space-y-4">
          <h3 className="text-sm font-bold text-text-primary">{t("pos_billing")}</h3>
          {activities?.recent_invoices?.length === 0 ? (
            <p className="text-xs text-text-secondary">No recent transactions.</p>
          ) : (
            <div className="divide-y divide-border-soft">
              {activities?.recent_invoices?.map((inv) => (
                <div key={inv.id} className="py-3 flex justify-between items-center text-xs">
                  <div>
                    <p className="font-semibold text-text-primary numeric">{inv.invoice_number}</p>
                    <p className="text-text-secondary">{inv.customer_name || "Walk-In Client"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-text-primary numeric">{formatCurrency(inv.total)}</p>
                    <span className={`text-[10px] font-medium ${
                      inv.status === "Paid" ? "text-success" : "text-danger"
                    }`}>{inv.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Latest Registered Customers */}
        <div className="glowe-glass-card p-6 rounded-2xl glowe-glow-shadow space-y-4">
          <h3 className="text-sm font-semibold text-text-primary">{t("recent_activities")}</h3>
          {activities?.recent_customers?.length === 0 ? (
            <p className="text-xs text-text-secondary">No new registrations.</p>
          ) : (
            <div className="divide-y divide-border-soft">
              {activities?.recent_customers?.map((cust) => (
                <div key={cust.id} className="py-3 flex justify-between items-center text-xs">
                  <div>
                    <p className="font-semibold text-text-primary">{cust.name}</p>
                    <p className="text-text-secondary">{cust.phone}</p>
                  </div>
                  <span className="text-text-secondary text-[10px]">
                    {new Date(cust.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
