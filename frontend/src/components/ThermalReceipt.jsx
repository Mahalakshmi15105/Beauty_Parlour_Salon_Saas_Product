import { useToast } from "../context/ToastContext";
import React from "react";
import { useLanguageCurrency } from "../context/LanguageCurrencyContext";
import { getFullImageUrl } from "../utils/imageUrl";
import { getShopNameStyle } from "../utils/fontLoader";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export async function downloadThermalReceiptPDF(elementOrRef, invoiceNumber = "INV-0001", paperSize = "80mm") {
  const { showSuccess, showError } = useToast();
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
    showError("Thermal receipt content is not available for PDF export.");
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
    showError("Failed to download PDF receipt.");
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
    showError("Thermal Receipt content is empty or not rendered. Please try again.");
    return;
  }

  const receiptHtml = targetEl.innerHTML;
  const is58mm = paperSize === "58mm";
  const paperWidth = is58mm ? "58mm" : "80mm";
  const pixelWidth = is58mm ? "260px" : "340px";

  const htmlDocument = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Thermal Receipt</title>
    <style>
      @page {
        size: ${paperWidth} portrait;
        margin: 0mm !important;
      }
      @media print {
        @page {
          size: ${paperWidth} portrait;
          margin: 0mm !important;
        }
        html, body {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
        }
        .receipt {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 100% !important;
          margin: 0 !important;
          padding: 2mm 3mm !important;
          border: none !important;
          box-shadow: none !important;
        }
      }
      *, *:before, *:after {
        box-sizing: border-box !important;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        min-height: 100vh !important;
        display: flex !important;
        justify-content: center !important;
        align-items: flex-start !important;
        background: #f1f5f9 !important;
        color: #000000 !important;
        font-family: 'Courier New', Courier, monospace, sans-serif !important;
        font-size: 13px !important;
        line-height: 1.3 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .receipt {
        width: ${pixelWidth} !important;
        max-width: ${pixelWidth} !important;
        min-width: ${pixelWidth} !important;
        margin: 15px auto !important;
        padding: 14px 12px !important;
        box-sizing: border-box !important;
        background: #ffffff !important;
        border: 1px solid #cbd5e1 !important;
        border-radius: 6px !important;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important;
        color: #000000 !important;
      }
      .receipt * {
        color: #000000 !important;
        background: transparent !important;
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
      .w-1\\/2, .w-2\\/3 { width: 66% !important; }
      .w-1\\/3 { width: 33% !important; }
      .w-1\\/4 { width: 25% !important; }
      .border-b { border-bottom: 1px solid #cccccc !important; }
      .border-t { border-top: 1px solid #cccccc !important; }
      .border-dashed { border-style: dashed !important; border-color: #cccccc !important; }
      .border-black { border-color: #bbbbbb !important; }
      .border-slate-300 { border-color: #cccccc !important; }
      .my-1 { margin-top: 4px !important; margin-bottom: 4px !important; }
      .py-1 { padding-top: 4px !important; padding-bottom: 4px !important; }
      .p-1 { padding: 4px !important; }
      .p-2 { padding: 6px !important; }
      .space-y-0\\.5 > * + * { margin-top: 3px !important; }
      .space-y-1 > * + * { margin-top: 5px !important; }
      .truncate { overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
      .break-words { overflow-wrap: break-word !important; }
      table { width: 100%; border-collapse: collapse; }
      th, td { font-size: 12px; padding: 3px 0; color: #000000; }
      .dashed-line {
        border-bottom: 1px dashed #cccccc !important;
        margin: 6px 0 !important;
      }
      .net-payable-box {
        border: 1px solid #cccccc !important;
        background: #ffffff !important;
        padding: 6px !important;
        font-weight: bold !important;
        margin-top: 6px !important;
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
            showError("Print window failed to load receipt content.");
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

export const ThermalReceipt = React.forwardRef(({ invoice, settings = {}, businessProfile = {}, hideLoyaltyStatus = false, hideLineItems = false }, ref) => {
  const { formatCurrency } = useLanguageCurrency();

  const paperSize = settings.paper_size || "80mm";
  const is58mm = paperSize === "58mm";
  const containerWidthClass = is58mm ? "w-[219px]" : "w-[302px]";

  // Guard: If invoice is missing, render valid empty container so ref target DOM element ALWAYS exists!
  if (!invoice) {
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
  const showQty = settings.show_qty !== false;
  const showRate = settings.show_rate !== false;
  const showMrp = settings.show_mrp !== false;
  const showTax = settings.show_tax !== false;
  const thankYouMsg = "Thank you for visiting. Please visit again.";

  const customerName = invoice.customer_name || (invoice.customer ? `${invoice.customer.first_name || ''} ${invoice.customer.last_name || ''}`.trim() : "Walk-in Customer") || "Walk-in Customer";

  const getCleanBillNumber = (inv) => {
    if (!inv) return "1";
    const rawNo = inv.invoice_number || inv.id;
    if (!rawNo) return "1";
    const str = String(rawNo);
    const match = str.match(/\d+/g);
    if (match && match.length > 0) {
      const lastDigits = match[match.length - 1];
      const parsedInt = parseInt(lastDigits, 10);
      return isNaN(parsedInt) ? str : String(parsedInt);
    }
    return str;
  };

  const cleanBillNo = getCleanBillNumber(invoice);
  const formattedLogoUrl = getFullImageUrl(businessProfile.logo_url);

  const formattedDate = invoice.created_at
    ? `${new Date(invoice.created_at).toLocaleDateString()} ${new Date(invoice.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : new Date().toLocaleDateString();

  return (
    <div
      ref={ref}
      id="thermal-receipt-printable"
      className={`thermal-receipt-print-area ${containerWidthClass} bg-white text-black font-mono text-xs leading-normal p-3 mx-auto select-text`}
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
            width: 100% !important;
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
            padding: 4px 6px !important;
            width: 100% !important;
            max-width: 100% !important;
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

      {/* 1. LOGO & BRANDING HEADER (Logo -> Parlour Name -> Address -> Phone) */}
      <div className="text-center space-y-1">
        {showLogo && (
          <div className="flex justify-center pb-1">
            <img
              src={formattedLogoUrl}
              alt="Logo"
              className={`${is58mm ? "w-12 h-12" : "w-14 h-14"} object-cover mx-auto`}
              onError={(e) => {
                e.target.onerror = null;
                e.target.style.display = "none";
              }}
            />
          </div>
        )}

        <h1
          className={`font-black uppercase tracking-wide text-black ${is58mm ? "text-sm" : "text-base"}`}
          style={getShopNameStyle(businessProfile.shop_name_typography)}
        >
          {businessProfile.name || "Beauty Parlour"}
        </h1>

        {showAddress && (businessProfile.address || businessProfile.city) && (
          <p className="text-xs text-black break-words leading-tight">
            {[businessProfile.address, businessProfile.city, businessProfile.state, businessProfile.postal_code].filter(Boolean).join(", ")}
          </p>
        )}

        {showPhone && businessProfile.phone && (
          <p className="text-xs font-bold text-black">
            Ph: {businessProfile.phone}
          </p>
        )}

        {showGst && (
          <p className="text-xs font-bold text-black">GST: {businessProfile.gst_number}</p>
        )}
      </div>

      {/* SEPARATOR 1 */}
      <div className="border-b border-dashed border-slate-300 my-1.5" />

      {/* 2. INVOICE METADATA (Bill No -> Client -> Date -> Loyalty Visit Status) */}
      <div className="text-xs space-y-0.5 text-black">
        <div className="flex justify-between font-bold">
          <span>Bill No:</span>
          <span className="font-extrabold">{cleanBillNo}</span>
        </div>
        <div className="flex justify-between font-bold">
          <span>Client:</span>
          <span className="truncate max-w-[150px]">{customerName}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>Date:</span>
          <span>{formattedDate}</span>
        </div>
        {!hideLoyaltyStatus && invoice.membership_name && (
          <div className="flex justify-between font-bold text-black border-t border-dotted border-slate-300 pt-1 mt-1">
            <span>Loyalty Status:</span>
            <span className="font-extrabold text-right">{invoice.membership_name}</span>
          </div>
        )}
      </div>

      {/* SEPARATOR 2 (only show if line items section is visible) */}
      {!hideLineItems && <div className="border-b border-dashed border-slate-300 my-1.5" />}

      {/* 3. ITEM TABLE HEADER */}
      {!hideLineItems && (
        <div className="text-xs">
          {(() => {
            const lineItems = invoice.line_items || invoice.items || [];
            const serviceItems = lineItems.filter(item => item.type === "service" || item.service_id);
            const productItems = lineItems.filter(item => item.type === "product" || item.product_id);
            const membershipItems = lineItems.filter(item => item.type === "membership" || (!item.service_id && !item.product_id && item.item_name && item.item_name.startsWith("Membership:")));

            return (
              <div className="space-y-3">
                {/* MEMBERSHIPS SECTION */}
                {membershipItems.length > 0 && (
                  <div className="space-y-1.5">
                    {membershipItems.map((item, idx) => {
                      const itemName = (item.item_name || item.name || `Membership`).toUpperCase();
                      const amount = item.line_total || item.total || item.unit_price || 0;

                      return (
                        <div key={idx} className="space-y-0.5 text-black">
                          <div className="flex justify-between items-start font-bold">
                            <span className="w-2/3 break-words leading-tight">{itemName}</span>
                            <span className="w-1/3 text-right font-extrabold">{formatCurrency(amount)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* SERVICES SECTION */}
                {serviceItems.length > 0 && (
                  <div>
                    <div className="font-bold uppercase border-b border-dashed border-slate-300 pb-0.5 mb-1 text-black flex justify-between">
                      <span className="w-2/3">SERVICES</span>
                      <span className="w-1/3 text-right">AMT</span>
                    </div>
                    <div className="space-y-1.5">
                      {serviceItems.map((item, idx) => {
                        const isFreeReward = item.is_free_reward || item.is_free_visit_reward || (item.discount > 0 && item.line_total === 0);
                        const itemName = (item.item_name || item.name || item.service_name || `Service #${idx + 1}`).toUpperCase();
                        const staffName = item.staff_name || item.employee_name || (item.employee_names ? item.employee_names.join(", ") : "");
                        const rate = item.unit_price || item.rate || (item.price || 0);
                        const qty = item.quantity || item.qty || 1;
                        const amount = item.line_total || item.total || (rate * qty);

                        return (
                          <div key={idx} className="space-y-0.5 text-black">
                            <div className="flex justify-between items-start font-bold">
                              <span className="w-2/3 break-words leading-tight">
                                {itemName}
                                {isFreeReward && (
                                  <span className="block text-[10px] text-black font-extrabold italic">
                                    🎁 Membership Reward Claimed: FREE
                                  </span>
                                )}
                              </span>
                              <span className="w-1/3 text-right font-extrabold">
                                {isFreeReward ? "FREE" : formatCurrency(amount)}
                              </span>
                            </div>
                            {(showQty || showRate || staffName) && (
                              <div className="text-[11px] text-black space-x-2">
                                {showQty && <span>Qty: {qty}</span>}
                                {showRate && <span>Rate: {formatCurrency(rate)}</span>}
                                {staffName && <span className="italic">Staff: {staffName}</span>}
                              </div>
                            )}
                            {item.discount > 0 && !isFreeReward && (
                              <div className="text-[11px] text-black">
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
                    <div className="font-bold uppercase border-b border-dashed border-slate-300 pb-0.5 mb-1 text-black flex justify-between">
                      <span className="w-2/3 text-left">PRODUCTS</span>
                      <span className="w-1/3 text-right">AMT</span>
                    </div>
                    <div className="space-y-1.5">
                      {productItems.map((item, idx) => {
                        const itemName = (item.item_name || item.name || item.product_name || `Product #${idx + 1}`).toUpperCase();
                        const qty = item.quantity || item.qty || 1;
                        const rate = item.unit_price || item.rate || (item.price || 0);
                        const mrp = item.mrp || item.unit_price || item.rate || (item.price || 0);
                        const amount = item.line_total || item.total || (rate * qty);

                        return (
                          <div key={idx} className="space-y-0.5 text-black">
                            <div className="flex justify-between items-start">
                              <span className="w-2/3 break-words leading-tight font-bold">{itemName}</span>
                              <span className="w-1/3 text-right font-extrabold">{formatCurrency(amount)}</span>
                            </div>
                            {(showQty || showRate || showMrp) && (
                              <div className="text-[11px] text-black space-x-2">
                                {showQty && <span>Qty: {qty}</span>}
                                {showRate && <span>Rate: {formatCurrency(rate)}</span>}
                                {showMrp && <span>MRP: {formatCurrency(mrp)}</span>}
                              </div>
                            )}
                            {item.discount > 0 && (
                              <div className="text-[11px] text-black text-right">
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
      )}

      {/* SEPARATOR 3 */}
      <div className="border-b border-dashed border-slate-300 my-1.5" />

      {/* 4. FINANCIAL SUMMARY */}
      <div className="text-xs space-y-0.5 text-black">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span className="font-semibold">{formatCurrency(invoice.subtotal || 0)}</span>
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

        {showTax && (invoice.tax || 0) > 0 && (
          <div className="flex justify-between">
            <span>GST (Service):</span>
            <span>{formatCurrency(invoice.tax)}</span>
          </div>
        )}

        {/* HIGHLIGHTED NET PAYABLE BOX */}
        <div className="flex justify-between items-center text-sm font-bold text-black border border-slate-300 p-1.5 my-1.5">
          <span>NET PAYABLE:</span>
          <span className="text-base font-black">{formatCurrency(invoice.total || invoice.net_payable || 0)}</span>
        </div>
      </div>

      {/* SEPARATOR 4 */}
      <div className="border-b border-dashed border-slate-300 my-1.5" />

      {/* 5. PAYMENT METHOD(S) */}
      <div className="text-xs space-y-0.5 text-black">
        <span className="font-bold text-xs uppercase block mb-0.5">PAYMENT METHOD(S):</span>
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

        {invoice.change_returned > 0 && (
          <div className="flex justify-between font-bold border-t border-dotted border-slate-300 pt-0.5 mt-0.5">
            <span>Change Returned:</span>
            <span>{formatCurrency(invoice.change_returned)}</span>
          </div>
        )}
      </div>

      {/* SEPARATOR 5 */}
      <div className="border-b border-dashed border-slate-300 my-1.5" />

      {/* 6. THANK YOU & FOOTER */}
      <div className="text-center space-y-1 text-xs text-black pt-1">
        <p className="font-bold">Thank you for visiting. Please visit again.</p>
        <p className="text-[10px] text-slate-400 font-semibold pt-1">Powered By SmartGoNext</p>
      </div>

      {/* 8. NOTES */}
      {invoice.notes && (
        <div className="text-xs text-black space-y-0.5 pt-0.5">
          <span className="font-bold block">Notes:</span>
          <p className="italic">{invoice.notes}</p>
        </div>
      )}
    </div>
  );
});

ThermalReceipt.displayName = "ThermalReceipt";
