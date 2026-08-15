import jsPDF from "jspdf";
import * as XLSX from "xlsx";

export function exportToCSV(data, columns, filename) {
  const headers = columns.map(c => c.header);
  const rows = data.map(row => 
    columns.map(c => {
      const val = typeof c.accessor === 'function' ? c.accessor(row) : row[c.accessor];
      // escape double quotes and wrap in quotes
      return `"${String(val || '').replace(/"/g, '""')}"`;
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

export function exportToExcel(title, data, columns, filename, parlourName = "SmartGoNext Beauty SaaS") {
  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // Create header row with styling
  const headerData = [
    [parlourName],
    [title],
    [`Generated on ${new Date().toLocaleString()}`],
    [], // Empty row
    columns.map(c => c.header)
  ];
  
  // Create data rows
  const rowData = data.map(row => 
    columns.map(c => {
      const val = typeof c.accessor === 'function' ? c.accessor(row) : row[c.accessor];
      return val || '';
    })
  );
  
  // Combine header and data
  const allData = [...headerData, ...rowData];
  
  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(allData);
  
  // Set column widths
  const colWidths = columns.map(c => ({ wch: c.width || 20 }));
  ws['!cols'] = colWidths;
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  
  // Save file
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function printDataList(title, data, columns, parlourName = "SmartGoNext Beauty SaaS") {
  const printWin = window.open('', '_blank');
  
  const headersHtml = columns.map(c => 
    `<th style="border: 2px solid #333; padding: 12px; text-align: left; background-color: #f8f9fa; font-weight: bold; font-size: 12px;">${c.header}</th>`
  ).join('');
  
  const rowsHtml = data.map(row => 
    `<tr>${columns.map(c => {
      const val = typeof c.accessor === 'function' ? c.accessor(row) : row[c.accessor];
      return `<td style="border: 1px solid #ddd; padding: 10px; font-size: 11px;">${val || '—'}</td>`;
    }).join('')}</tr>`
  ).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          @page {
            size: A4;
            margin: 20mm;
          }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0; 
            padding: 20px;
            background: white;
          }
          .report-header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #EC4899;
            padding-bottom: 20px;
          }
          .report-title {
            font-size: 24px;
            font-weight: bold;
            color: #1e293b;
            margin: 0 0 10px 0;
          }
          .report-subtitle {
            font-size: 14px;
            color: #64748b;
            margin: 0;
          }
          .report-meta {
            text-align: right;
            font-size: 12px;
            color: #64748b;
            margin-bottom: 20px;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 20px;
            page-break-inside: auto;
          }
          thead {
            display: table-header-group;
          }
          thead tr {
            page-break-inside: avoid;
          }
          th {
            page-break-inside: avoid;
          }
          tr {
            page-break-inside: avoid;
          }
          td {
            page-break-inside: avoid;
          }
          @media print {
            body { margin: 0; padding: 0; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="report-header">
          <h1 class="report-title">${parlourName}</h1>
          <p class="report-subtitle">${title}</p>
        </div>
        <div class="report-meta">Generated on ${new Date().toLocaleString()}</div>
        <table>
          <thead><tr>${headersHtml}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
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

export function exportToPDF(title, data, columns, filename, parlourName = "SmartGoNext Beauty SaaS") {
  const doc = new jsPDF();
  const pageWidth = 210; // A4 width in mm
  const pageHeight = 297; // A4 height in mm
  const margin = 15;
  const contentWidth = pageWidth - (2 * margin);
  
  let currentPage = 1;
  let totalPages = 1;
  
  // Calculate total pages needed
  const rowsPerPage = 25; // Approximate rows per page
  totalPages = Math.ceil(data.length / rowsPerPage);
  
  // Generate PDF pages
  for (let page = 0; page < totalPages; page++) {
    if (page > 0) {
      doc.addPage();
    }
    
    const startY = margin;
    let y = startY;
    
    // Page border
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, margin, contentWidth, pageHeight - (2 * margin));
    
    // Header section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(30, 30, 30);
    doc.text(parlourName, pageWidth / 2, y, { align: "center" });
    y += 10;
    
    doc.setFontSize(14);
    doc.setTextColor(236, 72, 153); // Brand color
    doc.text(title, pageWidth / 2, y, { align: "center" });
    y += 8;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on ${new Date().toLocaleString()}`, pageWidth / 2, y, { align: "center" });
    y += 10;
    
    // Horizontal line
    doc.setDrawColor(236, 72, 153);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
    
    // Table header
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, contentWidth, 10, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, y, contentWidth, 10);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    
    let x = margin + 5;
    columns.forEach(c => {
      const colWidth = (c.width || 30) * (contentWidth / 180);
      doc.text(c.header, x, y + 7);
      x += colWidth;
    });
    
    y += 15;
    
    // Table rows for this page
    const startIndex = page * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, data.length);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    
    for (let i = startIndex; i < endIndex; i++) {
      const row = data[i];
      let xRow = margin + 5;
      
      columns.forEach(c => {
        const colWidth = (c.width || 30) * (contentWidth / 180);
        const val = typeof c.accessor === 'function' ? c.accessor(row) : row[c.accessor];
        const valStr = String(val || '—');
        
        // Truncate if too long
        if (valStr.length > 25) {
          const truncated = valStr.substring(0, 22) + '...';
          doc.text(truncated, xRow, y);
        } else {
          doc.text(valStr, xRow, y);
        }
        
        xRow += colWidth;
      });
      
      y += 7;
      
      // Row separator line
      doc.setDrawColor(240, 240, 240);
      doc.setLineWidth(0.1);
      doc.line(margin, y, pageWidth - margin, y);
      y += 1;
    }
    
    // Page number
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${page + 1} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: "center" });
  }

  doc.save(`${filename}.pdf`);
}
