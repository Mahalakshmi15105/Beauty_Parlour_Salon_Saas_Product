import React from "react";
import { useLanguageCurrency } from "../context/LanguageCurrencyContext";
import { getFullImageUrl } from "../utils/imageUrl";
import { getShopNameStyle } from "../utils/fontLoader";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export async function downloadThermalReceiptPDF(elementOrRef, invoiceNumber = "INV-0001", paperSize = "80mm") {
  let targetEl = null;
  if (elementOrRef && elementOrRef.current) {
    targetEl = elementOrRef.current;
  } else if (typeof elementOrRef === "string") {
    targetEl = document.getElementById(elementOrRef);
  } else if (elementOrRef instanceof HTMLElement) {
    targetEl = elementOrRef;
  }

  if (!targetEl) {
    targetEl = document.getElementById("thermal-receipt-printable");
  }

  if (!targetEl) {
    alert("Thermal receipt content is not available for PDF export.");
    return;
  }

  try {
    // Clone element temporarily into visible off-screen container for 100% reliable canvas capture
    const clone = targetEl.cloneNode(true);
    clone.style.position = "fixed";
    clone.style.left = "0";
    clone.style.top = "0";
    clone.style.opacity = "1";
    clone.style.zIndex = "99999";
    clone.style.background = "#ffffff";
    clone.style.color = "#000000";
    clone.style.width = paperSize === "58mm" ? "219px" : "302px";
    document.body.appendChild(clone);

    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    document.body.removeChild(clone);

    const imgData = canvas.toDataURL("image/png");
    const imgWidth = paperSize === "58mm" ? 58 : 80;
    const pageHeight = Math.max(80, (canvas.height * imgWidth) / canvas.width);

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [imgWidth, pageHeight],
    });

    pdf.addImage(imgData, "PNG", 0, 0, imgWidth, pageHeight);
    const cleanInvNumber = (invoiceNumber || "Receipt").replace(/[^a-zA-Z0-9_-]/g, "_");
    pdf.save(`Invoice_${cleanInvNumber}.pdf`);
  } catch (err) {
    console.error("PDF Export Error:", err);
    alert("Failed to download PDF receipt.");
  }
}

