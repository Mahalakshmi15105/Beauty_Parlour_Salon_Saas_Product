import React, { useState, useEffect } from "react";
import API from "../services/api";
import { useToast } from "../context/ToastContext";
import { useLanguageCurrency } from "../context/LanguageCurrencyContext";
import { useTheme } from "../context/ThemeContext";
import { exportToCSV, printDataList, exportToPDF, exportToExcel } from "../utils/exportUtils";
import * as XLSX from "xlsx";
import { 
  Printer, 
  FileSpreadsheet, 
  FileText, 
  TrendingUp, 
  Percent, 
  Users, 
  Boxes, 
  ShoppingCart, 
  Award,
  Calendar,
  AlertCircle,
  FileCheck,
  UserCheck,
  DollarSign
} from "lucide-react";

function Reports() {
  const { showSuccess, showError } = useToast();
  const { formatCurrency, currencySymbol, t } = useLanguageCurrency();
  const { getChartColors } = useTheme();

  // Active Report Types: "daily_sales_statement", "monthly_staff_performance", "attendance_salary", "sales", "tax", "employees", "products", "procurement", "memberships"
  const [reportType, setReportType] = useState("daily_sales_statement");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [preset, setPreset] = useState("30days");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchReport = () => {
    setLoading(true);
    setError(null);
    setReportData(null);
    
    let url = "";
    if (reportType === "daily_sales_statement") {
      url = `/reports/daily-sales-statement?date=${selectedDate}`;
    } else if (reportType === "monthly_staff_performance") {
      url = `/reports/monthly-performance-staff?month=${selectedMonth}&year=${selectedYear}`;
    } else if (reportType === "attendance_salary") {
      url = `/reports/attendance-salary-report?month=${selectedMonth}&year=${selectedYear}`;
    } else {
      url = `/reports/${reportType}?preset=${preset}`;
      if (preset === "custom" && startDate && endDate) {
        url = `/reports/${reportType}?start_date=${startDate}&end_date=${endDate}`;
      }
    }

    API.get(url)
      .then((res) => {
        setReportData(res.data || null);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load report data.");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, selectedDate, selectedMonth, selectedYear, preset]);

  // Excel Export Handler for 3 New Reports + Standard Reports
  const handleExportCustomExcel = () => {
    if (!reportData) return showError("No report data available to export.");

    const wb = XLSX.utils.book_new();

    if (reportType === "daily_sales_statement") {
      const d = reportData;
      const wsData = [
        [d.parlour_name || "SALON"],
        [d.branch_name || "PARLOUR BRANCH"],
        ["DAILY SALES STATEMENT"],
        ["DATE", d.date_str || "", "DAY", d.day_name || ""],
        [],
        ["S.NO", "SERVICE", "STAFF", "AMT", "GST", "CASH", "PAYTM", "CARD", "M/C", "TOTAL", "", "EXPENSES", "AMOUNT"],
      ];

      const lineItems = d.line_items || [];
      const expenses = d.expenses || [];
      const maxRows = Math.max(lineItems.length, expenses.length, 15);

      for (let i = 0; i < maxRows; i++) {
        const item = lineItems[i] || {};
        const exp = expenses[i] || {};
        wsData.push([
          item.sno || (i < lineItems.length ? i + 1 : ""),
          item.service || "",
          item.staff || "",
          item.amt !== undefined ? item.amt : "",
          item.gst !== undefined ? item.gst : "",
          item.cash !== undefined ? item.cash : "",
          item.paytm !== undefined ? item.paytm : "",
          item.card !== undefined ? item.card : "",
          item.mc !== undefined ? item.mc : "",
          item.total !== undefined ? item.total : "",
          "",
          exp.note || (i === 0 ? "No Expenses" : ""),
          exp.amount !== undefined ? exp.amount : ""
        ]);
      }

      wsData.push(["TOTAL", "", "", d.totals?.amt || 0, d.totals?.gst || 0, d.totals?.cash || 0, d.totals?.paytm || 0, d.totals?.card || 0, 0, d.totals?.total || 0, "", "TOTAL EXPENSES", d.total_expenses || 0]);
      wsData.push([]);
      wsData.push(["", "", "", "", "", "", "", "", "", "", "", "OPENING BAL :", d.balance?.opening_bal || 130]);
      wsData.push(["STAFF NAME", "ACHIEVED", "", "", "", "", "", "", "", "", "", "* TOTAL SALE", d.balance?.total_sale || 0]);
      
      const staffList = d.staff_achieved || [];
      const denomKeys = ["500", "200", "100", "50", "20", "10", "5", "2", "1"];
      const cd = d.cash_denomination || {};

      wsData.push([staffList[0]?.staff_name || "-", staffList[0]?.achieved || 0, "", "", "", "", "", "", "", "", "", "* CASH PAY", d.balance?.cash_pay || 0]);
      wsData.push([staffList[1]?.staff_name || "-", staffList[1]?.achieved || 0, "", "", "", "", "", "", "", "", "", "* PHONE PAY", d.balance?.phone_pay || 0]);
      wsData.push([staffList[2]?.staff_name || "-", staffList[2]?.achieved || 0, "", "", "", "", "", "", "", "", "", "* CARD", d.balance?.card || 0]);
      wsData.push([staffList[3]?.staff_name || "-", staffList[3]?.achieved || 0, "", "", "", "", "", "", "", "", "", "* EXPENCE", d.balance?.expense || 0]);
      wsData.push([staffList[4]?.staff_name || "-", staffList[4]?.achieved || 0, "", "", "", "", "", "", "", "", "", "CLOSING BAL", d.balance?.closing_bal || 0]);

      wsData.push([]);
      wsData.push(["CASH DENOMINATION"]);
      denomKeys.forEach((k) => {
        const cnt = cd[k] || 0;
        const sub = parseInt(k, 10) * cnt;
        wsData.push([`₹ ${k}`, cnt, sub]);
      });
      wsData.push(["CASH DENOMINATION TOTAL", "", cd.total || 0]);

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "Daily Sales Statement");
      XLSX.writeFile(wb, `Daily_Sales_Statement_${d.date_str || "today"}.xlsx`);
    } else if (reportType === "monthly_staff_performance") {
      const d = reportData;
      const wsData = [
        [`MONTHLY PERFORMANCE STAFF - ${d.month_year || ""}`],
        ["S.NO", "NAME", "LEVEL", "SALARY", "TARGET", "ACHIEVED", "WITH GST", "WALKIN", "ABV", "%", "REVIEW", "M/C"]
      ];

      (d.staff_performance || []).forEach((row) => {
        wsData.push([
          row.sno,
          row.name,
          row.level,
          row.salary,
          row.target,
          row.achieved,
          row.with_gst,
          row.walkin,
          row.abv.toFixed(2),
          row.percentage.toFixed(1),
          row.review,
          row.mc
        ]);
      });

      wsData.push(["", "", "", "", "TOTAL", d.totals?.achieved || 0, d.totals?.with_gst || 0, d.totals?.walkin || 0, "", "", 0, 0]);
      wsData.push([]);
      wsData.push(["SALON SALES", d.summary?.salon_sales?.sales || 0, "", "MALE SALES", d.summary?.male_sales?.sales || 0, "", "FEMALE SALES", d.summary?.female_sales?.sales || 0]);
      wsData.push(["WALK IN", d.summary?.salon_sales?.walkin || 0, "", "WALK IN", d.summary?.male_sales?.walkin || 0, "", "WALK IN", d.summary?.female_sales?.walkin || 0]);
      wsData.push(["ABV", (d.summary?.salon_sales?.abv || 0).toFixed(2), "", "ABV", (d.summary?.male_sales?.abv || 0).toFixed(2), "", "ABV", (d.summary?.female_sales?.abv || 0).toFixed(2)]);
      wsData.push(["WITH GST", d.summary?.salon_sales?.with_gst || 0]);

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "Staff Performance");
      XLSX.writeFile(wb, `Monthly_Staff_Performance_${d.month_year || "report"}.xlsx`);
    } else if (reportType === "attendance_salary") {
      const d = reportData;
      const days = d.days_in_month || [];
      const headerRow = ["S.NO", "NAME", ...days.map((day) => `Day ${day.day}`), "TOTAL DAYS", "", "S.NO", "NAME", "SALARY", "TARGET", "ACHIEVED", "OFF", "TOTAL DAYS", "NET", "ADVANCE", "LESS AMOUNT", "AMOUNT"];

      const wsData = [
        [`ATTENDANCE & SALARY REPORT - ${d.month_year || ""}`],
        headerRow
      ];

      const attList = d.attendance_matrix || [];
      const salList = d.salary_report || [];
      const maxRows = Math.max(attList.length, salList.length);

      for (let i = 0; i < maxRows; i++) {
        const att = attList[i] || {};
        const sal = salList[i] || {};

        const dayCells = days.map((day) => (att.days ? att.days[String(day.day)] || "1" : ""));

        wsData.push([
          att.sno || "",
          att.name || "",
          ...dayCells,
          att.total_days !== undefined ? att.total_days : "",
          "",
          sal.sno || "",
          sal.name || "",
          sal.salary !== undefined ? sal.salary : "",
          sal.target !== undefined ? sal.target : "",
          sal.achieved !== undefined ? sal.achieved : "",
          sal.off !== undefined ? sal.off : "",
          sal.total_days !== undefined ? sal.total_days : "",
          sal.net !== undefined ? sal.net.toFixed(2) : "",
          sal.advance !== undefined ? sal.advance : "",
          sal.less_amount !== undefined ? sal.less_amount : "",
          sal.amount !== undefined ? sal.amount.toFixed(2) : ""
        ]);
      }

      wsData.push(["", "", ...days.map(() => ""), "", "", "", "TOTAL", d.totals?.salary || 0, d.totals?.target || 0, d.totals?.achieved || 0, "", "", d.totals?.net?.toFixed(2) || 0, d.totals?.advance || 0, d.totals?.less_amount || 0, d.totals?.amount?.toFixed(2) || 0]);

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "Attendance & Salary");
      XLSX.writeFile(wb, `Attendance_Salary_Report_${d.month_year || "report"}.xlsx`);
    } else {
      // Standard reports fallback
      const dataArr = Array.isArray(reportData) ? reportData : (reportData.items || []);
      const ws = XLSX.utils.json_to_sheet(dataArr);
      XLSX.utils.book_append_sheet(wb, ws, "Report");
      XLSX.writeFile(wb, `${reportType}_report.xlsx`);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Salon Analytics & Operational Reports</h1>
          <p className="text-xs text-slate-500 font-medium">Daily Sales Statements, Staff Performance, Attendance & Salary Reports, and Ledger Exports.</p>
        </div>
      </div>

      {/* Selector & Actions */}
      <div className="bg-white/80 backdrop-blur-md border border-pink-100/60 p-4 rounded-2xl flex flex-wrap gap-4 justify-between items-center shadow-xs">
        {/* Date / Month Filter Controls */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <Calendar className="w-4 h-4 text-pink-600" />
          
          {reportType === "daily_sales_statement" ? (
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-700">Select Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-white border border-pink-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-pink-500"
              />
            </div>
          ) : (reportType === "monthly_staff_performance" || reportType === "attendance_salary") ? (
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-700">Month & Year:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                className="bg-white border border-pink-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-pink-500"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {new Date(2026, m - 1, 1).toLocaleString("default", { month: "long" })}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                className="bg-white border border-pink-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-pink-500"
              >
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
              </select>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-700">Billing Period:</span>
              <select
                value={preset}
                onChange={(e) => setPreset(e.target.value)}
                className="bg-white border border-pink-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-pink-500"
              >
                <option value="today">Today</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
              </select>
            </div>
          )}
        </div>

        {/* Excel Export Button */}
        <button
          onClick={handleExportCustomExcel}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-2 transition shadow-md"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Download Excel</span>
        </button>
      </div>

      {/* Segmented Sub-Tabs */}
      <div className="flex flex-wrap gap-2 bg-white/60 backdrop-blur-md border border-pink-100/60 p-2.5 rounded-2xl shadow-xs">
        {[
          { id: "daily_sales_statement", label: "Daily Sales Statement", icon: FileCheck },
          { id: "monthly_staff_performance", label: "Monthly Performance - Staff", icon: UserCheck },
          { id: "attendance_salary", label: "Attendance & Salary Report", icon: DollarSign },
          { id: "sales", label: "Financial Ledger", icon: TrendingUp },
          { id: "tax", label: "Tax Reconciliation", icon: Percent },
          { id: "employees", label: "Staff Commissions", icon: Users },
          { id: "products", label: "Product Performance", icon: Boxes },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setReportType(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center space-x-2 ${
                reportType === tab.id
                  ? "glowe-pink-gradient text-white shadow-md"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Display Canvas */}
      <div className="bg-white/80 backdrop-blur-md border border-pink-100/60 rounded-3xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-16 text-center space-y-4">
            <div className="w-8 h-8 border-4 border-pink-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-slate-500 font-bold">Compiling salon ledger statistics...</p>
          </div>
        ) : error ? (
          <div className="p-16 text-center text-rose-600 text-sm font-semibold flex flex-col items-center space-y-2">
            <AlertCircle className="w-8 h-8" />
            <span>{error}</span>
          </div>
        ) : !reportData ? (
          <div className="p-16 text-center text-xs text-slate-500">No report records found.</div>
        ) : (
          <>
            {/* 1. DAILY SALES STATEMENT */}
            {reportType === "daily_sales_statement" && (
              <div className="p-6 space-y-6">
                {/* Red Header Bar */}
                <div className="bg-rose-600 text-white p-4 rounded-2xl text-center shadow-md space-y-1">
                  <h2 className="text-lg font-black tracking-wider uppercase">{reportData.parlour_name || "SALON"}</h2>
                  <p className="text-xs font-bold tracking-widest text-rose-100 uppercase">{reportData.branch_name || "BRANCH"}</p>
                </div>

                {/* Green Bar */}
                <div className="bg-emerald-600 text-white py-2 px-4 rounded-xl flex justify-between items-center text-xs font-black tracking-widest uppercase">
                  <span>DAILY SALES STATEMENT</span>
                  <span>DATE: {reportData.date_str} ({reportData.day_name})</span>
                </div>

                {/* Side-by-side Tables */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left: Invoice Line Items */}
                  <div className="lg:col-span-8 border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-amber-300 text-slate-900 border-b border-amber-400 font-extrabold uppercase">
                          <th className="p-2 text-center">S.NO</th>
                          <th className="p-2">SERVICE</th>
                          <th className="p-2">STAFF</th>
                          <th className="p-2 text-right">AMT</th>
                          <th className="p-2 text-right">GST</th>
                          <th className="p-2 text-right">CASH</th>
                          <th className="p-2 text-right">PAYTM</th>
                          <th className="p-2 text-right">CARD</th>
                          <th className="p-2 text-right">TOTAL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                        {(reportData.line_items || []).length === 0 ? (
                          <tr><td colSpan="9" className="p-6 text-center text-slate-400">No sales transactions logged for this date.</td></tr>
                        ) : (
                          (reportData.line_items || []).map((row) => (
                            <tr key={row.sno} className="hover:bg-slate-50">
                              <td className="p-2 text-center font-bold text-slate-400">{row.sno}</td>
                              <td className="p-2 font-bold text-slate-900">{row.service}</td>
                              <td className="p-2">{row.staff}</td>
                              <td className="p-2 text-right">₹{row.amt}</td>
                              <td className="p-2 text-right">₹{row.gst}</td>
                              <td className="p-2 text-right">₹{row.cash}</td>
                              <td className="p-2 text-right">₹{row.paytm}</td>
                              <td className="p-2 text-right">₹{row.card}</td>
                              <td className="p-2 text-right font-black text-slate-900">₹{row.total}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot className="bg-amber-300 text-slate-900 font-black">
                        <tr>
                          <td colSpan="3" className="p-2 uppercase">TOTAL</td>
                          <td className="p-2 text-right">₹{reportData.totals?.amt}</td>
                          <td className="p-2 text-right">₹{reportData.totals?.gst}</td>
                          <td className="p-2 text-right">₹{reportData.totals?.cash}</td>
                          <td className="p-2 text-right">₹{reportData.totals?.paytm}</td>
                          <td className="p-2 text-right">₹{reportData.totals?.card}</td>
                          <td className="p-2 text-right text-rose-700">₹{reportData.totals?.total}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Right: Expenses & Cash Denomination */}
                  <div className="lg:col-span-4 space-y-4">
                    {/* Expenses Table */}
                    <div className="border border-slate-200 rounded-2xl overflow-hidden">
                      <div className="bg-amber-300 text-slate-900 px-3 py-1.5 text-xs font-black uppercase text-center border-b border-amber-400">
                        EXPENSES
                      </div>
                      <div className="p-3 space-y-1 text-xs font-semibold">
                        {(reportData.expenses || []).length === 0 ? (
                          <p className="text-slate-400 text-center py-2">No expenses logged today.</p>
                        ) : (
                          (reportData.expenses || []).map((exp, idx) => (
                            <div key={idx} className="flex justify-between">
                              <span>{exp.note}</span>
                              <span className="font-bold text-rose-600">₹{exp.amount}</span>
                            </div>
                          ))
                        )}
                        <div className="border-t border-slate-200 pt-2 flex justify-between font-black text-slate-900">
                          <span>TOTAL EXPENSES</span>
                          <span>₹{reportData.total_expenses}</span>
                        </div>
                      </div>
                    </div>

                    {/* Summary Balance Box */}
                    <div className="bg-emerald-600 text-white p-3 rounded-2xl text-xs space-y-1 font-bold">
                      <div className="flex justify-between"><span>OPENING BAL :</span><span>₹{reportData.balance?.opening_bal}</span></div>
                      <div className="flex justify-between text-rose-200"><span>* TOTAL SALE</span><span>₹{reportData.balance?.total_sale}</span></div>
                      <div className="flex justify-between"><span>* CASH PAY</span><span>₹{reportData.balance?.cash_pay}</span></div>
                      <div className="flex justify-between"><span>* PHONE PAY</span><span>₹{reportData.balance?.phone_pay}</span></div>
                      <div className="flex justify-between"><span>* CARD</span><span>₹{reportData.balance?.card}</span></div>
                      <div className="flex justify-between text-rose-200"><span>* EXPENSE</span><span>₹{reportData.balance?.expense}</span></div>
                      <div className="border-t border-emerald-400 pt-1 flex justify-between text-sm font-black"><span>CLOSING BAL</span><span>₹{reportData.balance?.closing_bal}</span></div>
                    </div>

                    {/* Cash Denomination Box */}
                    <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
                      <div className="bg-amber-300 text-slate-900 px-3 py-1.5 font-black uppercase text-center border-b border-amber-400">
                        CASH DENOMINATION
                      </div>
                      <div className="p-3 divide-y divide-slate-100 font-semibold text-slate-800">
                        {["500", "200", "100", "50", "20", "10", "5", "2", "1"].map((k) => (
                          <div key={k} className="py-1 flex justify-between">
                            <span>₹{k}</span>
                            <span>{reportData.cash_denomination?.[k] || 0}</span>
                            <span className="font-bold text-slate-900">₹{(parseInt(k, 10) * (reportData.cash_denomination?.[k] || 0))}</span>
                          </div>
                        ))}
                        <div className="pt-2 flex justify-between font-black text-emerald-700">
                          <span>RUNNING TOTAL</span>
                          <span>₹{reportData.cash_denomination?.total || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Staff Achieved Table */}
                <div className="max-w-xs border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="bg-amber-300 text-slate-900 px-3 py-1.5 text-xs font-black uppercase text-center border-b border-amber-400">
                    STAFF ACHIEVED
                  </div>
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 font-bold text-slate-700">
                      <tr><th className="p-2">S.NO</th><th className="p-2">STAFF NAME</th><th className="p-2 text-right">ACHIEVED</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold">
                      {(reportData.staff_achieved || []).map((st) => (
                        <tr key={st.sno}>
                          <td className="p-2 text-slate-400">{st.sno}</td>
                          <td className="p-2 font-bold text-slate-900">{st.staff_name}</td>
                          <td className="p-2 text-right font-black text-emerald-600">₹{st.achieved}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 2. MONTHLY PERFORMANCE STAFF */}
            {reportType === "monthly_staff_performance" && (
              <div className="p-6 space-y-6">
                <div className="bg-amber-300 text-slate-900 py-3 px-4 rounded-2xl text-center font-black tracking-wider uppercase text-sm border border-amber-400 shadow-sm">
                  MONTHLY PERFORMANCE STAFF - {reportData.month_year}
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-amber-300 text-slate-900 font-black uppercase border-b border-amber-400">
                        <th className="p-2 text-center">S.NO</th>
                        <th className="p-2">NAME</th>
                        <th className="p-2 text-center">LEVEL</th>
                        <th className="p-2 text-right">SALARY</th>
                        <th className="p-2 text-right">TARGET</th>
                        <th className="p-2 text-right text-rose-700">ACHIEVED</th>
                        <th className="p-2 text-right text-rose-700">WITH GST</th>
                        <th className="p-2 text-center">WALKIN</th>
                        <th className="p-2 text-right">ABV</th>
                        <th className="p-2 text-center">%</th>
                        <th className="p-2 text-center">REVIEW</th>
                        <th className="p-2 text-center">M/C</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                      {(reportData.staff_performance || []).map((row) => (
                        <tr key={row.sno} className="hover:bg-slate-50">
                          <td className="p-2 text-center text-slate-400">{row.sno}</td>
                          <td className="p-2 font-bold text-slate-900">{row.name}</td>
                          <td className="p-2 text-center font-bold text-indigo-600">{row.level}</td>
                          <td className="p-2 text-right">₹{row.salary}</td>
                          <td className="p-2 text-right">₹{row.target}</td>
                          <td className="p-2 text-right font-black text-rose-600">₹{row.achieved}</td>
                          <td className="p-2 text-right font-black text-rose-600">₹{row.with_gst}</td>
                          <td className="p-2 text-center font-bold">{row.walkin}</td>
                          <td className="p-2 text-right font-bold text-slate-900">₹{row.abv.toFixed(2)}</td>
                          <td className="p-2 text-center font-extrabold text-emerald-600">{row.percentage.toFixed(1)}%</td>
                          <td className="p-2 text-center text-slate-400">{row.review}</td>
                          <td className="p-2 text-center text-slate-400">{row.mc}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-amber-300 text-slate-900 font-black uppercase">
                      <tr>
                        <td colSpan="5" className="p-2 text-right">TOTAL</td>
                        <td className="p-2 text-right text-rose-700">₹{reportData.totals?.achieved}</td>
                        <td className="p-2 text-right text-rose-700">₹{reportData.totals?.with_gst}</td>
                        <td className="p-2 text-center">{reportData.totals?.walkin}</td>
                        <td colSpan="4"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Summary Boxes */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-bold">
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl space-y-1">
                    <div className="flex justify-between font-extrabold text-slate-900"><span>SALON SALES</span><span>₹{reportData.summary?.salon_sales?.sales}</span></div>
                    <div className="flex justify-between text-slate-600"><span>WALK IN</span><span>{reportData.summary?.salon_sales?.walkin}</span></div>
                    <div className="flex justify-between text-slate-600"><span>ABV</span><span>₹{reportData.summary?.salon_sales?.abv.toFixed(2)}</span></div>
                    <div className="flex justify-between text-emerald-700"><span>WITH GST</span><span>₹{reportData.summary?.salon_sales?.with_gst}</span></div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl space-y-1">
                    <div className="flex justify-between font-extrabold text-blue-900"><span>MALE SALES</span><span>₹{reportData.summary?.male_sales?.sales}</span></div>
                    <div className="flex justify-between text-slate-600"><span>WALK IN</span><span>{reportData.summary?.male_sales?.walkin}</span></div>
                    <div className="flex justify-between text-slate-600"><span>ABV</span><span>₹{reportData.summary?.male_sales?.abv.toFixed(2)}</span></div>
                  </div>

                  <div className="bg-pink-50 border border-pink-200 p-4 rounded-2xl space-y-1">
                    <div className="flex justify-between font-extrabold text-pink-900"><span>FEMALE SALES</span><span>₹{reportData.summary?.female_sales?.sales}</span></div>
                    <div className="flex justify-between text-slate-600"><span>WALK IN</span><span>{reportData.summary?.female_sales?.walkin}</span></div>
                    <div className="flex justify-between text-slate-600"><span>ABV</span><span>₹{reportData.summary?.female_sales?.abv.toFixed(2)}</span></div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. ATTENDANCE & SALARY REPORT */}
            {reportType === "attendance_salary" && (
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left: Attendance Grid */}
                  <div className="lg:col-span-7 border border-slate-200 rounded-2xl overflow-x-auto">
                    <div className="bg-orange-500 text-white p-2 text-xs font-black text-center uppercase tracking-wider">
                      ATTENDANCE - {reportData.month_year}
                    </div>
                    <table className="w-full text-center text-[10px] border-collapse">
                      <thead>
                        <tr className="bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
                          <th className="p-1 text-left">S.NO</th>
                          <th className="p-1 text-left min-w-[100px]">NAME</th>
                          {(reportData.days_in_month || []).map((d) => (
                            <th key={d.day} className="p-1 border-l border-slate-200">{d.day}</th>
                          ))}
                          <th className="p-1 border-l border-slate-200 font-black">TOTAL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold">
                        {(reportData.attendance_matrix || []).map((row) => (
                          <tr key={row.sno} className="hover:bg-slate-50">
                            <td className="p-1 text-left text-slate-400">{row.sno}</td>
                            <td className="p-1 text-left font-bold text-slate-900">{row.name}</td>
                            {(reportData.days_in_month || []).map((d) => {
                              const val = row.days?.[String(d.day)] || "1";
                              return (
                                <td
                                  key={d.day}
                                  className={`p-1 border-l border-slate-200 font-bold ${
                                    val === "OFF"
                                      ? "bg-emerald-600 text-white"
                                      : val === "0.5"
                                      ? "bg-amber-400 text-slate-900"
                                      : "text-slate-700"
                                  }`}
                                >
                                  {val}
                                </td>
                              );
                            })}
                            <td className="p-1 border-l border-slate-200 font-black text-slate-900">{row.total_days}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Right: Salary Report */}
                  <div className="lg:col-span-5 border border-slate-200 rounded-2xl overflow-x-auto">
                    <div className="bg-emerald-600 text-white p-2 text-xs font-black text-center uppercase tracking-wider">
                      SALARY REPORT - {reportData.month_year}
                    </div>
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
                          <th className="p-2">NAME</th>
                          <th className="p-2 text-right">SALARY</th>
                          <th className="p-2 text-right">NET</th>
                          <th className="p-2 text-right text-emerald-600">ADV</th>
                          <th className="p-2 text-right text-rose-600">LESS</th>
                          <th className="p-2 text-right font-black text-slate-900">PAYABLE</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                        {(reportData.salary_report || []).map((sal) => (
                          <tr key={sal.sno} className="hover:bg-slate-50">
                            <td className="p-2 font-bold text-slate-900">{sal.name}</td>
                            <td className="p-2 text-right">₹{sal.salary}</td>
                            <td className="p-2 text-right font-bold">₹{sal.net.toFixed(2)}</td>
                            <td className="p-2 text-right font-bold text-emerald-600">₹{sal.advance}</td>
                            <td className="p-2 text-right font-bold text-rose-600">₹{sal.less_amount}</td>
                            <td className="p-2 text-right font-black text-emerald-700">₹{sal.amount.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-amber-300 text-slate-900 font-black uppercase text-xs">
                        <tr>
                          <td className="p-2">TOTAL</td>
                          <td className="p-2 text-right">₹{reportData.totals?.salary}</td>
                          <td className="p-2 text-right">₹{reportData.totals?.net?.toFixed(2)}</td>
                          <td className="p-2 text-right">₹{reportData.totals?.advance}</td>
                          <td className="p-2 text-right">₹{reportData.totals?.less_amount}</td>
                          <td className="p-2 text-right text-emerald-800">₹{reportData.totals?.amount?.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Standard Reports Fallback */}
            {["sales", "tax", "employees", "products"].includes(reportType) && (
              <div className="p-6">
                <p className="text-xs font-semibold text-slate-500">Standard ledger report active for preset: {preset}. Click Excel Export above to download full dataset.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Reports;
