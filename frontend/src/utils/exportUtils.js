import jsPDF from "jspdf";
import XLSX from "xlsx-js-style";

// Color Palette Constants for Excel Styling
export const EXCEL_COLORS = {
  PINK_HEADER: "FF758F",
  GREEN_BANNER: "0F9D58",
  YELLOW_ACCENT: "F59E0B",
  LIGHT_YELLOW: "FEF3C7",
  LIGHT_GRAY: "F8FAFC",
  DARK_TEXT: "1E293B",
  WHITE_TEXT: "FFFFFF",
  BORDER_COLOR: "CBD5E1"
};

export const STANDARD_BORDER = {
  top: { style: "thin", color: { rgb: EXCEL_COLORS.BORDER_COLOR } },
  bottom: { style: "thin", color: { rgb: EXCEL_COLORS.BORDER_COLOR } },
  left: { style: "thin", color: { rgb: EXCEL_COLORS.BORDER_COLOR } },
  right: { style: "thin", color: { rgb: EXCEL_COLORS.BORDER_COLOR } }
};

export function styleCell(ws, r, c, styleObj = {}) {
  const cellRef = XLSX.utils.encode_cell({ r, c });
  if (!ws[cellRef]) {
    ws[cellRef] = { v: "", t: "s" };
  }
  const existingCell = ws[cellRef];
  existingCell.s = {
    font: { name: "Calibri", sz: 10, color: { rgb: EXCEL_COLORS.DARK_TEXT }, ...(styleObj.font || {}) },
    fill: styleObj.fill ? { fgColor: { rgb: styleObj.fill.replace("#", "") } } : undefined,
    alignment: { vertical: "center", ...(styleObj.alignment || {}) },
    border: styleObj.border !== undefined ? styleObj.border : STANDARD_BORDER
  };
}

export function styleRange(ws, startR, startC, endR, endC, styleObj = {}) {
  for (let r = startR; r <= endR; r++) {
    for (let c = startC; c <= endC; c++) {
      styleCell(ws, r, c, styleObj);
    }
  }
}

