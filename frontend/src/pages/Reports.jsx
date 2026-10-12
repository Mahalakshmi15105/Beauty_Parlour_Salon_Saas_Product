import React, { useState, useEffect, useRef } from "react";
import API from "../services/api";
import { useToast } from "../context/ToastContext";
import { useLanguageCurrency } from "../context/LanguageCurrencyContext";
import { useTheme } from "../context/ThemeContext";
import { exportToCSV, printDataList, exportToPDF, exportToExcel } from "../utils/exportUtils";
import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";
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
  DollarSign,
  Edit2,
  Check,
  X
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
  const [exportingPdf, setExportingPdf] = useState(false);
  const reportCanvasRef = useRef(null);

  // Daily Sales Statement Opening Balance manual editing
  const [isEditingOpening, setIsEditingOpening] = useState(false);
  const [editOpeningVal, setEditOpeningVal] = useState("");
  const [savingOpening, setSavingOpening] = useState(false);

  const handleSaveOpeningBalance = async () => {
    const num = parseFloat(editOpeningVal);
    if (isNaN(num)) {
      showError("Please enter a valid numeric opening balance.");
      return;
    }
    setSavingOpening(true);
    try {
      await API.post("/reports/daily-sales-statement/opening-balance", {
        date: selectedDate,
        opening_balance: num
      });
      showSuccess("Opening balance updated! Closing balance recalculated.");
      setIsEditingOpening(false);
      fetchReport();
    } catch (err) {
      showError(err?.response?.data?.message || err?.message || "Failed to update opening balance.");
    } finally {
      setSavingOpening(false);
    }
  };

  const fetchReport = () => {
    setIsEditingOpening(false);
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
        const payload = res?.data !== undefined ? res.data : res;
        setReportData(payload || null);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load report data.");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, selectedDate, selectedMonth, selectedYear, preset, startDate, endDate]);

  // PDF Export Handler for Daily Sales Statement + All Reports
  const handleExportCustomPDF = async () => {
    if (!reportData) return showError("No report data available to export.");
    if (!reportCanvasRef.current) return showError("Report view not ready to capture.");

    setExportingPdf(true);
    try {
      // 1. Determine clean filename based on report type and filters
      let filename = "salon_report";
      if (reportType === "daily_sales_statement") {
        const dStr = (reportData.date_str || selectedDate || "").replace(/[^a-zA-Z0-9_-]/g, "_");
        filename = `daily_sales_statement_${dStr}`;
      } else if (reportType === "monthly_staff_performance") {
        filename = `monthly_staff_performance_${selectedMonth}_${selectedYear}`;
      } else if (reportType === "attendance_salary") {
        filename = `attendance_salary_report_${selectedMonth}_${selectedYear}`;
      } else {
        filename = `${reportType}_report_${preset}`;
      }

      const element = reportCanvasRef.current;

      // 2. High-DPI canvas capture using html2canvas
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: 1280
      });

      const imgData = canvas.toDataURL("image/png");

      // 3. Dynamic orientation (Landscape if wide, portrait if tall)
      const isLandscape = canvas.width > canvas.height * 1.15;
      const pdf = new jsPDF(isLandscape ? "l" : "p", "mm", "a4");
      const pageWidth = isLandscape ? 297 : 210;
      const pageHeight = isLandscape ? 210 : 297;
      const margin = 8;
      const contentWidth = pageWidth - (margin * 2);
      const contentHeight = (canvas.height * contentWidth) / canvas.width;
      const maxPageContentHeight = pageHeight - (margin * 2);

      if (contentHeight <= maxPageContentHeight) {
        // Fits entirely on a single page
        pdf.addImage(imgData, "PNG", margin, margin, contentWidth, contentHeight);
      } else {
        // Multi-page slicing for longer reports
        let yOffset = 0;
        const pageCanvasHeight = (maxPageContentHeight * canvas.width) / contentWidth;

        while (yOffset < canvas.height) {
          const pageCanvas = document.createElement("canvas");
          pageCanvas.width = canvas.width;
          const currentSliceHeight = Math.min(pageCanvasHeight, canvas.height - yOffset);
          pageCanvas.height = currentSliceHeight;

          const ctx = pageCanvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(
            canvas,
            0, yOffset, canvas.width, currentSliceHeight,
            0, 0, pageCanvas.width, currentSliceHeight
          );

          const sliceImgData = pageCanvas.toDataURL("image/png");
          const sliceImgHeight = (currentSliceHeight * contentWidth) / canvas.width;

          if (yOffset > 0) {
            pdf.addPage();
          }
          pdf.addImage(sliceImgData, "PNG", margin, margin, contentWidth, sliceImgHeight);

          yOffset += pageCanvasHeight;
        }
      }

      pdf.save(`${filename}.pdf`);
      showSuccess("PDF report generated and downloaded successfully!");
    } catch (err) {
      console.error("PDF export error:", err);
      showError(err?.message || "Failed to generate PDF report.");
    } finally {
      setExportingPdf(false);
    }
  };

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

      const totalCols = 2 + numDays + 1 + 1 + 12; // Attendance + Gap + Salary

      const headerRow = ["S.NO", "NAME", ...days.map((day) => `Day ${day.day}`), "TOTAL DAYS", "", "S.NO", "NAME", "SALARY", "PER DAY", "TARGET", "ACHIEVED", "OFF", "TOTAL DAYS", "NET", "ADVANCE", "LESS AMOUNT", "AMOUNT"];

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
        const dayCells = days.map((day) => {
          const val = att.days ? att.days[String(day.day)] || "" : "";
          return val === "1" ? "P" : val;
        });

        wsData.push([
          att.sno || "",
          att.name || "",
          ...dayCells,
          att.total_days !== undefined ? att.total_days : "",
          "",
          sal.sno || "",
          sal.name || "",
          sal.salary !== undefined ? sal.salary : "",
          sal.per_day !== undefined ? Number(sal.per_day).toFixed(2) : "",
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
      wsData.push(["TOTAL", "", ...days.map(() => ""), "", "", "", "TOTAL", d.totals?.salary || 0, Number(d.totals?.per_day || 0).toFixed(2), d.totals?.target || 0, d.totals?.achieved || 0, "", "", Number(d.totals?.net || 0).toFixed(2), d.totals?.advance || 0, d.totals?.less_amount || 0, Number(d.totals?.amount || 0).toFixed(2)]);

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
    } else if (reportType === "sales") {
      const d = reportData || {};
      const items = d.items || [];
      if (items.length === 0) return showError("No sales transactions found to export.");
      const columns = [
        { header: "INVOICE NO", accessor: "invoice_number" },
        { header: "DATE", accessor: "date" },
        { header: "CUSTOMER", accessor: "customer_name" },
        { header: "SUBTOTAL", accessor: "subtotal" },
        { header: "DISCOUNT", accessor: "discount" },
        { header: "TAX (GST)", accessor: "tax" },
        { header: "TOTAL", accessor: "total" },
        { header: "STATUS", accessor: "status" },
      ];
      exportToExcel("FINANCIAL LEDGER REPORT", items, columns, "financial_ledger_report", d.parlour_name || "Salon");
    } else if (reportType === "tax") {
      const d = reportData || {};
      const logs = d.daily_tax_logs || [];
      if (logs.length === 0) return showError("No tax records found to export.");
      const columns = [
        { header: "DATE", accessor: "date" },
        { header: "GROSS SUBTOTAL", accessor: "gross_subtotal" },
        { header: "DISCOUNT", accessor: "discount" },
        { header: "TAX COLLECTED (GST)", accessor: "tax_collected" },
        { header: "NET TOTAL", accessor: "net_total" },
      ];
      exportToExcel("TAX RECONCILIATION REPORT", logs, columns, "tax_reconciliation_report", d.parlour_name || "Salon");
    } else if (reportType === "employees") {
      const items = Array.isArray(reportData) ? reportData : [];
      if (items.length === 0) return showError("No staff commission data to export.");
      const columns = [
        { header: "STAFF NAME", accessor: "name" },
        { header: "SERVICES RENDERED", accessor: "services_rendered" },
        { header: "COMMISSION %", accessor: "commission_percentage" },
        { header: "TOTAL REVENUE", accessor: "total_revenue" },
        { header: "ESTIMATED COMMISSION", accessor: "estimated_commission" },
      ];
      exportToExcel("STAFF COMMISSIONS REPORT", items, columns, "staff_commissions_report", "Salon");
    } else if (reportType === "products") {
      const items = Array.isArray(reportData) ? reportData : [];
      if (items.length === 0) return showError("No product performance data to export.");
      const columns = [
        { header: "PRODUCT NAME", accessor: "name" },
        { header: "SKU", accessor: "sku" },
        { header: "SELLING PRICE", accessor: "selling_price" },
        { header: "IN STOCK", accessor: "stock_quantity" },
        { header: "UNITS SOLD", accessor: "units_sold" },
        { header: "TOTAL SALES", accessor: "total_sales" },
      ];
      exportToExcel("PRODUCT PERFORMANCE REPORT", items, columns, "product_performance_report", "Salon");
    } else {
      // Standard reports fallback
      const dataArr = Array.isArray(reportData) ? reportData : (reportData.items || reportData.daily_tax_logs || []);
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
            <div className="flex flex-wrap items-center gap-3">
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
                  <option value="custom">Custom Date Range</option>
                </select>
              </div>

              {preset === "custom" && (
                <div className="flex items-center space-x-3 bg-pink-50/50 p-1.5 rounded-xl border border-pink-100">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-bold text-slate-700">From:</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-white border border-pink-200 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-pink-500"
                    />
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="font-bold text-slate-700">To:</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-white border border-pink-200 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-pink-500"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Export Action Buttons: PDF & Excel */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* PDF Export Button */}
          <button
            onClick={handleExportCustomPDF}
            disabled={exportingPdf || loading || !reportData}
            className="flex-1 sm:flex-none justify-center bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-2 transition shadow-md disabled:opacity-50 cursor-pointer"
            title="Download formatted report as PDF"
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span>{exportingPdf ? "Generating PDF..." : "Download PDF"}</span>
          </button>

          {/* Excel Export Button */}
          <button
            onClick={handleExportCustomExcel}
            disabled={loading || !reportData}
            className="flex-1 sm:flex-none justify-center bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-2 transition shadow-md disabled:opacity-50 cursor-pointer"
            title="Download report as Excel spreadsheet (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4 shrink-0" />
            <span>Download Excel</span>
          </button>
        </div>
      </div>

      {/* Segmented Sub-Tabs */}
      <div className="flex items-center gap-2 bg-white/60 backdrop-blur-md border border-pink-100/60 p-2 sm:p-2.5 rounded-2xl shadow-xs overflow-x-auto scrollbar-none">
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
              className={`px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-extrabold transition flex items-center space-x-2 shrink-0 whitespace-nowrap ${
                reportType === tab.id
                  ? "glowe-pink-gradient text-white shadow-md"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
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
          <div ref={reportCanvasRef} className="bg-white">
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
                    <div className="overflow-x-auto w-full">
                      <table className="w-full text-left text-xs border-collapse min-w-[550px]">
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
                              <td className="p-2 text-right numeric">₹{Math.round(row.amt || 0)}</td>
                              <td className="p-2 text-right numeric">₹{Math.round(row.gst || 0)}</td>
                              <td className="p-2 text-right numeric">₹{Math.round(row.cash || 0)}</td>
                              <td className="p-2 text-right numeric">₹{Math.round(row.paytm || 0)}</td>
                              <td className="p-2 text-right numeric">₹{Math.round(row.card || 0)}</td>
                              <td className="p-2 text-right font-black text-slate-900 numeric">₹{Math.round(row.total || 0)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot className="bg-amber-300 text-slate-900 font-black">
                        <tr>
                          <td colSpan="3" className="p-2 uppercase">TOTAL</td>
                          <td className="p-2 text-right numeric">₹{Math.round(reportData.totals?.amt || 0)}</td>
                          <td className="p-2 text-right numeric">₹{Math.round(reportData.totals?.gst || 0)}</td>
                          <td className="p-2 text-right numeric">₹{Math.round(reportData.totals?.cash || 0)}</td>
                          <td className="p-2 text-right numeric">₹{Math.round(reportData.totals?.paytm || 0)}</td>
                          <td className="p-2 text-right numeric">₹{Math.round(reportData.totals?.card || 0)}</td>
                          <td className="p-2 text-right text-rose-700 numeric">₹{Math.round(reportData.totals?.total || 0)}</td>
                        </tr>
                      </tfoot>
                    </table>
                    </div>
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
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                          <span>OPENING BAL :</span>
                          {!isEditingOpening && (
                            <button
                              type="button"
                              data-html2canvas-ignore="true"
                              onClick={() => {
                                setEditOpeningVal(reportData.balance?.opening_bal ?? "");
                                setIsEditingOpening(true);
                              }}
                              title="Edit Opening Balance"
                              className="text-emerald-200 hover:text-white transition-colors p-0.5 rounded hover:bg-emerald-700/60"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {isEditingOpening ? (
                          <div className="flex items-center gap-1">
                            <span className="text-white text-xs">₹</span>
                            <input
                              type="number"
                              value={editOpeningVal}
                              onChange={(e) => setEditOpeningVal(e.target.value)}
                              className="w-20 px-1.5 py-0.5 rounded bg-white text-slate-900 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-emerald-300"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveOpeningBalance();
                                if (e.key === "Escape") setIsEditingOpening(false);
                              }}
                            />
                            <button
                              type="button"
                              onClick={handleSaveOpeningBalance}
                              disabled={savingOpening}
                              title="Save"
                              className="p-1 rounded bg-emerald-700 hover:bg-emerald-800 text-white"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsEditingOpening(false)}
                              title="Cancel"
                              className="p-1 rounded bg-rose-600/80 hover:bg-rose-700 text-white"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="numeric">₹{Math.round(reportData.balance?.opening_bal || 0)}</span>
                            {reportData.balance?.is_manual_opening && (
                              <span className="text-[10px] bg-emerald-700/80 text-emerald-100 px-1.5 py-0.2 rounded font-normal" title="Manually edited">
                                edited
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex justify-between text-rose-200"><span>* TOTAL SALE</span><span className="numeric">₹{Math.round(reportData.balance?.total_sale || 0)}</span></div>
                      <div className="flex justify-between"><span>* CASH PAY</span><span className="numeric">₹{Math.round(reportData.balance?.cash_pay || 0)}</span></div>
                      <div className="flex justify-between"><span>* PHONE PAY</span><span className="numeric">₹{Math.round(reportData.balance?.phone_pay || 0)}</span></div>
                      <div className="flex justify-between"><span>* CARD</span><span className="numeric">₹{Math.round(reportData.balance?.card || 0)}</span></div>
                      <div className="flex justify-between text-rose-200"><span>* EXPENSE</span><span className="numeric">₹{Math.round(reportData.balance?.expense || 0)}</span></div>
                      <div className="border-t border-emerald-400 pt-1 flex justify-between text-sm font-black"><span>CLOSING BAL</span><span className="numeric">₹{Math.round(reportData.balance?.closing_bal || 0)}</span></div>
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
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-xs text-left min-w-[260px]">
                      <thead className="bg-slate-50 font-bold text-slate-700">
                        <tr><th className="p-2">S.NO</th><th className="p-2">STAFF NAME</th><th className="p-2 text-right">ACHIEVED</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold">
                        {(reportData.staff_achieved || []).map((st) => (
                          <tr key={st.sno}>
                            <td className="p-2 text-slate-400 numeric">{st.sno}</td>
                            <td className="p-2 font-bold text-slate-900">{st.staff_name}</td>
                            <td className="p-2 text-right font-black text-emerald-600 numeric">₹{Math.round(st.achieved || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-left text-xs border-collapse min-w-[700px]">
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
                          <th className="p-1 border-l border-slate-200 font-black text-rose-600 min-w-[50px]">OFF USED</th>
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
                                    val === "OFF" || val === "F"
                                      ? "bg-emerald-600 text-white font-bold"
                                      : val === "2L"
                                      ? "bg-purple-700 text-white font-black"
                                      : val === "L"
                                      ? "bg-rose-600 text-white font-black"
                                      : val === "0.5"
                                      ? "bg-amber-400 text-slate-900 font-bold"
                                      : val === "1"
                                      ? "text-slate-800"
                                      : "text-slate-300 font-normal"
                                  }`}
                                >
                                  {val === "1" ? "P" : (val || "—")}
                                </td>
                              );
                            })}
                            <td className="p-1 border-l border-slate-200 font-black text-slate-900 numeric">{row.total_days}</td>
                            <td className="p-1 border-l border-slate-200 font-black text-rose-600 numeric">
                              {row.leaves_summary || `${row.leaves_taken || 0}/${row.allowed_offs || 4}`}
                            </td>
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
                          <th className="p-2 text-right text-sky-700 font-black">PER DAY</th>
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
                            <td className="p-2 text-right font-bold text-sky-700 numeric">₹{sal.per_day !== undefined ? Number(sal.per_day).toFixed(2) : "0.00"}</td>
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
                          <td className="p-2 text-right text-sky-800 font-black numeric">₹{reportData.totals?.per_day !== undefined ? Number(reportData.totals?.per_day).toFixed(2) : "0.00"}</td>
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

            {/* 4. FINANCIAL LEDGER REPORT */}
            {reportType === "sales" && (
              <div className="p-6 space-y-6">
                {/* Summary Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl space-y-1">
                    <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">Total Sales Revenue</p>
                    <p className="text-xl font-black text-emerald-700 numeric">₹{(reportData.summary?.total_sales || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                    <p className="text-[10px] text-emerald-600 font-semibold">{reportData.summary?.total_orders || 0} Invoices Generated</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl space-y-1">
                    <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wide">Total Tax (GST)</p>
                    <p className="text-xl font-black text-amber-700 numeric">₹{(reportData.summary?.total_tax || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                    <p className="text-[10px] text-amber-600 font-semibold">Collected on Invoices</p>
                  </div>
                  <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl space-y-1">
                    <p className="text-[11px] font-bold text-rose-800 uppercase tracking-wide">Total Discounts Given</p>
                    <p className="text-xl font-black text-rose-700 numeric">₹{(reportData.summary?.total_discount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                    <p className="text-[10px] text-rose-600 font-semibold">Promotional & Custom</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl space-y-1">
                    <p className="text-[11px] font-bold text-blue-800 uppercase tracking-wide">Total Invoices</p>
                    <p className="text-xl font-black text-blue-700 numeric">{reportData.summary?.total_orders || 0}</p>
                    <p className="text-[10px] text-blue-600 font-semibold">Completed Billings</p>
                  </div>
                </div>

                {/* Ledger Transactions Table */}
                <div className="border border-slate-200 rounded-2xl overflow-x-auto">
                  <div className="bg-pink-600 text-white py-2.5 px-4 flex justify-between items-center text-xs font-black tracking-wider uppercase">
                    <span>FINANCIAL LEDGER TRANSACTIONS</span>
                    <span>PERIOD: {preset.toUpperCase()}</span>
                  </div>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
                        <th className="p-3 text-center">S.NO</th>
                        <th className="p-3">INVOICE NO</th>
                        <th className="p-3">DATE & TIME</th>
                        <th className="p-3">CUSTOMER</th>
                        <th className="p-3 text-right">SUBTOTAL</th>
                        <th className="p-3 text-right">DISCOUNT</th>
                        <th className="p-3 text-right">TAX (GST)</th>
                        <th className="p-3 text-right font-black">TOTAL</th>
                        <th className="p-3 text-center">STATUS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                      {(reportData.items || []).length === 0 ? (
                        <tr><td colSpan="9" className="p-8 text-center text-slate-400 font-bold">No sales records found for this period.</td></tr>
                      ) : (
                        (reportData.items || []).map((row, idx) => (
                          <tr key={row.id || idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 text-center text-slate-400 numeric">{idx + 1}</td>
                            <td className="p-3 font-bold text-pink-600">{row.invoice_number}</td>
                            <td className="p-3 text-slate-600">{row.date}</td>
                            <td className="p-3 font-bold text-slate-900">{row.customer_name}</td>
                            <td className="p-3 text-right numeric">₹{(row.subtotal || 0).toFixed(2)}</td>
                            <td className="p-3 text-right text-rose-600 numeric">₹{(row.discount || 0).toFixed(2)}</td>
                            <td className="p-3 text-right text-amber-700 numeric">₹{(row.tax || 0).toFixed(2)}</td>
                            <td className="p-3 text-right font-black text-emerald-700 numeric">₹{(row.total || 0).toFixed(2)}</td>
                            <td className="p-3 text-center">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                                row.status === "Paid"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : row.status === "Pending"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}>
                                {row.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="bg-amber-300 text-slate-900 font-black uppercase">
                      <tr>
                        <td colSpan="4" className="p-3">TOTAL SUMMARY</td>
                        <td className="p-3 text-right numeric">
                          ₹{(reportData.items || []).reduce((acc, r) => acc + (r.subtotal || 0), 0).toFixed(2)}
                        </td>
                        <td className="p-3 text-right text-rose-700 numeric">
                          ₹{(reportData.summary?.total_discount || 0).toFixed(2)}
                        </td>
                        <td className="p-3 text-right text-slate-900 numeric">
                          ₹{(reportData.summary?.total_tax || 0).toFixed(2)}
                        </td>
                        <td className="p-3 text-right text-emerald-900 numeric">
                          ₹{(reportData.summary?.total_sales || 0).toFixed(2)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* 5. TAX RECONCILIATION REPORT */}
            {reportType === "tax" && (
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl space-y-1">
                    <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wide">Total GST Collected</p>
                    <p className="text-xl font-black text-amber-700 numeric">₹{(reportData.total_tax_collected || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                    <p className="text-[10px] text-amber-600 font-semibold">Government Tax Liability</p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl space-y-1">
                    <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">Gross Taxable Revenue</p>
                    <p className="text-xl font-black text-emerald-700 numeric">
                      ₹{(reportData.daily_tax_logs || []).reduce((acc, r) => acc + (r.gross_subtotal || 0), 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-emerald-600 font-semibold">Pre-Tax Turnover</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl space-y-1">
                    <p className="text-[11px] font-bold text-blue-800 uppercase tracking-wide">Net Invoiced Total</p>
                    <p className="text-xl font-black text-blue-700 numeric">
                      ₹{(reportData.daily_tax_logs || []).reduce((acc, r) => acc + (r.net_total || 0), 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-blue-600 font-semibold">Net Realized Value</p>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-x-auto">
                  <div className="bg-amber-500 text-slate-900 py-2.5 px-4 flex justify-between items-center text-xs font-black tracking-wider uppercase">
                    <span>DAILY TAX (GST) AUDIT LOG</span>
                    <span>PERIOD: {preset.toUpperCase()}</span>
                  </div>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
                        <th className="p-3 text-center">S.NO</th>
                        <th className="p-3">DATE</th>
                        <th className="p-3 text-right">GROSS SUBTOTAL</th>
                        <th className="p-3 text-right">DISCOUNT</th>
                        <th className="p-3 text-right font-bold text-amber-800">TAX (GST) COLLECTED</th>
                        <th className="p-3 text-right font-black">NET TOTAL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                      {(reportData.daily_tax_logs || []).length === 0 ? (
                        <tr><td colSpan="6" className="p-8 text-center text-slate-400 font-bold">No tax logs found for this period.</td></tr>
                      ) : (
                        (reportData.daily_tax_logs || []).map((row, idx) => (
                          <tr key={row.date || idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 text-center text-slate-400 numeric">{idx + 1}</td>
                            <td className="p-3 font-bold text-slate-900">{row.date}</td>
                            <td className="p-3 text-right numeric">₹{(row.gross_subtotal || 0).toFixed(2)}</td>
                            <td className="p-3 text-right text-rose-600 numeric">₹{(row.discount || 0).toFixed(2)}</td>
                            <td className="p-3 text-right font-bold text-amber-700 numeric">₹{(row.tax_collected || 0).toFixed(2)}</td>
                            <td className="p-3 text-right font-black text-emerald-700 numeric">₹{(row.net_total || 0).toFixed(2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="bg-amber-300 text-slate-900 font-black uppercase">
                      <tr>
                        <td colSpan="2" className="p-3">TOTAL</td>
                        <td className="p-3 text-right numeric">
                          ₹{(reportData.daily_tax_logs || []).reduce((acc, r) => acc + (r.gross_subtotal || 0), 0).toFixed(2)}
                        </td>
                        <td className="p-3 text-right text-rose-700 numeric">
                          ₹{(reportData.daily_tax_logs || []).reduce((acc, r) => acc + (r.discount || 0), 0).toFixed(2)}
                        </td>
                        <td className="p-3 text-right text-amber-900 numeric">
                          ₹{(reportData.total_tax_collected || 0).toFixed(2)}
                        </td>
                        <td className="p-3 text-right text-emerald-900 numeric">
                          ₹{(reportData.daily_tax_logs || []).reduce((acc, r) => acc + (r.net_total || 0), 0).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* 6. STAFF COMMISSIONS REPORT */}
            {reportType === "employees" && (
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-2xl space-y-1">
                    <p className="text-[11px] font-bold text-indigo-800 uppercase tracking-wide">Total Staff Revenue</p>
                    <p className="text-xl font-black text-indigo-700 numeric">
                      ₹{(Array.isArray(reportData) ? reportData : []).reduce((acc, r) => acc + (r.total_revenue || 0), 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-indigo-600 font-semibold">Service Value Delivered</p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl space-y-1">
                    <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">Total Commission Payout</p>
                    <p className="text-xl font-black text-emerald-700 numeric">
                      ₹{(Array.isArray(reportData) ? reportData : []).reduce((acc, r) => acc + (r.estimated_commission || 0), 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-emerald-600 font-semibold">Estimated Staff Commission</p>
                  </div>
                  <div className="bg-pink-50 border border-pink-200 p-4 rounded-2xl space-y-1">
                    <p className="text-[11px] font-bold text-pink-800 uppercase tracking-wide">Total Services Rendered</p>
                    <p className="text-xl font-black text-pink-700 numeric">
                      {(Array.isArray(reportData) ? reportData : []).reduce((acc, r) => acc + (r.services_rendered || 0), 0)}
                    </p>
                    <p className="text-[10px] text-pink-600 font-semibold">Completed Service Count</p>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-x-auto">
                  <div className="bg-indigo-600 text-white py-2.5 px-4 flex justify-between items-center text-xs font-black tracking-wider uppercase">
                    <span>STAFF PERFORMANCE & COMMISSIONS</span>
                    <span>PERIOD: {preset.toUpperCase()}</span>
                  </div>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
                        <th className="p-3 text-center">S.NO</th>
                        <th className="p-3">STAFF NAME</th>
                        <th className="p-3 text-center">SERVICES RENDERED</th>
                        <th className="p-3 text-center">COMMISSION %</th>
                        <th className="p-3 text-right">TOTAL REVENUE</th>
                        <th className="p-3 text-right font-black text-emerald-700">ESTIMATED COMMISSION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                      {(Array.isArray(reportData) ? reportData : []).length === 0 ? (
                        <tr><td colSpan="6" className="p-8 text-center text-slate-400 font-bold">No staff commission records for this period.</td></tr>
                      ) : (
                        (Array.isArray(reportData) ? reportData : []).map((row, idx) => (
                          <tr key={row.employee_id || idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 text-center text-slate-400 numeric">{idx + 1}</td>
                            <td className="p-3 font-bold text-slate-900">{row.name}</td>
                            <td className="p-3 text-center font-bold text-blue-600 numeric">{row.services_rendered}</td>
                            <td className="p-3 text-center font-extrabold text-amber-600 numeric">{row.commission_percentage}%</td>
                            <td className="p-3 text-right numeric">₹{(row.total_revenue || 0).toFixed(2)}</td>
                            <td className="p-3 text-right font-black text-emerald-600 numeric">₹{(row.estimated_commission || 0).toFixed(2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="bg-amber-300 text-slate-900 font-black uppercase">
                      <tr>
                        <td colSpan="2" className="p-3">TOTAL</td>
                        <td className="p-3 text-center numeric">
                          {(Array.isArray(reportData) ? reportData : []).reduce((acc, r) => acc + (r.services_rendered || 0), 0)}
                        </td>
                        <td></td>
                        <td className="p-3 text-right numeric">
                          ₹{(Array.isArray(reportData) ? reportData : []).reduce((acc, r) => acc + (r.total_revenue || 0), 0).toFixed(2)}
                        </td>
                        <td className="p-3 text-right text-emerald-900 numeric">
                          ₹{(Array.isArray(reportData) ? reportData : []).reduce((acc, r) => acc + (r.estimated_commission || 0), 0).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* 7. PRODUCT PERFORMANCE REPORT */}
            {reportType === "products" && (
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl space-y-1">
                    <p className="text-[11px] font-bold text-rose-800 uppercase tracking-wide">Total Retail Sales</p>
                    <p className="text-xl font-black text-rose-700 numeric">
                      ₹{(Array.isArray(reportData) ? reportData : []).reduce((acc, r) => acc + (r.total_sales || 0), 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-rose-600 font-semibold">Retail Turnover</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl space-y-1">
                    <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wide">Total Units Sold</p>
                    <p className="text-xl font-black text-amber-700 numeric">
                      {(Array.isArray(reportData) ? reportData : []).reduce((acc, r) => acc + (r.units_sold || 0), 0)}
                    </p>
                    <p className="text-[10px] text-amber-600 font-semibold">Products Sold</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl space-y-1">
                    <p className="text-[11px] font-bold text-blue-800 uppercase tracking-wide">Products In Catalog</p>
                    <p className="text-xl font-black text-blue-700 numeric">
                      {(Array.isArray(reportData) ? reportData : []).length}
                    </p>
                    <p className="text-[10px] text-blue-600 font-semibold">Active Inventory Lines</p>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-x-auto">
                  <div className="bg-rose-600 text-white py-2.5 px-4 flex justify-between items-center text-xs font-black tracking-wider uppercase">
                    <span>PRODUCT PERFORMANCE & SALES LEDGER</span>
                    <span>PERIOD: {preset.toUpperCase()}</span>
                  </div>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
                        <th className="p-3 text-center">S.NO</th>
                        <th className="p-3">PRODUCT NAME</th>
                        <th className="p-3">SKU</th>
                        <th className="p-3 text-right">SELLING PRICE</th>
                        <th className="p-3 text-center">IN STOCK</th>
                        <th className="p-3 text-center font-bold text-amber-700">UNITS SOLD</th>
                        <th className="p-3 text-right font-black text-emerald-700">TOTAL SALES</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                      {(Array.isArray(reportData) ? reportData : []).length === 0 ? (
                        <tr><td colSpan="7" className="p-8 text-center text-slate-400 font-bold">No product performance records found.</td></tr>
                      ) : (
                        (Array.isArray(reportData) ? reportData : []).map((row, idx) => (
                          <tr key={row.id || idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 text-center text-slate-400 numeric">{idx + 1}</td>
                            <td className="p-3 font-bold text-slate-900">{row.name}</td>
                            <td className="p-3 font-mono text-slate-500 text-[11px]">{row.sku || "—"}</td>
                            <td className="p-3 text-right numeric">₹{(row.selling_price || 0).toFixed(2)}</td>
                            <td className="p-3 text-center font-bold numeric">{row.stock_quantity ?? 0}</td>
                            <td className="p-3 text-center font-extrabold text-amber-600 numeric">{row.units_sold || 0}</td>
                            <td className="p-3 text-right font-black text-emerald-700 numeric">₹{(row.total_sales || 0).toFixed(2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="bg-amber-300 text-slate-900 font-black uppercase">
                      <tr>
                        <td colSpan="4" className="p-3">TOTAL</td>
                        <td></td>
                        <td className="p-3 text-center numeric">
                          {(Array.isArray(reportData) ? reportData : []).reduce((acc, r) => acc + (r.units_sold || 0), 0)}
                        </td>
                        <td className="p-3 text-right text-emerald-900 numeric">
                          ₹{(Array.isArray(reportData) ? reportData : []).reduce((acc, r) => acc + (r.total_sales || 0), 0).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Reports;
