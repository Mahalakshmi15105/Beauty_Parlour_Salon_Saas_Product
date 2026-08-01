import jsPDF from "jspdf";

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

export function printDataList(title, data, columns) {
  const printWin = window.open('', '_blank');
  const headersHtml = columns.map(c => `<th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f2f2f2;">${c.header}</th>`).join('');
  const rowsHtml = data.map(row => 
    `<tr>${columns.map(c => {
      const val = typeof c.accessor === 'function' ? c.accessor(row) : row[c.accessor];
      return `<td style="border: 1px solid #ddd; padding: 8px;">${val || '—'}</td>`;
    }).join('')}</tr>`
  ).join('');

  const htmlContent = `
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { text-align: center; margin-bottom: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p style="text-align: right; font-size: 12px; color: #666;">Generated on ${new Date().toLocaleString()}</p>
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

export function exportToPDF(title, data, columns, filename) {
  const doc = new jsPDF();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, 14, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Generated on ${new Date().toLocaleString()}`, 14, 26);

  let y = 35;
  
  // Draw Headers
  doc.setFont("helvetica", "bold");
  let x = 14;
  columns.forEach(c => {
    doc.text(c.header, x, y);
    x += c.width || 35;
  });
  
  doc.line(14, y + 2, 200, y + 2);
  y += 8;
  
  // Draw Rows
  doc.setFont("helvetica", "normal");
  data.forEach(row => {
    if (y > 280) {
      doc.addPage();
      y = 20;
      
      // Draw Headers on new page
      doc.setFont("helvetica", "bold");
      let xNew = 14;
      columns.forEach(c => {
        doc.text(c.header, xNew, y);
        xNew += c.width || 35;
      });
      doc.line(14, y + 2, 200, y + 2);
      y += 8;
      doc.setFont("helvetica", "normal");
    }
    
    let xRow = 14;
    columns.forEach(c => {
      const val = typeof c.accessor === 'function' ? c.accessor(row) : row[c.accessor];
      const valStr = String(val || '—');
      const splitText = doc.splitTextToSize(valStr, (c.width || 35) - 2);
      doc.text(splitText, xRow, y);
      xRow += c.width || 35;
    });
    y += 6;
  });

  doc.save(`${filename}.pdf`);
}