export function exportToCSV(data = [], columns = [], filename = "export") {
  const safeData = Array.isArray(data) ? data : [];
  const headers = columns.map(c => c.header);
  const rows = safeData.map(row => 
    columns.map(c => {
      const val = typeof c.accessor === 'function' ? c.accessor(row) : row[c.accessor];
      return `"${String(val ?? '').replace(/"/g, '""')}"`;
    }).join(',')
  );
  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToExcel(title, data = [], columns = [], filename = "export", parlourName = "SmartGoNext Beauty SaaS") {
  const safeData = Array.isArray(data) ? data : [];
  const wb = XLSX.utils.book_new();
  
  const numCols = Math.max(columns.length, 1);
  
  // Header rows
  const headerData = [
    [parlourName],
    [title],
    [`Generated on ${new Date().toLocaleString()}`],
    [], // Empty spacing row
    columns.map(c => c.header)
  ];
  
  // Data rows
  const rowData = safeData.map(row => 
    columns.map(c => {
      const val = typeof c.accessor === 'function' ? c.accessor(row) : row[c.accessor];
      return val ?? '';
    })
  );
  
  const allData = [...headerData, ...rowData];
  const ws = XLSX.utils.aoa_to_sheet(allData);
  
  // Calculate dynamic column widths (auto-fit content)
  const colWidths = columns.map(c => {
    let maxLen = c.header ? String(c.header).length : 10;
    safeData.forEach(row => {
      const val = typeof c.accessor === 'function' ? c.accessor(row) : row[c.accessor];
      const str = String(val ?? '');
      if (str.length > maxLen) maxLen = str.length;
    });
    return { wch: Math.min(Math.max(maxLen + 4, 14), 50) };
  });
  ws['!cols'] = colWidths;
  
  // Merge report title rows across all columns
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: numCols - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: numCols - 1 } }
  ];

  // Apply Styles
  // Row 0: Parlour Name Header (Pink Fill, Bold White Text)
  styleRange(ws, 0, 0, 0, numCols - 1, {
    fill: EXCEL_COLORS.PINK_HEADER,
    font: { bold: true, sz: 14, color: { rgb: EXCEL_COLORS.WHITE_TEXT } },
    alignment: { horizontal: "center", vertical: "center" }
  });

  // Row 1: Title Banner (Green Fill, Bold White Text)
  styleRange(ws, 1, 0, 1, numCols - 1, {
    fill: EXCEL_COLORS.GREEN_BANNER,
    font: { bold: true, sz: 12, color: { rgb: EXCEL_COLORS.WHITE_TEXT } },
    alignment: { horizontal: "center", vertical: "center" }
  });

  // Row 2: Subtitle/Timestamp Banner (Green Fill, White Text)
  styleRange(ws, 2, 0, 2, numCols - 1, {
    fill: EXCEL_COLORS.GREEN_BANNER,
    font: { sz: 9, italic: true, color: { rgb: EXCEL_COLORS.WHITE_TEXT } },
    alignment: { horizontal: "center", vertical: "center" }
  });

  // Row 4: Table Headers (Pink Fill, Bold White Text)
  styleRange(ws, 4, 0, 4, numCols - 1, {
    fill: EXCEL_COLORS.PINK_HEADER,
    font: { bold: true, sz: 11, color: { rgb: EXCEL_COLORS.WHITE_TEXT } },
    alignment: { horizontal: "center", vertical: "center" }
  });

  // Rows 5 onwards: Data Rows (Borders, Alternating fill)
  safeData.forEach((_, idx) => {
    const rowIdx = 5 + idx;
    const isEven = idx % 2 === 0;
    styleRange(ws, rowIdx, 0, rowIdx, numCols - 1, {
      fill: isEven ? "FFFFFF" : EXCEL_COLORS.LIGHT_GRAY,
      alignment: { vertical: "center" }
    });
  });
  
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function printDataList(title, data = [], columns = [], parlourName = "SmartGoNext Beauty SaaS") {
  const safeData = Array.isArray(data) ? data : [];
  const printWin = window.open('', '_blank');
  
  const headersHtml = columns.map(c => 
    `<th>${c.header}</th>`
  ).join('');
  
  const rowsHtml = safeData.length > 0 ? safeData.map(row => 
    `<tr>${columns.map(c => {
      const val = typeof c.accessor === 'function' ? c.accessor(row) : row[c.accessor];
      return `<td>${val ?? '—'}</td>`;
    }).join('')}</tr>`
  ).join('') : `<tr><td colspan="${columns.length}" style="text-align:center; padding: 20px;">No records available.</td></tr>`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          @page {
            size: A4;
            margin: 10mm;
          }
          body { 
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; 
            margin: 0; 
            padding: 16px;
            background: white;
            color: #0f172a;
          }
          .page-border {
            border: 2px solid #cbd5e1;
            border-radius: 8px;
            padding: 24px;
            box-sizing: border-box;
            min-height: 94vh;
          }
          .report-header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 3px solid #ff758f;
            padding-bottom: 12px;
          }
          .parlour-name {
            font-size: 24px;
            font-weight: 800;
            color: #0f172a;
            margin: 0;
            letter-spacing: -0.5px;
          }
          .report-title {
            font-size: 16px;
            font-weight: 700;
            color: #ff758f;
            margin: 6px 0 0 0;
          }
          .report-meta {
            text-align: right;
            font-size: 11px;
            font-weight: 600;
            color: #64748b;
            margin-bottom: 16px;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 8px;
            page-break-inside: auto;
          }
          thead {
            display: table-header-group;
          }
          th {
            border: 1px solid #cbd5e1;
            padding: 10px 12px;
            text-align: left;
            background-color: #f8fafc;
            font-weight: 700;
            font-size: 11px;
            color: #334155;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          tr {
            page-break-inside: avoid;
          }
          td {
            border: 1px solid #e2e8f0;
            padding: 9px 12px;
            font-size: 11px;
            color: #334155;
          }
          tr:nth-child(even) td {
            background-color: #f8fafc;
          }
          @media print {
            body { margin: 0; padding: 0; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="page-border">
          <div class="report-header">
            <h1 class="parlour-name">${parlourName}</h1>
            <div class="report-title">${title}</div>
          </div>
          <div class="report-meta">Generated on ${new Date().toLocaleString()}</div>
          <table>
            <thead><tr>${headersHtml}</tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
    </html>
  `;
  printWin.document.open();
  printWin.document.write(htmlContent);
  printWin.document.close();
}

export function exportToPDF(title, data = [], columns = [], filename = "export", parlourName = "SmartGoNext Beauty SaaS") {
  const safeData = Array.isArray(data) ? data : [];
  const doc = new jsPDF();
  const pageWidth = 210; // A4 width in mm
  const pageHeight = 297; // A4 height in mm
  const margin = 12;
  const contentWidth = pageWidth - (2 * margin);
  
  const rowsPerPage = 24;
  const totalPages = Math.max(Math.ceil(safeData.length / rowsPerPage), 1);
  
  for (let page = 0; page < totalPages; page++) {
    if (page > 0) {
      doc.addPage();
    }
    
    let y = margin + 8;
    
    // Clean Page Frame / Border
    doc.setDrawColor(203, 213, 225); // Slate 300
    doc.setLineWidth(0.6);
    doc.rect(margin, margin, contentWidth, pageHeight - (2 * margin));
    
    // Header section: Business Name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42); // Slate 900
    doc.text(parlourName, pageWidth / 2, y, { align: "center" });
    y += 7;
    
    // Report Title
    doc.setFontSize(12);
    doc.setTextColor(236, 72, 153); // Pink accent
    doc.text(title, pageWidth / 2, y, { align: "center" });
    y += 6;
    
    // Timestamp
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on ${new Date().toLocaleString()}`, pageWidth / 2, y, { align: "center" });
    y += 8;
    
    // Horizontal divider
    doc.setDrawColor(236, 72, 153);
    doc.setLineWidth(0.8);
    doc.line(margin + 5, y, pageWidth - margin - 5, y);
    y += 6;
    
    // Table header box
    doc.setFillColor(248, 250, 252);
    doc.rect(margin + 4, y, contentWidth - 8, 9, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.rect(margin + 4, y, contentWidth - 8, 9);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    
    // Compute total width sum of custom widths
    const totalCustomWidth = columns.reduce((acc, c) => acc + (c.width || 30), 0);
    const scaleFactor = (contentWidth - 8) / (totalCustomWidth || 1);
    
    let x = margin + 6;
    columns.forEach(c => {
      const colWidth = (c.width || 30) * scaleFactor;
      doc.text(String(c.header || ''), x, y + 6);
      x += colWidth;
    });
    
    y += 13;
    
    // Table rows for this page
    const startIndex = page * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, safeData.length);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    
    if (safeData.length === 0) {
      doc.text("No records available.", pageWidth / 2, y, { align: "center" });
    } else {
      for (let i = startIndex; i < endIndex; i++) {
        const row = safeData[i];
        let xRow = margin + 6;
        
        columns.forEach(c => {
          const colWidth = (c.width || 30) * scaleFactor;
          const val = typeof c.accessor === 'function' ? c.accessor(row) : row[c.accessor];
          const valStr = String(val ?? '—');
          
          // Truncate long text cleanly
          const maxChars = Math.floor(colWidth / 2.2);
          const truncated = valStr.length > maxChars ? valStr.substring(0, Math.max(maxChars - 3, 1)) + '...' : valStr;
          doc.text(truncated, xRow, y);
          
          xRow += colWidth;
        });
        
        y += 4;
        // Row separator line
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.line(margin + 4, y, pageWidth - margin - 4, y);
        y += 4;
      }
    }
    
    // Page footer
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${page + 1} of ${totalPages}`, pageWidth / 2, pageHeight - margin - 3, { align: "center" });
  }

  doc.save(`${filename}.pdf`);
}