export function printThermalReceiptElement(elementOrRef, paperSize = "80mm") {
  let targetEl = null;
  if (elementOrRef && elementOrRef.current) {
    targetEl = elementOrRef.current;
  } else if (typeof elementOrRef === "string") {
    targetEl = document.getElementById(elementOrRef);
  } else if (elementOrRef instanceof HTMLElement) {
    targetEl = elementOrRef;
  }

  if (!targetEl) {
    targetEl = document.getElementById("thermal-receipt-printable");
  }

  if (!targetEl || !targetEl.innerHTML || targetEl.innerHTML.trim() === "") {
    alert("Thermal Receipt content is empty or not rendered. Please try again.");
    return;
  }

  const receiptHtml = targetEl.innerHTML;
  const is58mm = paperSize === "58mm";
  const paperWidth = is58mm ? "58mm" : "80mm";
  const contentWidth = is58mm ? "219px" : "302px";

  const htmlDocument = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Thermal Receipt</title>
    <style>
      @page {
        size: ${paperWidth} auto;
        margin: 0mm !important;
      }
      @media print {
        @page {
          size: ${paperWidth} auto;
          margin: 0mm !important;
        }
        html, body {
          width: ${paperWidth} !important;
          max-width: ${paperWidth} !important;
          margin: 0 auto !important;
          padding: 0 !important;
          background: #ffffff !important;
        }
      }
      *, *:before, *:after {
        box-sizing: border-box !important;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        min-height: 100% !important;
        display: flex !important;
        justify-content: center !important;
        align-items: flex-start !important;
        background: #ffffff !important;
        color: #000000 !important;
        font-family: 'Courier New', Courier, monospace, sans-serif !important;
        font-size: 11px !important;
        line-height: 1.2 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .receipt {
        width: ${contentWidth} !important;
        max-width: ${contentWidth} !important;
        min-width: ${contentWidth} !important;
        margin: 0 auto !important;
        padding: 6px 4px !important;
        box-sizing: border-box !important;
        background: #ffffff !important;
        color: #000000 !important;
      }
      .receipt * {
        color: #000000 !important;
        background: transparent !important;
        box-shadow: none !important;
        text-shadow: none !important;
      }
      /* Layout & Utility Mappings for Thermal Printing */
      .flex { display: flex !important; }
      .justify-between { justify-content: space-between !important; }
      .justify-center { justify-content: center !important; }
      .items-center { align-items: center !important; }
      .items-start { align-items: flex-start !important; }
      .text-center { text-align: center !important; }
      .text-right { text-align: right !important; }
      .text-left { text-align: left !important; }
      .font-bold, .font-extrabold, .font-black { font-weight: bold !important; }
      .uppercase { text-transform: uppercase !important; }
      .grid { display: grid !important; }
      .grid-cols-3 { display: flex !important; justify-content: space-between !important; }
      .w-full { width: 100% !important; }
      .w-1\\/2 { width: 50% !important; }
      .w-1\\/4 { width: 25% !important; }
      .border-b { border-bottom: 1px solid #000000 !important; }
      .border-t { border-top: 1px solid #000000 !important; }
      .border-dashed { border-style: dashed !important; }
      .border-black { border-color: #000000 !important; }
      .my-1 { margin-top: 4px !important; margin-bottom: 4px !important; }
      .py-1 { padding-top: 4px !important; padding-bottom: 4px !important; }
      .p-1 { padding: 4px !important; }
      .p-2 { padding: 4px !important; }
      .space-y-0\\.5 > * + * { margin-top: 2px !important; }
      .space-y-1 > * + * { margin-top: 4px !important; }
      .truncate { overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
      .break-words { overflow-wrap: break-word !important; }
      table { width: 100%; border-collapse: collapse; }
      th, td { font-size: 10px; padding: 2px 0; color: #000000; }
      .dashed-line {
        border-bottom: 1px dashed #000000 !important;
        margin: 4px 0 !important;
      }
      .net-payable-box {
        border: 1px solid #000000 !important;
        background: #ffffff !important;
        padding: 4px !important;
        font-weight: bold !important;
        margin-top: 4px !important;
      }
      img { max-width: 100% !important; height: auto !important; display: block !important; margin: 0 auto !important; }
    </style>
  </head>
  <body>
    <div class="receipt">
      ${receiptHtml}
    </div>
  </body>
</html>`;

  // 1. Try Blob URL Window
  try {
    const blob = new Blob([htmlDocument], { type: "text/html;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    const printWin = window.open(blobUrl, "_blank", "width=380,height=600,top=100,left=100");

    if (printWin) {
      console.log("=== STEP 2: PRINT WINDOW CREATED (BLOB URL) ===");
      console.log("Window Object:", printWin);

      const triggerPrint = () => {
        try {
          const receiptEl = printWin.document.querySelector(".receipt");
          console.log("=== VERIFY LAYOUT BEFORE PRINTING ===");
          console.log("document.body.offsetWidth:", printWin.document.body ? printWin.document.body.offsetWidth : 0);
          console.log("receipt.offsetWidth:", receiptEl ? receiptEl.offsetWidth : "NULL");
          console.log("receipt.getBoundingClientRect():", receiptEl ? receiptEl.getBoundingClientRect() : "NULL");
          console.log("document.body.innerHTML snippet:", printWin.document.body ? printWin.document.body.innerHTML.substring(0, 300) : "EMPTY");

          const bodyHtml = printWin.document.body ? printWin.document.body.innerHTML : "";
          if (!bodyHtml || bodyHtml.length === 0) {
            console.error("CRITICAL ERROR: printWindow document body is EMPTY (0 length)! Aborting print.");
            alert("Print window failed to load receipt content.");
            return;
          }

          console.log("=== STEP 7: EXECUTING WINDOW PRINT ===");
          printWin.focus();
          printWin.print();

          setTimeout(() => {
            try {
              printWin.close();
              URL.revokeObjectURL(blobUrl);
            } catch (e) {}
          }, 1000);
        } catch (err) {
          console.error("Print execution exception:", err);
        }
      };

      if (printWin.document.readyState === "complete") {
        setTimeout(triggerPrint, 350);
      } else {
        printWin.onload = () => setTimeout(triggerPrint, 350);
      }
      return;
    }
  } catch (e) {
    console.warn("Blob URL window popup failed, falling back to direct write:", e);
  }

  // 2. Direct Write Fallback
  const printWin = window.open("", "_blank", "width=380,height=600,top=100,left=100");
  if (printWin) {
    printWin.document.open();
    printWin.document.write(htmlDocument);
    printWin.document.close();

    const receiptEl = printWin.document.querySelector(".receipt");
    console.log("=== DIRECT WRITE LAYOUT VERIFICATION ===");
    console.log("document.body.offsetWidth:", printWin.document.body ? printWin.document.body.offsetWidth : 0);
    console.log("receipt.offsetWidth:", receiptEl ? receiptEl.offsetWidth : "NULL");

    setTimeout(() => {
      printWin.focus();
      printWin.print();
      setTimeout(() => {
        try { printWin.close(); } catch (e) {}
      }, 800);
    }, 350);
  }
}

export const ThermalReceipt = React.forwardRef(({ invoice, settings = {}, businessProfile = {} }, ref) => {
  const { formatCurrency } = useLanguageCurrency();

  const paperSize = settings.paper_size || "80mm";
  const is58mm = paperSize === "58mm";
  const containerWidthClass = is58mm ? "w-[219px]" : "w-[302px]";

  // Guard: If invoice is missing, render valid empty container so ref target DOM element ALWAYS exists!
  if (!invoice) {
    console.log("ThermalReceipt mounted with empty invoice prop.");
    return (
      <div
        ref={ref}
        id="thermal-receipt-printable"
        className={`thermal-receipt-print-area ${containerWidthClass} bg-white text-black font-mono text-[11px] leading-tight p-2 mx-auto select-text`}
        style={{ boxSizing: "border-box" }}
      >
        <p className="text-center text-slate-400 py-4">No invoice selected.</p>
      </div>
    );
  }

  const showLogo = settings.show_logo !== false && businessProfile.logo_url;
  const showAddress = settings.show_address !== false;
  const showPhone = settings.show_phone !== false;
  const showGst = settings.show_gst !== false && businessProfile.gst_number;
  const thankYouMsg = settings.thank_you_message || "Thank you for visiting. Please visit again.";

  const customerName = invoice.customer_name || (invoice.customer ? `${invoice.customer.first_name || ''} ${invoice.customer.last_name || ''}`.trim() : "Walk-in Customer") || "Walk-in Customer";
  const cashierName = invoice.created_by || invoice.cashier || "Admin";

  const formattedLogoUrl = getFullImageUrl(businessProfile.logo_url);

  const formattedDate = invoice.created_at
    ? `${new Date(invoice.created_at).toLocaleDateString()} ${new Date(invoice.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : new Date().toLocaleDateString();

  return (
    <div
      ref={ref}
      id="thermal-receipt-printable"
      className={`thermal-receipt-print-area ${containerWidthClass} bg-white text-black font-mono text-[11px] leading-tight p-2 mx-auto select-text`}
      style={{ boxSizing: "border-box" }}
    >
      <style>{`
        @page {
          size: ${is58mm ? "58mm" : "80mm"} auto;
          margin: 0mm !important;
        }
        @media print {
          @page {
            size: ${is58mm ? "58mm" : "80mm"} auto;
            margin: 0mm !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: ${is58mm ? "219px" : "302px"} !important;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            overflow: visible !important;
          }
          /* Hide screen UI elements during browser print */
          header, nav, footer, aside, button, .no-print {
            display: none !important;
          }
          #thermal-receipt-printable,
          #thermal-receipt-printable * {
            visibility: visible !important;
            color: #000000 !important;
          }
          #thermal-receipt-printable {
            display: block !important;
            position: static !important;
            left: auto !important;
            top: auto !important;
            opacity: 1 !important;
            margin: 0 auto !important;
            padding: ${is58mm ? "4px 2px" : "6px 4px"} !important;
            width: ${is58mm ? "219px" : "302px"} !important;
            max-width: ${is58mm ? "219px" : "302px"} !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: 'Courier New', Courier, monospace, sans-serif !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* 1. LOGO & BRANDING HEADER */}
      <div className="text-center space-y-0.5">
        {showLogo && (
          <div className="flex justify-center pb-1">
            <img
              src={formattedLogoUrl}
              alt="Logo"
              className={`${is58mm ? "w-10 h-10" : "w-12 h-12"} object-cover mx-auto`}
              onError={(e) => {
                e.target.onerror = null;
                e.target.style.display = "none";
              }}
            />
          </div>
        )}

        <h1
          className={`font-bold uppercase tracking-wide text-black ${is58mm ? "text-xs" : "text-sm"}`}
          style={getShopNameStyle(businessProfile.shop_name_typography)}
        >
          {businessProfile.name || "Beauty Parlour"}
        </h1>

        {showAddress && (businessProfile.address || businessProfile.city) && (
          <p className="text-[10px] text-black break-words leading-tight">
            {[businessProfile.address, businessProfile.city, businessProfile.state, businessProfile.postal_code].filter(Boolean).join(", ")}
          </p>
        )}

        {showGst && (
          <p className="text-[10px] font-bold text-black">GST: {businessProfile.gst_number}</p>
        )}
      </div>

      {/* SEPARATOR 1 */}
      <div className="border-b border-dashed border-black my-1" />

      {/* 2. INVOICE METADATA */}
      <div className="text-[10px] space-y-0.5 text-black">
        <div className="flex justify-between font-bold">
          <span>Bill No:</span>
          <span>{invoice.invoice_number || invoice.id}</span>
        </div>
        <div className="flex justify-between">
          <span>Date:</span>
          <span>{formattedDate}</span>
        </div>
        <div className="flex justify-between">
          <span>Cashier:</span>
          <span>{cashierName}</span>
        </div>
        <div className="flex justify-between font-bold">
          <span>Client:</span>
          <span className="truncate max-w-[130px]">{customerName}</span>
        </div>
      </div>

      {/* SEPARATOR 2 */}
      <div className="border-b border-dashed border-black my-1" />

      {/* 3. ITEM TABLE HEADER */}
      <div className="text-[10px]">
        {(() => {
          const lineItems = invoice.line_items || invoice.items || [];
          const serviceItems = lineItems.filter(item => item.type === "service" || item.service_id);
          const productItems = lineItems.filter(item => item.type === "product" || item.product_id);

          return (
            <div className="space-y-3">
              {/* SERVICES SECTION */}
              {serviceItems.length > 0 && (
                <div>
                  <div className="font-bold uppercase border-b border-dashed border-black pb-0.5 mb-1 text-black flex justify-between">
                    <span className="w-1/2">SERVICES</span>
                    <span className="w-1/4 text-center">QTY</span>
                    <span className="w-1/4 text-right">AMT</span>
                  </div>
                  <div className="space-y-1">
                    {serviceItems.map((item, idx) => {
                      const itemName = (item.item_name || item.name || item.service_name || `Service #${idx + 1}`).toUpperCase();
                      const staffName = item.staff_name || item.employee_name || (item.employee_names ? item.employee_names.join(", ") : "");
                      const qty = item.quantity || item.qty || 1;
                      const rate = item.unit_price || item.rate || (item.price || 0);
                      const amount = item.line_total || item.total || (rate * qty);

                      return (
                        <div key={idx} className="space-y-0.5 text-black">
                          <div className="flex justify-between items-start font-bold">
                            <span className="w-1/2 break-words leading-tight">{itemName}</span>
                            <span className="w-1/4 text-center">{qty}</span>
                            <span className="w-1/4 text-right font-bold">{formatCurrency(amount)}</span>
                          </div>
                          <div className="text-[9px] text-black">
                            ({formatCurrency(rate)} x {qty} qty)
                          </div>
                          {staffName && (
                            <div className="text-[9px] text-black italic">
                              Staff: {staffName}
                            </div>
                          )}
                          {item.discount > 0 && (
                            <div className="text-[9px] text-black">
                              Disc: -{formatCurrency(item.discount)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* PRODUCTS SECTION */}
              {productItems.length > 0 && (
                <div>
                  <div className="font-bold uppercase border-b border-dashed border-black pb-0.5 mb-1 text-black flex justify-between text-[10px]">
                    <span className="w-[30%] text-left">PRODUCTS</span>
                    <span className="w-[18%] text-right">RATE</span>
                    <span className="w-[12%] text-center">QTY</span>
                    <span className="w-[20%] text-right">MRP</span>
                    <span className="w-[20%] text-right">AMT</span>
                  </div>
                  <div className="space-y-1.5">
                    {productItems.map((item, idx) => {
                      const itemName = (item.item_name || item.name || item.product_name || `Product #${idx + 1}`).toUpperCase();
                      const qty = item.quantity || item.qty || 1;
                      const rate = item.unit_price || item.rate || (item.price || 0);
                      const mrpValue = item.mrp || item.unit_price || item.rate || 0;
                      const amount = item.line_total || item.total || (rate * qty);

                      return (
                        <div key={idx} className="space-y-0.5 text-black">
                          <div className="flex justify-between items-start text-[10px]">
                            <span className="w-[30%] break-words leading-tight font-bold">{itemName}</span>
                            <span className="w-[18%] text-right">{formatCurrency(rate)}</span>
                            <span className="w-[12%] text-center">{qty}</span>
                            <span className="w-[20%] text-right">{formatCurrency(mrpValue)}</span>
                            <span className="w-[20%] text-right font-bold">{formatCurrency(amount)}</span>
                          </div>
                          {item.discount > 0 && (
                            <div className="text-[9px] text-black text-right">
                              Disc: -{formatCurrency(item.discount)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* SEPARATOR 3 */}
      <div className="border-b border-dashed border-black my-1" />

      {/* 4. FINANCIAL SUMMARY */}
      <div className="text-[10px] space-y-0.5 text-black">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{formatCurrency(invoice.subtotal || 0)}</span>
        </div>

        {(invoice.discount || 0) > 0 && (
          <div className="flex justify-between font-bold">
            <span>Discount:</span>
            <span>-{formatCurrency(invoice.discount)}</span>
          </div>
        )}

        {invoice.membership_name && (
          <div className="flex justify-between font-bold text-black border-t border-dashed border-slate-300 pt-0.5">
            <span>Membership ({invoice.membership_name}):</span>
            <span>-{formatCurrency(invoice.membership_discount || 0)}</span>
          </div>
        )}

        {(invoice.tax || 0) > 0 && (
          <div className="flex justify-between">
            <span>GST (Service):</span>
            <span>{formatCurrency(invoice.tax)}</span>
          </div>
        )}

        {/* HIGHLIGHTED NET PAYABLE BOX */}
        <div className="flex justify-between items-center text-xs font-bold text-black border border-black p-1 my-1">
          <span>NET PAYABLE:</span>
          <span className="text-sm font-extrabold">{formatCurrency(invoice.total || invoice.net_payable || 0)}</span>
        </div>
      </div>

      {/* SEPARATOR 4 */}
      <div className="border-b border-dashed border-black my-1" />

      {/* 5. PAYMENT METHOD(S) */}
      <div className="text-[10px] space-y-0.5 text-black">
        <span className="font-bold text-[9px] uppercase block mb-0.5">PAYMENT METHOD(S):</span>
        {invoice.payments && invoice.payments.length > 0 ? (
          invoice.payments.map((p, idx) => (
            <div key={idx} className="flex justify-between">
              <span>Paid ({p.method || p.payment_method}):</span>
              <span className="font-bold">{formatCurrency(p.amount || 0)}</span>
            </div>
          ))
        ) : (
          <div className="flex justify-between">
            <span>Paid ({invoice.payment_method || "Cash"}):</span>
            <span className="font-bold">{formatCurrency(invoice.total || 0)}</span>
          </div>
        )}

        {invoice.balance_due > 0 && (
          <div className="flex justify-between font-bold border-t border-dotted border-black pt-0.5 mt-0.5">
            <span>Balance Due:</span>
            <span>{formatCurrency(invoice.balance_due)}</span>
          </div>
        )}

        {invoice.change_returned > 0 && (
          <div className="flex justify-between font-bold border-t border-dotted border-black pt-0.5 mt-0.5">
            <span>Change Returned:</span>
            <span>{formatCurrency(invoice.change_returned)}</span>
          </div>
        )}
      </div>

      {/* SEPARATOR 5 */}
      <div className="border-b border-dashed border-black my-1" />

      {/* 6. THANK YOU & FOOTER */}
      <div className="text-center space-y-0.5 text-[10px] text-black">
        <p className="font-bold whitespace-pre-line">{thankYouMsg}</p>
        <p className="text-[8px] uppercase tracking-widest font-bold">POWERED BY SMARTGONEXT</p>
      </div>

      {/* SEPARATOR 6 */}
      <div className="border-b border-dashed border-black my-1" />

      {/* 7. WALLET / MEMBERSHIP / BALANCE ROW */}
      <div className="grid grid-cols-3 text-center text-[8px] font-bold text-black border-t border-b border-dashed border-black py-1 my-1 gap-0.5">
        <div>
          <span className="block">Wallet</span>
          <span>Balance: ₹{invoice.customer?.wallet_balance || 0}</span>
        </div>
        <div>
          <span className="block">Membership</span>
          <span>Balance: ₹{invoice.customer?.membership_balance || 0}</span>
        </div>
        <div>
          <span className="block">Balance Due</span>
          <span>{(invoice.balance_due || 0).toFixed(2)}</span>
        </div>
      </div>

      {/* 8. NOTES & CONTACT PHONE */}
      {invoice.notes && (
        <div className="text-[9px] text-black space-y-0.5 pt-0.5">
          <span className="font-bold block">Notes:</span>
          <p className="italic">{invoice.notes}</p>
        </div>
      )}

      {showPhone && businessProfile.phone && (
        <div className="pt-1.5 text-center text-[9px] font-bold text-black">
          For appointments, Please call on {businessProfile.phone}
        </div>
      )}
    </div>
  );
});

ThermalReceipt.displayName = "ThermalReceipt";
