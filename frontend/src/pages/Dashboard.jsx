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
import { AlertTriangle } from "lucide-react";
import { useLanguageCurrency } from "../context/LanguageCurrencyContext";
import { useTheme } from "../context/ThemeContext";

function Dashboard() {
  const { formatCurrency, t } = useLanguageCurrency();
  const { getChartColors } = useTheme();
  const chartColors = getChartColors();
  const COLORS = [chartColors.primary, chartColors.secondary, chartColors.tertiary, chartColors.quaternary, chartColors.quinary];

  const [summary, setSummary] = useState(null);
  const [charts, setCharts] = useState(null);
  const [activities, setActivities] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [range, setRange] = useState(7);

  const fetchDashboardData = () => {
    setLoading(true);
    Promise.all([
      API.get("/dashboard/summary"),
      API.get(`/dashboard/charts?range=${range}`),
      API.get("/dashboard/activities"),
    ])
      .then(([sumRes, chartRes, actRes]) => {
        setSummary(sumRes.data);
        setCharts(chartRes.data);
        setActivities(actRes.data);
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
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-surface border border-border-soft p-6 rounded-lg shadow-sm flex flex-col justify-between">
          <p className="text-xs font-semibold text-text-secondary uppercase">Today's Revenue</p>
          <p className="text-2xl font-bold text-text-primary mt-2">{formatCurrency(summary?.revenue?.today)}</p>
          <p className="text-[10px] text-success font-medium mt-2">▲ {summary?.invoices?.today} Bills Processed</p>
        </div>

        <div className="bg-surface border border-border-soft p-6 rounded-lg shadow-sm flex flex-col justify-between">
          <p className="text-xs font-semibold text-text-secondary uppercase">Weekly Revenue</p>
          <p className="text-2xl font-bold text-text-primary mt-2">{formatCurrency(summary?.revenue?.weekly)}</p>
          <p className="text-[10px] text-text-secondary mt-2">Last 7 Days Rolling</p>
        </div>

        <div className="bg-surface border border-border-soft p-6 rounded-lg shadow-sm flex flex-col justify-between">
          <p className="text-xs font-semibold text-text-secondary uppercase">Monthly Revenue</p>
          <p className="text-2xl font-bold text-text-primary mt-2">{formatCurrency(summary?.revenue?.monthly)}</p>
          <p className="text-[10px] text-text-secondary mt-2">{summary?.invoices?.this_month} Bills This Month</p>
        </div>

        <div className="bg-surface border border-border-soft p-6 rounded-lg shadow-sm flex flex-col justify-between">
          <p className="text-xs font-semibold text-text-secondary uppercase">{t("active_customers")}</p>
          <p className="text-2xl font-bold text-text-primary mt-2">{summary?.memberships?.active}</p>
          <p className="text-[10px] text-warning font-medium mt-2">{summary?.memberships?.expiring_soon} Expiring Soon</p>
        </div>
      </div>

      {/* Charts Row 1: Daily Revenue Trend & Top Services */}
      <div className="grid grid-cols-12 gap-8">
        {/* Daily Revenue Area Chart */}
        <div className="col-span-8 bg-surface border border-border-soft p-6 rounded-lg shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-text-primary">{t("revenue_chart")}</h3>
          <div className="h-64">
            {charts?.daily_trend?.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-text-secondary">No billing activity recorded in this period.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts?.daily_trend}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => [formatCurrency(value), "Revenue"]} />
                  <Area type="monotone" dataKey="revenue" stroke="#7C3AED" fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Services Bar Chart */}
        <div className="col-span-4 bg-surface border border-border-soft p-6 rounded-lg shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-text-primary">Top Treatments by Sales</h3>
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
        <div className="bg-surface border border-border-soft p-6 rounded-lg shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-text-primary">{t("pos_billing")}</h3>
          {activities?.recent_invoices?.length === 0 ? (
            <p className="text-xs text-text-secondary">No recent transactions.</p>
          ) : (
            <div className="divide-y divide-border-soft">
              {activities?.recent_invoices?.map((inv) => (
                <div key={inv.id} className="py-3 flex justify-between items-center text-xs">
                  <div>
                    <p className="font-semibold text-text-primary">{inv.invoice_number}</p>
                    <p className="text-text-secondary">{inv.customer_name || "Walk-In Client"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-text-primary">{formatCurrency(inv.total)}</p>
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
        <div className="bg-surface border border-border-soft p-6 rounded-lg shadow-sm space-y-4">
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
