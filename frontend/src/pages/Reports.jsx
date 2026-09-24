import React, { useState, useEffect } from "react";
import API from "../services/api";
import { useToast } from "../context/ToastContext";
import { useLanguageCurrency } from "../context/LanguageCurrencyContext";
import { useTheme } from "../context/ThemeContext";
import { exportToCSV, printDataList, exportToPDF, exportToExcel } from "../utils/exportUtils";
import XLSX from "xlsx-js-style";
import { EXCEL_COLORS, styleCell, styleRange } from "../utils/exportUtils";
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
      const parlourNameStr = d.parlour_name || "SALON";
      const branchNameStr = d.branch_name || "PARLOUR BRANCH";
      const dateStrInfo = `DATE: ${d.date_str || ""} (${d.day_name || ""})`;

      const wsData = [
        [parlourNameStr],
        [branchNameStr],
        ["DAILY SALES STATEMENT"],
        [dateStrInfo],
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
          exp.note || (i === 0 && expenses.length === 0 ? "No Expenses" : ""),
          exp.amount !== undefined ? exp.amount : ""
        ]);
      }

      const totalRowIdx = 6 + maxRows;
      wsData.push(["TOTAL", "", "", d.totals?.amt || 0, d.totals?.gst || 0, d.totals?.cash || 0, d.totals?.paytm || 0, d.totals?.card || 0, 0, d.totals?.total || 0, "", "TOTAL EXPENSES", d.total_expenses || 0]);
      wsData.push([]);
      
      const staffList = d.staff_achieved || [];
      const denomKeys = ["500", "200", "100", "50", "20", "10", "5", "2", "1"];
      const cd = d.cash_denomination || {};

      const summaryStartRowIdx = totalRowIdx + 2;
      wsData.push(["STAFF ACHIEVED", "", "", "", "", "", "", "", "", "", "", "SUMMARY BALANCE", ""]);
      wsData.push(["S.NO", "STAFF NAME", "ACHIEVED", "", "", "", "", "", "", "", "", "OPENING BAL :", d.balance?.opening_bal || 130]);
      wsData.push([staffList[0]?.sno || 1, staffList[0]?.staff_name || "-", staffList[0]?.achieved || 0, "", "", "", "", "", "", "", "", "* TOTAL SALE", d.balance?.total_sale || 0]);
      wsData.push([staffList[1]?.sno || 2, staffList[1]?.staff_name || "-", staffList[1]?.achieved || 0, "", "", "", "", "", "", "", "", "* CASH PAY", d.balance?.cash_pay || 0]);
      wsData.push([staffList[2]?.sno || 3, staffList[2]?.staff_name || "-", staffList[2]?.achieved || 0, "", "", "", "", "", "", "", "", "* PHONE PAY", d.balance?.phone_pay || 0]);
      wsData.push([staffList[3]?.sno || 4, staffList[3]?.staff_name || "-", staffList[3]?.achieved || 0, "", "", "", "", "", "", "", "", "* CARD", d.balance?.card || 0]);
      wsData.push([staffList[4]?.sno || 5, staffList[4]?.staff_name || "-", staffList[4]?.achieved || 0, "", "", "", "", "", "", "", "", "* EXPENCE", d.balance?.expense || 0]);
      wsData.push(["", "", "", "", "", "", "", "", "", "", "", "CLOSING BAL", d.balance?.closing_bal || 0]);

      wsData.push([]);
      const denomHeaderRowIdx = summaryStartRowIdx + 9;
      wsData.push(["CASH DENOMINATION", "", ""]);
      wsData.push(["DENOMINATION", "COUNT", "SUBTOTAL"]);
      denomKeys.forEach((k) => {
        const cnt = cd[k] || 0;
        const sub = parseInt(k, 10) * cnt;
        wsData.push([`₹ ${k}`, cnt, sub]);
      });
      wsData.push(["CASH DENOMINATION TOTAL", "", cd.total || 0]);

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Auto Column Widths
      ws["!cols"] = [
        { wch: 8 },  // S.NO
        { wch: 22 }, // SERVICE
        { wch: 16 }, // STAFF
        { wch: 10 }, // AMT
        { wch: 10 }, // GST
        { wch: 10 }, // CASH
        { wch: 10 }, // PAYTM
        { wch: 10 }, // CARD
        { wch: 8 },  // M/C
        { wch: 12 }, // TOTAL
        { wch: 4 },  // GAP
        { wch: 22 }, // EXPENSES / SUMMARY
        { wch: 14 }  // AMOUNT
      ];

      // Merges
      ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 12 } }, // Parlour Name
        { s: { r: 1, c: 0 }, e: { r: 1, c: 12 } }, // Branch Name
        { s: { r: 2, c: 0 }, e: { r: 2, c: 12 } }, // Daily Sales Statement Title
        { s: { r: 3, c: 0 }, e: { r: 3, c: 12 } }, // Date & Day Info
        { s: { r: summaryStartRowIdx, c: 0 }, e: { r: summaryStartRowIdx, c: 2 } }, // Staff Achieved Header
        { s: { r: summaryStartRowIdx, c: 11 }, e: { r: summaryStartRowIdx, c: 12 } }, // Summary Balance Header
        { s: { r: denomHeaderRowIdx, c: 0 }, e: { r: denomHeaderRowIdx, c: 2 } }, // Cash Denomination Header
        { s: { r: denomHeaderRowIdx + 11, c: 0 }, e: { r: denomHeaderRowIdx + 11, c: 1 } } // Cash Denomination Total Label
      ];

      // Apply Cell Styling
      // 1. Parlour Name & Branch Header (Pink Fill)
      styleRange(ws, 0, 0, 0, 12, {
        fill: EXCEL_COLORS.PINK_HEADER,
        font: { bold: true, sz: 14, color: { rgb: EXCEL_COLORS.WHITE_TEXT } },
        alignment: { horizontal: "center", vertical: "center" }
      });
      styleRange(ws, 1, 0, 1, 12, {
        fill: EXCEL_COLORS.PINK_HEADER,
        font: { bold: true, sz: 11, color: { rgb: EXCEL_COLORS.WHITE_TEXT } },
        alignment: { horizontal: "center", vertical: "center" }
      });

      // 2. Green Title & Date Banner
      styleRange(ws, 2, 0, 2, 12, {
        fill: EXCEL_COLORS.GREEN_BANNER,
        font: { bold: true, sz: 12, color: { rgb: EXCEL_COLORS.WHITE_TEXT } },
        alignment: { horizontal: "center", vertical: "center" }
      });
      styleRange(ws, 3, 0, 3, 12, {
        fill: EXCEL_COLORS.GREEN_BANNER,
        font: { bold: true, sz: 10, color: { rgb: EXCEL_COLORS.WHITE_TEXT } },
        alignment: { horizontal: "center", vertical: "center" }
      });

      // 3. Table Headers Row (Row 5)
      styleRange(ws, 5, 0, 5, 9, {
        fill: EXCEL_COLORS.PINK_HEADER,
        font: { bold: true, sz: 10, color: { rgb: EXCEL_COLORS.WHITE_TEXT } },
        alignment: { horizontal: "center", vertical: "center" }
      });
      styleRange(ws, 5, 11, 5, 12, {
        fill: EXCEL_COLORS.YELLOW_ACCENT,
        font: { bold: true, sz: 10, color: { rgb: EXCEL_COLORS.WHITE_TEXT } },
        alignment: { horizontal: "center", vertical: "center" }
      });

      // 4. Data Rows (Rows 6 to 6 + maxRows - 1)
      for (let i = 0; i < maxRows; i++) {
        const r = 6 + i;
        const fill = i % 2 === 0 ? "FFFFFF" : EXCEL_COLORS.LIGHT_GRAY;
        styleRange(ws, r, 0, r, 9, { fill, alignment: { vertical: "center" } });
        // Right align numeric cells in line items
        for (let c = 3; c <= 9; c++) {
          styleCell(ws, r, c, { fill, alignment: { horizontal: "right", vertical: "center" } });
        }
        // Expense cells
        styleRange(ws, r, 11, r, 12, { fill });
        styleCell(ws, r, 12, { fill, alignment: { horizontal: "right", vertical: "center" } });
      }

      // 5. Total Row
      ws["!merges"].push({ s: { r: totalRowIdx, c: 0 }, e: { r: totalRowIdx, c: 2 } });
      styleRange(ws, totalRowIdx, 0, totalRowIdx, 9, {
        fill: EXCEL_COLORS.LIGHT_YELLOW,
        font: { bold: true, sz: 10 },
        alignment: { vertical: "center" }
      });
      for (let c = 3; c <= 9; c++) {
        styleCell(ws, totalRowIdx, c, {
          fill: EXCEL_COLORS.LIGHT_YELLOW,
          font: { bold: true, sz: 10 },
          alignment: { horizontal: "right", vertical: "center" }
        });
      }
      styleRange(ws, totalRowIdx, 11, totalRowIdx, 12, {
        fill: EXCEL_COLORS.LIGHT_YELLOW,
        font: { bold: true, sz: 10 },
        alignment: { vertical: "center" }
      });
      styleCell(ws, totalRowIdx, 12, {
        fill: EXCEL_COLORS.LIGHT_YELLOW,
        font: { bold: true, sz: 10 },
        alignment: { horizontal: "right", vertical: "center" }
      });

      // 6. Staff Achieved Header & Table
      styleRange(ws, summaryStartRowIdx, 0, summaryStartRowIdx, 2, {
        fill: EXCEL_COLORS.YELLOW_ACCENT,
        font: { bold: true, color: { rgb: EXCEL_COLORS.WHITE_TEXT } },
        alignment: { horizontal: "center", vertical: "center" }
      });
      styleRange(ws, summaryStartRowIdx + 1, 0, summaryStartRowIdx + 1, 2, {
        fill: EXCEL_COLORS.LIGHT_YELLOW,
        font: { bold: true }
      });
      for (let i = 0; i < 6; i++) {
        const r = summaryStartRowIdx + 2 + i;
        styleRange(ws, r, 0, r, 2, { alignment: { vertical: "center" } });
        styleCell(ws, r, 2, { alignment: { horizontal: "right", vertical: "center" } });
      }

      // 7. Summary Balance Box
      styleRange(ws, summaryStartRowIdx, 11, summaryStartRowIdx, 12, {
        fill: EXCEL_COLORS.GREEN_BANNER,
        font: { bold: true, color: { rgb: EXCEL_COLORS.WHITE_TEXT } },
        alignment: { horizontal: "center", vertical: "center" }
      });
      for (let i = 0; i < 7; i++) {
        const r = summaryStartRowIdx + 1 + i;
        const isClosing = i === 6;
        const bg = isClosing ? EXCEL_COLORS.LIGHT_YELLOW : EXCEL_COLORS.LIGHT_GRAY;
        styleRange(ws, r, 11, r, 12, {
          fill: bg,
          font: { bold: isClosing || i === 0 },
          alignment: { vertical: "center" }
        });
        styleCell(ws, r, 12, {
          fill: bg,
          font: { bold: isClosing || i === 0 },
          alignment: { horizontal: "right", vertical: "center" }
        });
      }

      // 8. Cash Denomination Section
      styleRange(ws, denomHeaderRowIdx, 0, denomHeaderRowIdx, 2, {
        fill: EXCEL_COLORS.YELLOW_ACCENT,
        font: { bold: true, color: { rgb: EXCEL_COLORS.WHITE_TEXT } },
        alignment: { horizontal: "center", vertical: "center" }
      });
      styleRange(ws, denomHeaderRowIdx + 1, 0, denomHeaderRowIdx + 1, 2, {
        fill: EXCEL_COLORS.LIGHT_YELLOW,
        font: { bold: true },
        alignment: { horizontal: "center", vertical: "center" }
      });
      for (let i = 0; i < denomKeys.length; i++) {
        const r = denomHeaderRowIdx + 2 + i;
        styleRange(ws, r, 0, r, 2, { alignment: { vertical: "center" } });
        styleCell(ws, r, 1, { alignment: { horizontal: "center", vertical: "center" } });
        styleCell(ws, r, 2, { alignment: { horizontal: "right", vertical: "center" } });
      }
      const denomTotalR = denomHeaderRowIdx + 11;
      styleRange(ws, denomTotalR, 0, denomTotalR, 2, {
        fill: EXCEL_COLORS.LIGHT_YELLOW,
        font: { bold: true }
      });
      styleCell(ws, denomTotalR, 2, {
        fill: EXCEL_COLORS.LIGHT_YELLOW,
        font: { bold: true },
        alignment: { horizontal: "right", vertical: "center" }
      });

      XLSX.utils.book_append_sheet(wb, ws, "Daily Sales Statement");
      XLSX.writeFile(wb, `Daily_Sales_Statement_${d.date_str || "today"}.xlsx`);
    } else if (reportType === "monthly_staff_performance") {
      const d = reportData;
      const parlourNameStr = d.parlour_name || "SmartGoNext Beauty SaaS";
      const titleStr = `MONTHLY PERFORMANCE STAFF - ${d.month_year || ""}`;

      const wsData = [
        [parlourNameStr],
        [titleStr],
        [],
        ["S.NO", "NAME", "LEVEL", "SALARY", "TARGET", "ACHIEVED", "WITH GST", "WALKIN", "ABV", "%", "REVIEW", "M/C"]
      ];

      const performanceList = d.staff_performance || [];
      performanceList.forEach((row) => {
        wsData.push([
          row.sno,
          row.name,
          row.level,
          row.salary,
          row.target,
          row.achieved,
          row.with_gst,
          row.walkin,
          Number(row.abv || 0).toFixed(2),
          Number(row.percentage || 0).toFixed(1) + "%",
          row.review,
          row.mc
        ]);
      });

      const totalRowIdx = 4 + performanceList.length;
      wsData.push(["TOTAL", "", "", "", "", d.totals?.achieved || 0, d.totals?.with_gst || 0, d.totals?.walkin || 0, "", "", "", ""]);
      wsData.push([]);
      
      const summaryRowIdx = totalRowIdx + 2;
      wsData.push(["SALON SALES", d.summary?.salon_sales?.sales || 0, "", "MALE SALES", d.summary?.male_sales?.sales || 0, "", "FEMALE SALES", d.summary?.female_sales?.sales || 0]);
      wsData.push(["WALK IN", d.summary?.salon_sales?.walkin || 0, "", "WALK IN", d.summary?.male_sales?.walkin || 0, "", "WALK IN", d.summary?.female_sales?.walkin || 0]);
      wsData.push(["ABV", Number(d.summary?.salon_sales?.abv || 0).toFixed(2), "", "ABV", Number(d.summary?.male_sales?.abv || 0).toFixed(2), "", "ABV", Number(d.summary?.female_sales?.abv || 0).toFixed(2)]);
      wsData.push(["WITH GST", d.summary?.salon_sales?.with_gst || 0]);

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      ws["!cols"] = [
        { wch: 8 },  // S.NO
        { wch: 20 }, // NAME
        { wch: 12 }, // LEVEL
        { wch: 12 }, // SALARY
        { wch: 12 }, // TARGET
        { wch: 14 }, // ACHIEVED
        { wch: 14 }, // WITH GST
        { wch: 10 }, // WALKIN
        { wch: 12 }, // ABV
        { wch: 10 }, // %
        { wch: 14 }, // REVIEW
        { wch: 8 }   // M/C
      ];

      ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 11 } },
        { s: { r: totalRowIdx, c: 0 }, e: { r: totalRowIdx, c: 4 } }
      ];

      // Parlour Header (Pink)
      styleRange(ws, 0, 0, 0, 11, {
        fill: EXCEL_COLORS.PINK_HEADER,
        font: { bold: true, sz: 14, color: { rgb: EXCEL_COLORS.WHITE_TEXT } },
        alignment: { horizontal: "center", vertical: "center" }
      });
      // Title Banner (Green)
      styleRange(ws, 1, 0, 1, 11, {
        fill: EXCEL_COLORS.GREEN_BANNER,
        font: { bold: true, sz: 12, color: { rgb: EXCEL_COLORS.WHITE_TEXT } },
        alignment: { horizontal: "center", vertical: "center" }
      });
      // Table Header Row 3 (Pink Header)
      styleRange(ws, 3, 0, 3, 11, {
        fill: EXCEL_COLORS.PINK_HEADER,
        font: { bold: true, sz: 10, color: { rgb: EXCEL_COLORS.WHITE_TEXT } },
        alignment: { horizontal: "center", vertical: "center" }
      });

      // Data Rows
      performanceList.forEach((_, idx) => {
        const r = 4 + idx;
        const fill = idx % 2 === 0 ? "FFFFFF" : EXCEL_COLORS.LIGHT_GRAY;
        styleRange(ws, r, 0, r, 11, { fill, alignment: { vertical: "center" } });
        // Alignment
        styleCell(ws, r, 0, { fill, alignment: { horizontal: "center" } });
        styleCell(ws, r, 2, { fill, alignment: { horizontal: "center" } });
        [3, 4, 5, 6, 8].forEach(c => styleCell(ws, r, c, { fill, alignment: { horizontal: "right" } }));
        [7, 9, 10, 11].forEach(c => styleCell(ws, r, c, { fill, alignment: { horizontal: "center" } }));
      });

      // Total Row
      styleRange(ws, totalRowIdx, 0, totalRowIdx, 11, {
        fill: EXCEL_COLORS.LIGHT_YELLOW,
        font: { bold: true },
        alignment: { vertical: "center" }
      });
      [5, 6, 7].forEach(c => styleCell(ws, totalRowIdx, c, {
        fill: EXCEL_COLORS.LIGHT_YELLOW,
        font: { bold: true },
        alignment: { horizontal: c === 7 ? "center" : "right" }
      }));

      // Summary Blocks
      for (let i = 0; i < 4; i++) {
        const r = summaryRowIdx + i;
        styleRange(ws, r, 0, r, 7, { fill: EXCEL_COLORS.LIGHT_GRAY });
        styleCell(ws, r, 0, { fill: EXCEL_COLORS.LIGHT_YELLOW, font: { bold: true } });
        if (i < 3) {
          styleCell(ws, r, 3, { fill: EXCEL_COLORS.LIGHT_YELLOW, font: { bold: true } });
          styleCell(ws, r, 6, { fill: EXCEL_COLORS.LIGHT_YELLOW, font: { bold: true } });
        }
      }

      XLSX.utils.book_append_sheet(wb, ws, "Staff Performance");
      XLSX.writeFile(wb, `Monthly_Staff_Performance_${d.month_year || "report"}.xlsx`);
    } else if (reportType === "attendance_salary") {
      const d = reportData;
      const days = d.days_in_month || [];
      const numDays = days.length;
      const parlourNameStr = d.parlour_name || "SmartGoNext Beauty SaaS";
      const titleStr = `ATTENDANCE & SALARY REPORT - ${d.month_year || ""}`;

      const totalCols = 2 + numDays + 1 + 1 + 11; // Attendance + Gap + Salary

      const headerRow = ["S.NO", "NAME", ...days.map((day) => `Day ${day.day}`), "TOTAL DAYS", "", "S.NO", "NAME", "SALARY", "TARGET", "ACHIEVED", "OFF", "TOTAL DAYS", "NET", "ADVANCE", "LESS AMOUNT", "AMOUNT"];

      const wsData = [
        [parlourNameStr],
        [titleStr],
        [],
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
          sal.net !== undefined ? Number(sal.net).toFixed(2) : "",
          sal.advance !== undefined ? sal.advance : "",
          sal.less_amount !== undefined ? sal.less_amount : "",
          sal.amount !== undefined ? Number(sal.amount).toFixed(2) : ""
        ]);
      }

      const totalRowIdx = 4 + maxRows;
      wsData.push(["TOTAL", "", ...days.map(() => ""), "", "", "", "TOTAL", d.totals?.salary || 0, d.totals?.target || 0, d.totals?.achieved || 0, "", "", Number(d.totals?.net || 0).toFixed(2), d.totals?.advance || 0, d.totals?.less_amount || 0, Number(d.totals?.amount || 0).toFixed(2)]);

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } },
        { s: { r: totalRowIdx, c: 0 }, e: { r: totalRowIdx, c: numDays + 1 } }
      ];

      // Parlour Header (Pink)
      styleRange(ws, 0, 0, 0, totalCols - 1, {
        fill: EXCEL_COLORS.PINK_HEADER,
        font: { bold: true, sz: 14, color: { rgb: EXCEL_COLORS.WHITE_TEXT } },
        alignment: { horizontal: "center", vertical: "center" }
      });
      // Title Banner (Green)
      styleRange(ws, 1, 0, 1, totalCols - 1, {
        fill: EXCEL_COLORS.GREEN_BANNER,
        font: { bold: true, sz: 12, color: { rgb: EXCEL_COLORS.WHITE_TEXT } },
        alignment: { horizontal: "center", vertical: "center" }
      });
      // Header Row 3 (Pink for Attendance, Green/Pink for Salary)
      styleRange(ws, 3, 0, 3, 2 + numDays, {
        fill: EXCEL_COLORS.PINK_HEADER,
        font: { bold: true, sz: 9, color: { rgb: EXCEL_COLORS.WHITE_TEXT } },
        alignment: { horizontal: "center", vertical: "center" }
      });
      styleRange(ws, 3, 2 + numDays + 2, 3, totalCols - 1, {
        fill: EXCEL_COLORS.PINK_HEADER,
        font: { bold: true, sz: 9, color: { rgb: EXCEL_COLORS.WHITE_TEXT } },
        alignment: { horizontal: "center", vertical: "center" }
      });

      // Data Rows
      for (let i = 0; i < maxRows; i++) {
        const r = 4 + i;
        const fill = i % 2 === 0 ? "FFFFFF" : EXCEL_COLORS.LIGHT_GRAY;
        styleRange(ws, r, 0, r, totalCols - 1, { fill, alignment: { vertical: "center" } });
        // Center attendance cells
        for (let c = 2; c < 2 + numDays + 1; c++) {
          styleCell(ws, r, c, { fill, alignment: { horizontal: "center" } });
        }
        // Right align salary numbers
        for (let c = 2 + numDays + 4; c < totalCols; c++) {
          styleCell(ws, r, c, { fill, alignment: { horizontal: "right" } });
        }
      }

      // Total Row
      styleRange(ws, totalRowIdx, 0, totalRowIdx, totalCols - 1, {
        fill: EXCEL_COLORS.LIGHT_YELLOW,
        font: { bold: true },
        alignment: { vertical: "center" }
      });
      for (let c = 2 + numDays + 4; c < totalCols; c++) {
        styleCell(ws, totalRowIdx, c, {
          fill: EXCEL_COLORS.LIGHT_YELLOW,
          font: { bold: true },
          alignment: { horizontal: "right" }
        });
      }

      XLSX.utils.book_append_sheet(wb, ws, "Attendance & Salary");
      XLSX.writeFile(wb, `Attendance_Salary_Report_${d.month_year || "report"}.xlsx`);
    } else {
      // Standard reports fallback
      const dataArr = Array.isArray(reportData) ? reportData : (reportData.items || []);
      if (dataArr.length === 0) return showError("No records available to export.");

      const sample = dataArr[0] || {};
      const columns = Object.keys(sample).map(k => ({
        header: k.toUpperCase().replace(/_/g, ' '),
        accessor: k
      }));

      const parlourNameStr = reportData?.parlour_name || "SmartGoNext Beauty SaaS";
      const titleStr = `${reportType.toUpperCase().replace(/_/g, ' ')} REPORT`;

      exportToExcel(titleStr, dataArr, columns, `${reportType}_report`, parlourNameStr);
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
                              <td className="p-2 text-center font-bold text-slate-400 numeric">{row.sno}</td>
                              <td className="p-2 font-bold text-slate-900">{row.service}</td>
                              <td className="p-2">{row.staff}</td>
                              <td className="p-2 text-right numeric">₹{row.amt}</td>
                              <td className="p-2 text-right numeric">₹{row.gst}</td>
                              <td className="p-2 text-right numeric">₹{row.cash}</td>
                              <td className="p-2 text-right numeric">₹{row.paytm}</td>
                              <td className="p-2 text-right numeric">₹{row.card}</td>
                              <td className="p-2 text-right font-black text-slate-900 numeric">₹{row.total}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot className="bg-amber-300 text-slate-900 font-black">
                        <tr>
                          <td colSpan="3" className="p-2 uppercase">TOTAL</td>
                          <td className="p-2 text-right numeric">₹{reportData.totals?.amt}</td>
                          <td className="p-2 text-right numeric">₹{reportData.totals?.gst}</td>
                          <td className="p-2 text-right numeric">₹{reportData.totals?.cash}</td>
                          <td className="p-2 text-right numeric">₹{reportData.totals?.paytm}</td>
                          <td className="p-2 text-right numeric">₹{reportData.totals?.card}</td>
                          <td className="p-2 text-right text-rose-700 numeric">₹{reportData.totals?.total}</td>
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
                              <span className="font-bold text-rose-600 numeric">₹{exp.amount}</span>
                            </div>
                          ))
                        )}
                        <div className="border-t border-slate-200 pt-2 flex justify-between font-black text-slate-900">
                          <span>TOTAL EXPENSES</span>
                          <span className="numeric">₹{reportData.total_expenses}</span>
                        </div>
                      </div>
                    </div>

                    {/* Summary Balance Box */}
                    <div className="bg-emerald-600 text-white p-3 rounded-2xl text-xs space-y-1 font-bold">
                      <div className="flex justify-between"><span>OPENING BAL :</span><span className="numeric">₹{reportData.balance?.opening_bal}</span></div>
                      <div className="flex justify-between text-rose-200"><span>* TOTAL SALE</span><span className="numeric">₹{reportData.balance?.total_sale}</span></div>
                      <div className="flex justify-between"><span>* CASH PAY</span><span className="numeric">₹{reportData.balance?.cash_pay}</span></div>
                      <div className="flex justify-between"><span>* PHONE PAY</span><span className="numeric">₹{reportData.balance?.phone_pay}</span></div>
                      <div className="flex justify-between"><span>* CARD</span><span className="numeric">₹{reportData.balance?.card}</span></div>
                      <div className="flex justify-between text-rose-200"><span>* EXPENSE</span><span className="numeric">₹{reportData.balance?.expense}</span></div>
                      <div className="border-t border-emerald-400 pt-1 flex justify-between text-sm font-black"><span>CLOSING BAL</span><span className="numeric">₹{reportData.balance?.closing_bal}</span></div>
                    </div>

                    {/* Cash Denomination Box */}
                    <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
                      <div className="bg-amber-300 text-slate-900 px-3 py-1.5 font-black uppercase text-center border-b border-amber-400">
                        CASH DENOMINATION
                      </div>
                      <div className="p-3 divide-y divide-slate-100 font-semibold text-slate-800">
                        {["500", "200", "100", "50", "20", "10", "5", "2", "1"].map((k) => (
                          <div key={k} className="py-1 flex justify-between">
                            <span className="numeric">₹{k}</span>
                            <span className="numeric">{reportData.cash_denomination?.[k] || 0}</span>
                            <span className="font-bold text-slate-900 numeric">₹{(parseInt(k, 10) * (reportData.cash_denomination?.[k] || 0))}</span>
                          </div>
                        ))}
                        <div className="pt-2 flex justify-between font-black text-emerald-700">
                          <span>RUNNING TOTAL</span>
                          <span className="numeric">₹{reportData.cash_denomination?.total || 0}</span>
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
                          <td className="p-2 text-slate-400 numeric">{st.sno}</td>
                          <td className="p-2 font-bold text-slate-900">{st.staff_name}</td>
                          <td className="p-2 text-right font-black text-emerald-600 numeric">₹{st.achieved}</td>
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
                          <td className="p-2 text-center text-slate-400 numeric">{row.sno}</td>
                          <td className="p-2 font-bold text-slate-900">{row.name}</td>
                          <td className="p-2 text-center font-bold text-indigo-600">{row.level}</td>
                          <td className="p-2 text-right numeric">₹{row.salary}</td>
                          <td className="p-2 text-right numeric">₹{row.target}</td>
                          <td className="p-2 text-right font-black text-rose-600 numeric">₹{row.achieved}</td>
                          <td className="p-2 text-right font-black text-rose-600 numeric">₹{row.with_gst}</td>
                          <td className="p-2 text-center font-bold numeric">{row.walkin}</td>
                          <td className="p-2 text-right font-bold text-slate-900 numeric">₹{row.abv.toFixed(2)}</td>
                          <td className="p-2 text-center font-extrabold text-emerald-600 numeric">{row.percentage.toFixed(1)}%</td>
                          <td className="p-2 text-center text-slate-400">{row.review}</td>
                          <td className="p-2 text-center text-slate-400 numeric">{row.mc}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-amber-300 text-slate-900 font-black uppercase">
                      <tr>
                        <td colSpan="5" className="p-2 text-right">TOTAL</td>
                        <td className="p-2 text-right text-rose-700 numeric">₹{reportData.totals?.achieved}</td>
                        <td className="p-2 text-right text-rose-700 numeric">₹{reportData.totals?.with_gst}</td>
                        <td className="p-2 text-center numeric">{reportData.totals?.walkin}</td>
                        <td colSpan="4"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Summary Boxes */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-bold">
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl space-y-1">
                    <div className="flex justify-between font-extrabold text-slate-900"><span>SALON SALES</span><span className="numeric">₹{reportData.summary?.salon_sales?.sales}</span></div>
                    <div className="flex justify-between text-slate-600"><span>WALK IN</span><span className="numeric">{reportData.summary?.salon_sales?.walkin}</span></div>
                    <div className="flex justify-between text-slate-600"><span>ABV</span><span className="numeric">₹{reportData.summary?.salon_sales?.abv?.toFixed(2)}</span></div>
                    <div className="flex justify-between text-emerald-700"><span>WITH GST</span><span className="numeric">₹{reportData.summary?.salon_sales?.with_gst}</span></div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl space-y-1">
                    <div className="flex justify-between font-extrabold text-blue-900"><span>MALE SALES</span><span className="numeric">₹{reportData.summary?.male_sales?.sales}</span></div>
                    <div className="flex justify-between text-slate-600"><span>WALK IN</span><span className="numeric">{reportData.summary?.male_sales?.walkin}</span></div>
                    <div className="flex justify-between text-slate-600"><span>ABV</span><span className="numeric">₹{reportData.summary?.male_sales?.abv?.toFixed(2)}</span></div>
                  </div>

                  <div className="bg-pink-50 border border-pink-200 p-4 rounded-2xl space-y-1">
                    <div className="flex justify-between font-extrabold text-pink-900"><span>FEMALE SALES</span><span className="numeric">₹{reportData.summary?.female_sales?.sales}</span></div>
                    <div className="flex justify-between text-slate-600"><span>WALK IN</span><span className="numeric">{reportData.summary?.female_sales?.walkin}</span></div>
                    <div className="flex justify-between text-slate-600"><span>ABV</span><span className="numeric">₹{reportData.summary?.female_sales?.abv?.toFixed(2)}</span></div>
                  </div>
                </div>

                {/* Per-Branch Staff Revenue Breakdown (For Multi-Branch Staff e.g. SAM) */}
                {(reportData.staff_performance || []).some((st) => (st.branch_breakdown || []).length > 1) && (
                  <div className="space-y-4 pt-4 border-t border-slate-200">
                    <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">Multi-Branch Staff Revenue Breakdown</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {(reportData.staff_performance || [])
                        .filter((st) => (st.branch_breakdown || []).length > 0)
                        .map((st) => (
                          <div key={st.id} className="bg-white border border-amber-300 rounded-2xl p-3 text-xs space-y-2 shadow-xs">
                            <div className="bg-amber-300 text-slate-900 font-extrabold px-2 py-1 rounded-xl text-center uppercase tracking-wide">
                              {st.name}
                            </div>
                            <div className="divide-y divide-slate-100 font-semibold">
                              {(st.branch_breakdown || []).map((bb) => (
                                <div key={bb.branch_id} className="py-1 flex justify-between items-center text-slate-700">
                                  <span>{bb.branch_name}</span>
                                  <span className="font-extrabold text-slate-900 numeric">₹{bb.achieved.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                            <div className="pt-1.5 border-t border-slate-200 flex justify-between font-black text-rose-700">
                              <span>TOTAL</span>
                              <span className="numeric">₹{st.achieved.toFixed(2)}</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
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
                            <th key={d.day} className="p-1 border-l border-slate-200 numeric">{d.day}</th>
                          ))}
                          <th className="p-1 border-l border-slate-200 font-black">TOTAL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold">
                        {(reportData.attendance_matrix || []).map((row) => (
                          <tr key={row.sno} className="hover:bg-slate-50">
                            <td className="p-1 text-left text-slate-400 numeric">{row.sno}</td>
                            <td className="p-1 text-left font-bold text-slate-900">{row.name}</td>
                            {(reportData.days_in_month || []).map((d) => {
                              const val = row.days?.[String(d.day)] || "";
                              return (
                                <td
                                  key={d.day}
                                  className={`p-1 border-l border-slate-200 font-bold numeric ${
                                    val === "OFF"
                                      ? "bg-emerald-600 text-white"
                                      : val === "L"
                                      ? "bg-rose-600 text-white font-black"
                                      : val === "0.5"
                                      ? "bg-amber-400 text-slate-900"
                                      : val === "1"
                                      ? "text-slate-800"
                                      : "text-slate-300 font-normal"
                                  }`}
                                >
                                  {val || "—"}
                                </td>
                              );
                            })}
                            <td className="p-1 border-l border-slate-200 font-black text-slate-900 numeric">{row.total_days}</td>
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
                            <td className="p-2 text-right numeric">₹{sal.salary}</td>
                            <td className="p-2 text-right font-bold numeric">₹{sal.net.toFixed(2)}</td>
                            <td className="p-2 text-right font-bold text-emerald-600 numeric">₹{sal.advance}</td>
                            <td className="p-2 text-right font-bold text-rose-600 numeric">₹{sal.less_amount}</td>
                            <td className="p-2 text-right font-black text-emerald-700 numeric">₹{sal.amount.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-amber-300 text-slate-900 font-black uppercase text-xs">
                        <tr>
                          <td className="p-2">TOTAL</td>
                          <td className="p-2 text-right numeric">₹{reportData.totals?.salary}</td>
                          <td className="p-2 text-right numeric">₹{reportData.totals?.net?.toFixed(2)}</td>
                          <td className="p-2 text-right numeric">₹{reportData.totals?.advance}</td>
                          <td className="p-2 text-right numeric">₹{reportData.totals?.less_amount}</td>
                          <td className="p-2 text-right text-emerald-800 numeric">₹{reportData.totals?.amount?.toFixed(2)}</td>
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
