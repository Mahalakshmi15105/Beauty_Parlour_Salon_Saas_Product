import React, { useState, useEffect } from "react";
import API from "../services/api";
import { useToast } from "../context/ToastContext";
import { useLanguageCurrency } from "../context/LanguageCurrencyContext";
import { useTheme } from "../context/ThemeContext";
import { exportToCSV, printDataList, exportToPDF, exportToExcel } from "../utils/exportUtils";
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
  AlertCircle
} from "lucide-react";

function Reports() {
  const { showSuccess, showError } = useToast();
  const { formatCurrency, currencySymbol, t } = useLanguageCurrency();
  const { getChartColors } = useTheme();
  const chartColors = getChartColors();

  // Active Report Types: "sales", "tax", "employees", "products", "procurement", "memberships"
  const [reportType, setReportType] = useState("sales");
  const [preset, setPreset] = useState("30days");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchReport = () => {
    setLoading(true);
    setError(null);
    setReportData(null); // CRITICAL FIX: Reset data to prevent TypeErrors during loading of new report type
    
    let url = `/reports/${reportType}?preset=${preset}`;
    if (preset === "custom" && startDate && endDate) {
      url = `/reports/${reportType}?start_date=${startDate}&end_date=${endDate}`;
    }

    API.get(url)
      .then((res) => {
        // Handle direct arrays (employees, products) vs objects with data envelope
        const payload = res.data;
        setReportData(payload || null);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load report analytics.");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, preset]);

  // Dynamic Column and Data Extraction for Export/Print
  const getExportConfig = () => {
    if (!reportData) return { columns: [], data: [], title: "" };

    switch (reportType) {
      case "sales":
        return {
          title: "Sales & Financial Ledger",
          filename: "sales_ledger_report",
          data: reportData.items || [],
          columns: [
            { header: "Invoice #", accessor: "invoice_number" },
            { header: "Date", accessor: "date" },
            { header: "Customer", accessor: "customer_name" },
            { header: "Gross Amount", accessor: (row) => `${currencySymbol}${parseFloat(row.subtotal || 0).toFixed(2)}` },
            { header: "Discounts", accessor: (row) => `${currencySymbol}${parseFloat(row.discount || 0).toFixed(2)}` },
            { header: "Tax", accessor: (row) => `${currencySymbol}${parseFloat(row.tax || 0).toFixed(2)}` },
            { header: "Net Payable", accessor: (row) => `${currencySymbol}${parseFloat(row.total || 0).toFixed(2)}` },
            { header: "Status", accessor: "status" }
          ]
        };
      case "tax":
        return {
          title: "Tax Reconciliation Report",
          filename: "tax_reconciliation_report",
          data: reportData.daily_tax_logs || [],
          columns: [
            { header: "Date", accessor: "date" },
            { header: "Gross Subtotal", accessor: (row) => `${currencySymbol}${parseFloat(row.gross_subtotal || 0).toFixed(2)}` },
            { header: "Discounts", accessor: (row) => `${currencySymbol}${parseFloat(row.discount || 0).toFixed(2)}` },
            { header: "Tax Collected", accessor: (row) => `${currencySymbol}${parseFloat(row.tax_collected || 0).toFixed(2)}` },
            { header: "Net Total", accessor: (row) => `${currencySymbol}${parseFloat(row.net_total || 0).toFixed(2)}` }
          ]
        };
      case "employees":
        return {
          title: "Staff Commissions Report",
          filename: "staff_commissions_report",
          data: Array.isArray(reportData) ? reportData : [],
          columns: [
            { header: "Employee Name", accessor: "name" },
            { header: "Commission Rate", accessor: (row) => `${row.commission_percentage}%` },
            { header: "Treatments Rendered", accessor: (row) => `${row.services_rendered} Services` },
            { header: "Total Revenue Generated", accessor: (row) => `${currencySymbol}${parseFloat(row.total_revenue || 0).toFixed(2)}` },
            { header: "Calculated Commission", accessor: (row) => `${currencySymbol}${parseFloat(row.estimated_commission || 0).toFixed(2)}` }
          ]
        };
      case "products":
        return {
          title: "Product Performance & Stock Report",
          filename: "product_performance_report",
          data: Array.isArray(reportData) ? reportData : [],
          columns: [
            { header: "Product Name", accessor: "name" },
            { header: "SKU Code", accessor: "sku" },
            { header: "Unit Price", accessor: (row) => `${currencySymbol}${parseFloat(row.selling_price || 0).toFixed(2)}` },
            { header: "Current Stock Level", accessor: (row) => `${row.stock_quantity} units` },
            { header: "Units Sold", accessor: (row) => `${row.units_sold} units` },
            { header: "Total Retail Revenue", accessor: (row) => `${currencySymbol}${parseFloat(row.total_sales || 0).toFixed(2)}` }
          ]
        };
      case "procurement":
        return {
          title: "Supplier Procurement & Purchase Ledger",
          filename: "procurement_ledger_report",
          data: reportData.items || [],
          columns: [
            { header: "Date", accessor: "date" },
            { header: "Product Name", accessor: "product_name" },
            { header: "Supplier", accessor: "supplier_name" },
            { header: "Quantity Restocked", accessor: "quantity" },
            { header: "Cost Per Unit", accessor: (row) => `${currencySymbol}${parseFloat(row.cost_price || 0).toFixed(2)}` },
            { header: "Total Spent", accessor: (row) => `${currencySymbol}${parseFloat(row.total_price || 0).toFixed(2)}` },
            { header: "Status", accessor: "status" }
          ]
        };
      case "memberships":
        return {
          title: "Customer Memberships & Plan Sales Report",
          filename: "memberships_sales_report",
          data: reportData.items || [],
          columns: [
            { header: "Date Sold", accessor: "created_at" },
            { header: "Customer Name", accessor: "customer_name" },
            { header: "Membership Plan", accessor: "plan_name" },
            { header: "Price Paid", accessor: (row) => `${currencySymbol}${parseFloat(row.price || 0).toFixed(2)}` },
            { header: "Duration Dates", accessor: (row) => `${row.start_date} to ${row.end_date}` },
            { header: "Status", accessor: "status" }
          ]
        };
      default:
        return { columns: [], data: [], title: "" };
    }
  };

  const handlePrint = () => {
    const { columns, data, title } = getExportConfig();
    if (data.length === 0) return showError("No data available to print.");
    printDataList(title, data, columns);
  };

  const handleExportExcel = () => {
    const { columns, data, title, filename } = getExportConfig();
    if (data.length === 0) return showError("No data available to export.");
    exportToExcel(title, data, columns, filename);
  };

  const handleExportPDF = () => {
    const { columns, data, title, filename } = getExportConfig();
    if (data.length === 0) return showError("No data available to export.");
    
    // Set column widths based on type
    const pdfColumns = columns.map(c => ({
      header: c.header,
      accessor: c.accessor,
      width: reportType === "procurement" || reportType === "memberships" ? 25 : 30
    }));

    exportToPDF(title, data, pdfColumns, filename);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Title Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">{t("reports")}</h1>
          <p className="text-xs text-text-secondary">Export financial ledgers, tax returns, staff commissions, product inventories, and supplier procurements.</p>
        </div>
      </div>

      {/* Date preset picker & actions */}
      <div className="bg-surface border border-border-soft p-4 rounded-lg flex flex-wrap gap-4 justify-between items-center">
        {/* Preset selections */}
        <div className="flex items-center space-x-2 text-xs">
          <Calendar className="w-4 h-4 text-text-secondary" />
          <span className="font-semibold text-text-secondary">Billing Period:</span>
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            className="bg-background border border-border-soft px-3 py-1.5 rounded-lg text-xs font-semibold focus:outline-none"
          >
            <option value="today">Today</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="custom">Custom Date Range</option>
          </select>

          {preset === "custom" && (
            <div className="flex items-center space-x-2 border-l border-border-soft pl-3 ml-1">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-background border border-border-soft px-2 py-1 rounded text-xs focus:outline-none"
              />
              <span className="text-text-secondary text-[11px]">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-background border border-border-soft px-2 py-1 rounded text-xs focus:outline-none"
              />
              <button
                onClick={fetchReport}
                className="bg-primary hover:bg-primary-hover text-white px-3 py-1 rounded font-bold text-xs transition"
              >
                Apply
              </button>
            </div>
          )}
        </div>

        {/* Global Export Buttons */}
        <div className="flex space-x-2">
          <button
            onClick={handlePrint}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition border border-slate-200"
            title="Print Report"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition border border-emerald-200"
            title="Export Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel Export</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="bg-rose-50 hover:bg-rose-100 text-rose-700 px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition border border-rose-200"
            title="Export PDF"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PDF Export</span>
          </button>
        </div>
      </div>

      {/* Segmented Report Type Selector */}
      <div className="flex flex-wrap gap-2 bg-surface border border-border-soft p-3 rounded-2xl shadow-xs">
        {[
          { id: "sales", label: "Financial Ledger", icon: TrendingUp },
          { id: "tax", label: "Tax Reconciliation", icon: Percent },
          { id: "employees", label: "Staff Commissions", icon: Users },
          { id: "products", label: "Product Performance", icon: Boxes },
          { id: "procurement", label: "Supplier Procurements", icon: ShoppingCart },
          { id: "memberships", label: "Membership Sales", icon: Award },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setReportType(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center space-x-2 ${
                reportType === tab.id
                  ? "bg-primary text-white shadow-md shadow-pink-500/20"
                  : "bg-background text-slate-700 border border-border-soft hover:bg-slate-100"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Canvas view area */}
      <div className="bg-surface border border-border-soft rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-16 text-center space-y-4">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-text-secondary font-medium">Analyzing database logs and aggregating report statistics...</p>
          </div>
        ) : error ? (
          <div className="p-16 text-center text-danger text-sm font-semibold flex flex-col items-center justify-center space-y-2">
            <AlertCircle className="w-8 h-8 text-danger" />
            <span>{error}</span>
          </div>
        ) : !reportData ? (
          <div className="p-16 text-center text-xs text-text-secondary">No report data found.</div>
        ) : (
          <>
            {/* Sales Ledger Tab */}
            {reportType === "sales" && reportData.summary && (
              <div className="p-6 space-y-6">
                {/* Summary boxes */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-slate-50 border border-border-soft p-4 rounded-xl">
                    <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">{t("gross_total")}</p>
                    <p className="text-lg font-extrabold text-text-primary mt-1">{formatCurrency(reportData.summary.total_sales)}</p>
                  </div>
                  <div className="bg-slate-50 border border-border-soft p-4 rounded-xl">
                    <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">{t("tax_amount")}</p>
                    <p className="text-lg font-extrabold text-text-primary mt-1">{formatCurrency(reportData.summary.total_tax)}</p>
                  </div>
                  <div className="bg-slate-50 border border-border-soft p-4 rounded-xl">
                    <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">{t("total_discount")}</p>
                    <p className="text-lg font-extrabold text-rose-600 mt-1">- {formatCurrency(reportData.summary.total_discount)}</p>
                  </div>
                  <div className="bg-slate-50 border border-border-soft p-4 rounded-xl">
                    <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Total Bills Issued</p>
                    <p className="text-lg font-extrabold text-primary mt-1">{reportData.summary.total_orders} Invoices</p>
                  </div>
                </div>

                {/* Ledger Data Table */}
                <div className="border border-border-soft rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-primary-light border-b border-border-soft">
                        <th className="px-4 py-3 font-semibold text-text-secondary uppercase">Invoice #</th>
                        <th className="px-4 py-3 font-semibold text-text-secondary uppercase">Date</th>
                        <th className="px-4 py-3 font-semibold text-text-secondary uppercase">Customer</th>
                        <th className="px-4 py-3 font-semibold text-text-secondary uppercase text-right">{t("gross_amount")}</th>
                        <th className="px-4 py-3 font-semibold text-text-secondary uppercase text-right">{t("discount_amount")}</th>
                        <th className="px-4 py-3 font-semibold text-text-secondary uppercase text-right">{t("tax_amount")}</th>
                        <th className="px-4 py-3 font-bold text-text-primary uppercase text-right">{t("net_payable")}</th>
                        <th className="px-4 py-3 font-semibold text-text-secondary uppercase text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-soft">
                      {(reportData.items || []).length === 0 ? (
                        <tr>
                          <td colSpan="8" className="p-8 text-center text-text-secondary">No invoices found for this range.</td>
                        </tr>
                      ) : (
                        reportData.items.map((row) => (
                          <tr key={row.id} className="hover:bg-background/50 transition">
                            <td className="px-4 py-3 font-bold text-text-primary">{row.invoice_number}</td>
                            <td className="px-4 py-3 text-text-secondary">{row.date}</td>
                            <td className="px-4 py-3 font-medium text-text-primary">{row.customer_name}</td>
                            <td className="px-4 py-3 text-text-secondary text-right">{formatCurrency(row.subtotal)}</td>
                            <td className="px-4 py-3 text-danger text-right">- {formatCurrency(row.discount)}</td>
                            <td className="px-4 py-3 text-text-secondary text-right">{formatCurrency(row.tax)}</td>
                            <td className="px-4 py-3 font-extrabold text-text-primary text-right">{formatCurrency(row.total)}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                                row.status === "Paid" ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                              }`}>
                                {row.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tax Reconciliation Tab */}
            {reportType === "tax" && reportData.daily_tax_logs && (
              <div className="p-6 space-y-6">
                <div className="bg-slate-50 border border-border-soft p-5 rounded-xl flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-bold text-text-primary">Total GST/Tax Liability Collected</h3>
                    <p className="text-xs text-text-secondary">Aggregated tax liabilities for the selected period.</p>
                  </div>
                  <span className="text-2xl font-extrabold text-primary">{formatCurrency(reportData.total_tax_collected)}</span>
                </div>

                <div className="border border-border-soft rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-primary-light border-b border-border-soft">
                        <th className="px-6 py-3 font-semibold text-text-secondary uppercase">Date</th>
                        <th className="px-6 py-3 font-semibold text-text-secondary uppercase text-right">Gross Subtotal</th>
                        <th className="px-6 py-3 font-semibold text-text-secondary uppercase text-right">Discounts Allowed</th>
                        <th className="px-6 py-3 font-bold text-success uppercase text-right">Tax Liabilities</th>
                        <th className="px-6 py-3 font-semibold text-text-primary uppercase text-right">Net Sales Outlay</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-soft">
                      {reportData.daily_tax_logs.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="p-8 text-center text-text-secondary">No tax records found for this period.</td>
                        </tr>
                      ) : (
                        reportData.daily_tax_logs.map((row, idx) => (
                          <tr key={idx} className="hover:bg-background/50 transition">
                            <td className="px-6 py-3 font-bold text-text-primary">{row.date}</td>
                            <td className="px-6 py-3 text-text-secondary text-right">{formatCurrency(row.gross_subtotal)}</td>
                            <td className="px-6 py-3 text-danger text-right">- {formatCurrency(row.discount)}</td>
                            <td className="px-6 py-3 font-extrabold text-success text-right">{formatCurrency(row.tax_collected)}</td>
                            <td className="px-6 py-3 font-bold text-text-primary text-right">{formatCurrency(row.net_total)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Staff Commissions Tab */}
            {reportType === "employees" && Array.isArray(reportData) && (
              <div className="p-6 space-y-6">
                <div className="border border-border-soft rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-primary-light border-b border-border-soft">
                        <th className="px-6 py-3 font-semibold text-text-secondary uppercase">Employee Name</th>
                        <th className="px-6 py-3 font-semibold text-text-secondary uppercase text-center">Commission Percentage</th>
                        <th className="px-6 py-3 font-semibold text-text-secondary uppercase text-center">Services Delivered</th>
                        <th className="px-6 py-3 font-semibold text-text-secondary uppercase text-right">Total Revenue Generated</th>
                        <th className="px-6 py-3 font-bold text-success uppercase text-right">Calculated Commission Payout</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-soft">
                      {reportData.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="p-8 text-center text-text-secondary">No commission ledger records.</td>
                        </tr>
                      ) : (
                        reportData.map((row) => (
                          <tr key={row.employee_id} className="hover:bg-background/50 transition">
                            <td className="px-6 py-4 text-sm font-bold text-text-primary">{row.name}</td>
                            <td className="px-6 py-4 text-sm text-text-secondary text-center">{row.commission_percentage}%</td>
                            <td className="px-6 py-4 text-sm text-text-secondary text-center">{row.services_rendered} Treatments</td>
                            <td className="px-6 py-4 text-sm font-semibold text-text-primary text-right">{formatCurrency(row.total_revenue)}</td>
                            <td className="px-6 py-4 text-sm font-extrabold text-success text-right">{formatCurrency(row.estimated_commission)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Product Performance Tab */}
            {reportType === "products" && Array.isArray(reportData) && (
              <div className="p-6 space-y-6">
                <div className="border border-border-soft rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-primary-light border-b border-border-soft">
                        <th className="px-6 py-3 font-semibold text-text-secondary uppercase">Product Details</th>
                        <th className="px-6 py-3 font-semibold text-text-secondary uppercase">SKU Code</th>
                        <th className="px-6 py-3 font-semibold text-text-secondary uppercase text-right">Unit Price</th>
                        <th className="px-6 py-3 font-semibold text-text-secondary uppercase text-center">Current Stock</th>
                        <th className="px-6 py-3 font-semibold text-text-secondary uppercase text-center">Units Sold</th>
                        <th className="px-6 py-3 font-bold text-text-primary uppercase text-right">Total Retail Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-soft">
                      {reportData.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="p-8 text-center text-text-secondary">No products configured or sold.</td>
                        </tr>
                      ) : (
                        reportData.map((row) => (
                          <tr key={row.id} className="hover:bg-background/50 transition">
                            <td className="px-6 py-4 text-sm font-bold text-text-primary">{row.name}</td>
                            <td className="px-6 py-4 text-sm text-text-secondary">{row.sku || "-"}</td>
                            <td className="px-6 py-4 text-sm text-text-secondary text-right">{formatCurrency(row.selling_price)}</td>
                            <td className="px-6 py-4 text-sm font-medium text-text-primary text-center">{row.stock_quantity} units</td>
                            <td className="px-6 py-4 text-sm text-text-secondary text-center">{row.units_sold} units</td>
                            <td className="px-6 py-4 text-sm font-extrabold text-text-primary text-right">{formatCurrency(row.total_sales)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Supplier Procurement Tab */}
            {reportType === "procurement" && reportData.summary && (
              <div className="p-6 space-y-6">
                {/* Summary boxes */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-50 border border-border-soft p-4 rounded-xl">
                    <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Total Capital Spent</p>
                    <p className="text-lg font-extrabold text-primary mt-1">{formatCurrency(reportData.summary.total_spent)}</p>
                  </div>
                  <div className="bg-slate-50 border border-border-soft p-4 rounded-xl">
                    <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Quantity Restocked</p>
                    <p className="text-lg font-extrabold text-text-primary mt-1">{reportData.summary.total_quantity} units</p>
                  </div>
                  <div className="bg-slate-50 border border-border-soft p-4 rounded-xl">
                    <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Procurement Shipments</p>
                    <p className="text-lg font-extrabold text-text-primary mt-1">{reportData.summary.total_orders} Orders</p>
                  </div>
                </div>

                {/* Ledger Data Table */}
                <div className="border border-border-soft rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-primary-light border-b border-border-soft">
                        <th className="px-6 py-3 font-semibold text-text-secondary uppercase">Order Date</th>
                        <th className="px-6 py-3 font-semibold text-text-secondary uppercase">Product Restocked</th>
                        <th className="px-6 py-3 font-semibold text-text-secondary uppercase">Supplier Name</th>
                        <th className="px-6 py-3 font-semibold text-text-secondary uppercase text-center">Qty Added</th>
                        <th className="px-6 py-3 font-semibold text-text-secondary uppercase text-right">Cost Per Unit</th>
                        <th className="px-6 py-3 font-bold text-text-primary uppercase text-right">Total Spent</th>
                        <th className="px-6 py-3 font-semibold text-text-secondary uppercase text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-soft">
                      {(reportData.items || []).length === 0 ? (
                        <tr>
                          <td colSpan="7" className="p-8 text-center text-text-secondary">No restock orders found for this range.</td>
                        </tr>
                      ) : (
                        reportData.items.map((row) => (
                          <tr key={row.id} className="hover:bg-background/50 transition">
                            <td className="px-6 py-3 text-text-secondary">
                              {new Date(row.date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                            </td>
                            <td className="px-6 py-3 font-bold text-text-primary">{row.product_name}</td>
                            <td className="px-6 py-3 text-text-secondary">{row.supplier_name}</td>
                            <td className="px-6 py-3 text-center font-bold text-primary">+{row.quantity}</td>
                            <td className="px-6 py-3 text-text-secondary text-right">{formatCurrency(row.cost_price)}</td>
                            <td className="px-6 py-3 font-extrabold text-text-primary text-right">{formatCurrency(row.total_price)}</td>
                            <td className="px-6 py-3 text-center">
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold uppercase text-[9px] tracking-wider">
                                {row.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Membership Sales Tab */}
            {reportType === "memberships" && reportData.summary && (
              <div className="p-6 space-y-6">
                {/* Summary boxes */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 border border-border-soft p-4 rounded-xl">
                    <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Membership Sales Revenue</p>
                    <p className="text-lg font-extrabold text-primary mt-1">{formatCurrency(reportData.summary.total_revenue)}</p>
                  </div>
                  <div className="bg-slate-50 border border-border-soft p-4 rounded-xl">
                    <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Memberships Sold</p>
                    <p className="text-lg font-extrabold text-text-primary mt-1">{reportData.summary.total_sold} Plans</p>
                  </div>
                </div>

                {/* Ledger Data Table */}
                <div className="border border-border-soft rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-primary-light border-b border-border-soft">
                        <th className="px-6 py-3 font-semibold text-text-secondary uppercase">Date Sold</th>
                        <th className="px-6 py-3 font-semibold text-text-secondary uppercase">Customer Name</th>
                        <th className="px-6 py-3 font-semibold text-text-secondary uppercase">Membership Plan</th>
                        <th className="px-6 py-3 font-bold text-text-primary uppercase text-right">Price Paid</th>
                        <th className="px-6 py-3 font-semibold text-text-secondary uppercase text-center">Duration Dates</th>
                        <th className="px-6 py-3 font-semibold text-text-secondary uppercase text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-soft">
                      {(reportData.items || []).length === 0 ? (
                        <tr>
                          <td colSpan="6" className="p-8 text-center text-text-secondary">No memberships sold for this range.</td>
                        </tr>
                      ) : (
                        reportData.items.map((row) => (
                          <tr key={row.id} className="hover:bg-background/50 transition">
                            <td className="px-6 py-3 text-text-secondary">
                              {new Date(row.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                            </td>
                            <td className="px-6 py-3 font-bold text-text-primary">{row.customer_name}</td>
                            <td className="px-6 py-3 font-semibold text-primary">{row.plan_name}</td>
                            <td className="px-6 py-3 font-extrabold text-text-primary text-right">{formatCurrency(row.price)}</td>
                            <td className="px-6 py-3 text-text-secondary text-center">{row.start_date} to {row.end_date}</td>
                            <td className="px-6 py-3 text-center">
                              <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full uppercase tracking-wider ${
                                row.status === "active" ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                              }`}>
                                {row.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Reports;
