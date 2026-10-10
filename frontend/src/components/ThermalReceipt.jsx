import React from "react";
import { useLanguageCurrency } from "../context/LanguageCurrencyContext";
import { getFullImageUrl } from "../utils/imageUrl";
import { getShopNameStyle } from "../utils/fontLoader";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export function buildThermalReceiptHtml(targetEl, paperSize = "80mm") {
  // Clone and ensure image URLs are fully resolved
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = targetEl.innerHTML;
  const targetImgs = targetEl.querySelectorAll("img");
  const clonedImgs = tempDiv.querySelectorAll("img");
  targetImgs.forEach((orig, idx) => {
    if (clonedImgs[idx]) {
      const fullSrc = orig.currentSrc || orig.src;
      if (fullSrc) clonedImgs[idx].src = fullSrc;
    }
  });

  const receiptHtml = tempDiv.innerHTML;
  const is58mm = paperSize === "58mm";
  const pixelWidth = is58mm ? "240px" : "310px";
  const logoSize = is58mm ? "46px" : "54px";

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Thermal Receipt</title>
    <style>
      @page {
        size: auto;
        margin: 0mm !important;
      }
      @media print {
        @page {
          size: auto;
          margin: 0mm !important;
        }
        html, body {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          min-height: 0 !important;
          height: auto !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .receipt {
          width: 100% !important;
          max-width: ${is58mm ? "54mm" : "76mm"} !important;
          min-width: 0 !important;
          margin: 0 auto !important;
          padding: 1mm 1mm 3mm 1mm !important;
          border: none !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          page-break-after: avoid !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
      }
      *, *:before, *:after {
        box-sizing: border-box !important;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        background: #ffffff !important;
        color: #000000 !important;
        font-family: 'Courier New', Courier, monospace, sans-serif !important;
        font-size: 11.5px !important;
        line-height: 1.25 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .receipt {
        width: ${pixelWidth} !important;
        max-width: ${pixelWidth} !important;
        margin: 0 auto !important;
        padding: 8px 6px !important;
        box-sizing: border-box !important;
        background: #ffffff !important;
        border: 1px solid #e2e8f0 !important;
        border-radius: 4px !important;
        color: #000000 !important;
      }
      .receipt * {
        color: #000000 !important;
        background: transparent !important;
        text-shadow: none !important;
      }
      .receipt-logo, img.receipt-logo, img {
        width: ${logoSize} !important;
        height: ${logoSize} !important;
        max-width: ${logoSize} !important;
        max-height: ${logoSize} !important;
        border-radius: 50% !important;
        object-fit: cover !important;
        display: block !important;
        margin: 0 auto 4px auto !important;
        border: 1px solid #e2e8f0 !important;
      }
      .rounded-full { border-radius: 50% !important; }
      .object-cover { object-fit: cover !important; }
      .mx-auto { margin-left: auto !important; margin-right: auto !important; }
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
      .border-b, .border-t, .border-y {
        border-color: #cbd5e1 !important;
        border-width: 1px !important;
      }
      .border-b { border-bottom: 1px solid #cbd5e1 !important; }
      .border-t { border-top: 1px solid #cbd5e1 !important; }
      .border-dashed, .border-dotted {
        border-style: solid !important;
        border-color: #cbd5e1 !important;
        border-bottom: 1px solid #cbd5e1 !important;
      }
      .border-slate-300, .border-slate-200 { border-color: #cbd5e1 !important; }
      .my-1 { margin-top: 2px !important; margin-bottom: 2px !important; }
      .my-1\\.5 { margin-top: 3px !important; margin-bottom: 3px !important; }
      .py-1 { padding-top: 2px !important; padding-bottom: 2px !important; }
      .p-1 { padding: 2px !important; }
      .p-1\\.5 { padding: 3px !important; }
      .p-2 { padding: 4px !important; }
      .space-y-0\\.5 > * + * { margin-top: 2px !important; }
      .space-y-1 > * + * { margin-top: 2px !important; }
      .space-y-1\\.5 > * + * { margin-top: 3px !important; }
      .space-y-2 > * + * { margin-top: 4px !important; }
      .truncate { overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
      .break-words { overflow-wrap: break-word !important; }
      table { width: 100%; border-collapse: collapse; }
      th, td { font-size: 11px; padding: 2px 0; color: #000000; }
      .dashed-line {
        border-bottom: 1px solid #cbd5e1 !important;
        margin: 3px 0 !important;
        width: 100% !important;
      }
      .net-payable-box {
        border-top: 1px solid #cbd5e1 !important;
        border-bottom: 1px solid #cbd5e1 !important;
        background: #ffffff !important;
        padding: 3px 0 !important;
        font-weight: bold !important;
        margin-top: 3px !important;
        margin-bottom: 3px !important;
      }
    </style>
  </head>
  <body>
    <div class="receipt">
      ${receiptHtml}
    </div>
  </body>
</html>`;
}

export async function generateThermalReceiptPDF(elementOrRef, invoiceNumber = "INV-0001", paperSize = "80mm") {
  let targetEl = null;
  let invNum = invoiceNumber;

  if (elementOrRef && elementOrRef.current) {
    targetEl = elementOrRef.current;
  } else if (typeof elementOrRef === "string") {
    targetEl = document.getElementById(elementOrRef);
  } else if (elementOrRef instanceof HTMLElement) {
    targetEl = elementOrRef;
  } else if (elementOrRef && typeof elementOrRef === "object" && !elementOrRef.tagName) {
    invNum = elementOrRef.invoice_number || elementOrRef.id || invNum;
  }

  if (!targetEl) {
    targetEl = document.getElementById("thermal-receipt-printable") || document.querySelector(".thermal-receipt-print-area");
  }

  if (!targetEl) {
    if (window.__showError) window.__showError("Thermal receipt content is not available for PDF export.");
    return null;
  }

  const is58mm = paperSize === "58mm";
  const htmlDoc = buildThermalReceiptHtml(targetEl, paperSize);

  let iframe = null;
  try {
    // Isolate rendering inside iframe to avoid Tailwind v4 oklch() color parse errors
    iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-9999px";
    iframe.style.top = "0";
    iframe.style.width = is58mm ? "240px" : "320px";
    iframe.style.height = "1200px";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(htmlDoc);
    doc.close();

    // Small delay for DOM layout in isolated document
    await new Promise((resolve) => setTimeout(resolve, 120));

    const receiptEl = doc.querySelector(".receipt") || doc.body;

    const canvas = await html2canvas(receiptEl, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const imgData = canvas.toDataURL("image/png");
    const imgWidth = is58mm ? 58 : 80;
    const pageHeight = Math.max(80, (canvas.height * imgWidth) / canvas.width);

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [imgWidth, pageHeight],
    });

    pdf.addImage(imgData, "PNG", 0, 0, imgWidth, pageHeight);
    const cleanInvNumber = (invNum || invoiceNumber || "Receipt").replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `Invoice_${cleanInvNumber}.pdf`;
    const blob = pdf.output("blob");
    const file = new File([blob], filename, { type: "application/pdf" });
    return { pdf, blob, file, filename };
  } catch (err) {
    console.error("PDF Export Error:", err);
    if (window.__showError) {
      window.__showError("Failed to generate PDF receipt: " + (err?.message || "Render error"));
    }
    return null;
  } finally {
    if (iframe && iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  }
}

export async function downloadThermalReceiptPDF(elementOrRef, invoiceNumber = "INV-0001", paperSize = "80mm") {
  const result = await generateThermalReceiptPDF(elementOrRef, invoiceNumber, paperSize);
  if (result && result.pdf) {
    result.pdf.save(result.filename);
    if (window.__showSuccess) {
      window.__showSuccess("PDF invoice downloaded successfully!");
    }
    return result;
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
    targetEl = document.getElementById("thermal-receipt-printable") || document.querySelector(".thermal-receipt-print-area");
  }

  if (!targetEl || !targetEl.innerHTML || targetEl.innerHTML.trim() === "") {
    if (window.__showError) {
      window.__showError("Thermal Receipt content is empty or not rendered. Please try again.");
    }
    return;
  }

  const htmlDocument = buildThermalReceiptHtml(targetEl, paperSize);

  const triggerWindowPrint = (targetWindow, blobUrlToRevoke = null) => {
    try {
      targetWindow.focus();
      const doPrint = () => {
        try {
          targetWindow.print();
          if (blobUrlToRevoke) {
            setTimeout(() => URL.revokeObjectURL(blobUrlToRevoke), 10000);
          }
        } catch (err) {
          console.error("Print execution failed:", err);
        }
      };

      const images = targetWindow.document.images;
      if (images && images.length > 0) {
        let loaded = 0;
        const checkDone = () => {
          loaded++;
          if (loaded >= images.length) {
            setTimeout(doPrint, 150);
          }
        };
        for (let i = 0; i < images.length; i++) {
          const img = images[i];
          if (img.complete) {
            loaded++;
          } else {
            img.onload = checkDone;
            img.onerror = () => {
              img.style.display = "none";
              checkDone();
            };
          }
        }
        if (loaded >= images.length) {
          setTimeout(doPrint, 150);
        } else {
          setTimeout(doPrint, 1000);
        }
      } else {
        setTimeout(doPrint, 150);
      }
    } catch (e) {
      console.error("Trigger window print error:", e);
    }
  };

  try {
    const blob = new Blob([htmlDocument], { type: "text/html;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    const printWin = window.open(blobUrl, "_blank", "width=380,height=600,top=100,left=100");

    if (printWin) {
      if (printWin.document.readyState === "complete") {
        setTimeout(() => triggerWindowPrint(printWin, blobUrl), 200);
      } else {
        printWin.onload = () => triggerWindowPrint(printWin, blobUrl);
      }
      return;
    }
  } catch (e) {
    console.warn("Blob URL window popup failed, falling back to direct write:", e);
  }

  const printWin = window.open("", "_blank", "width=380,height=600,top=100,left=100");
  if (printWin) {
    printWin.document.open();
    printWin.document.write(htmlDocument);
    printWin.document.close();
    setTimeout(() => triggerWindowPrint(printWin), 250);
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
          size: auto;
          margin: 0mm !important;
        }
        @media print {
          @page {
            size: auto;
            margin: 0mm !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            min-height: 0 !important;
            height: auto !important;
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
            padding: 2mm 2mm 4mm 2mm !important;
            width: 100% !important;
            max-width: ${is58mm ? "54mm" : "76mm"} !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: 'Courier New', Courier, monospace, sans-serif !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: avoid !important;
          }
        }
      `}</style>

      {/* 1. LOGO & BRANDING HEADER (Circular Logo -> Parlour Name -> Address -> Phone) */}
      <div className="text-center space-y-1">
        {showLogo && (
          <div className="flex justify-center pb-1">
            <img
              src={formattedLogoUrl}
              alt="Logo"
              className="receipt-logo rounded-full object-cover mx-auto"
              style={{
                width: is58mm ? "46px" : "54px",
                height: is58mm ? "46px" : "54px",
                maxWidth: is58mm ? "46px" : "54px",
                maxHeight: is58mm ? "46px" : "54px",
                borderRadius: "50%",
                objectFit: "cover",
                display: "block",
                margin: "0 auto 4px auto",
                border: "1px solid #cbd5e1"
              }}
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
      <div className="border-b border-slate-200 my-1 w-full" />

      {/* 2. INVOICE METADATA (Bill No -> Client -> Date -> Loyalty Visit Status) */}
      <div className="text-xs space-y-0.5 text-black">
        <div className="flex justify-between font-bold">
          <span>Bill No:</span>
          <span className="font-extrabold numeric">{cleanBillNo}</span>
        </div>
        <div className="flex justify-between font-bold">
          <span>Client:</span>
          <span className="truncate max-w-[150px]">{customerName}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>Date:</span>
          <span className="numeric">{formattedDate}</span>
        </div>
        {!hideLoyaltyStatus && invoice.membership_name && (
          <div className="flex justify-between font-bold text-black border-t border-slate-200 pt-0.5 mt-0.5">
            <span>Loyalty Status:</span>
            <span className="font-extrabold text-right">{invoice.membership_name}</span>
          </div>
        )}
      </div>

      {/* SEPARATOR 2 (only show if line items section is visible) */}
      {!hideLineItems && <div className="border-b border-slate-200 my-1 w-full" />}

      {/* 3. ITEM TABLE HEADER */}
      {!hideLineItems && (
        <div className="text-xs">
          {(() => {
            const lineItems = invoice.line_items || invoice.items || [];
            const serviceItems = lineItems.filter(item => item.type === "service" || item.service_id);
            const productItems = lineItems.filter(item => item.type === "product" || item.product_id);
            const membershipItems = lineItems.filter(item => item.type === "membership" || (!item.service_id && !item.product_id && item.item_name && item.item_name.startsWith("Membership:")));

            return (
              <div className="space-y-2">
                {/* MEMBERSHIPS SECTION */}
                {membershipItems.length > 0 && (
                  <div className="space-y-1">
                    {membershipItems.map((item, idx) => {
                      const itemName = (item.item_name || item.name || `Membership`).toUpperCase();
                      const amount = item.line_total || item.total || item.unit_price || 0;

                      return (
                        <div key={idx} className="space-y-0.5 text-black">
                          <div className="flex justify-between items-start font-bold">
                            <span className="w-2/3 break-words leading-tight">{itemName}</span>
                            <span className="w-1/3 text-right font-extrabold numeric">{formatCurrency(amount)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* SERVICES SECTION */}
                {serviceItems.length > 0 && (
                  <div>
                    <div className="font-bold uppercase border-b border-slate-200 pb-0.5 mb-1 text-black flex justify-between">
                      <span className="w-2/3">SERVICES</span>
                      <span className="w-1/3 text-right">AMT</span>
                    </div>
                    <div className="space-y-1">
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
                              <span className="w-1/3 text-right font-extrabold numeric">
                                {isFreeReward ? "FREE" : formatCurrency(amount)}
                              </span>
                            </div>
                            {(showQty || showRate || staffName) && (
                              <div className="text-[11px] text-black space-x-2">
                                {showQty && <span>Qty: <span className="numeric">{qty}</span></span>}
                                {showRate && <span>Rate: <span className="numeric">{formatCurrency(rate)}</span></span>}
                                {staffName && <span className="italic">Staff: {staffName}</span>}
                              </div>
                            )}
                            {item.discount > 0 && !isFreeReward && (
                              <div className="text-[11px] text-black">
                                Disc: -<span className="numeric">{formatCurrency(item.discount)}</span>
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
                    <div className="font-bold uppercase border-b border-slate-200 pb-0.5 mb-1 text-black flex justify-between">
                      <span className="w-2/3 text-left">PRODUCTS</span>
                      <span className="w-1/3 text-right">AMT</span>
                    </div>
                    <div className="space-y-1">
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
                              <span className="w-1/3 text-right font-extrabold numeric">{formatCurrency(amount)}</span>
                            </div>
                            {(showQty || showRate || showMrp) && (
                              <div className="text-[11px] text-black space-x-2">
                                {showQty && <span>Qty: <span className="numeric">{qty}</span></span>}
                                {showRate && <span>Rate: <span className="numeric">{formatCurrency(rate)}</span></span>}
                                {showMrp && <span>MRP: <span className="numeric">{formatCurrency(mrp)}</span></span>}
                              </div>
                            )}
                            {item.discount > 0 && (
                              <div className="text-[11px] text-black text-right">
                                Disc: -<span className="numeric">{formatCurrency(item.discount)}</span>
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
      <div className="border-b border-slate-200 my-1 w-full" />

      {/* 4. FINANCIAL SUMMARY */}
      <div className="text-xs space-y-0.5 text-black">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span className="font-semibold numeric">{formatCurrency(invoice.subtotal || 0)}</span>
        </div>

        {(invoice.discount || 0) > 0 && (
          <div className="flex justify-between font-bold">
            <span>Discount:</span>
            <span className="numeric">-{formatCurrency(invoice.discount)}</span>
          </div>
        )}

        {invoice.membership_name && (
          <div className="flex justify-between font-bold text-black border-t border-slate-200 pt-0.5">
            <span>Membership ({invoice.membership_name}):</span>
            <span className="numeric">-{formatCurrency(invoice.membership_discount || 0)}</span>
          </div>
        )}

        {showTax && (invoice.tax || 0) > 0 && (
          <div className="flex justify-between">
            <span>GST (Service):</span>
            <span className="numeric">{formatCurrency(invoice.tax)}</span>
          </div>
        )}

        {/* HIGHLIGHTED NET PAYABLE WITH THIN FULL-WIDTH BORDER */}
        <div className="flex justify-between items-center text-sm font-bold text-black border-y border-slate-300 py-1 my-1 w-full">
          <span>NET PAYABLE:</span>
          <span className="text-base font-black numeric">{formatCurrency(invoice.total || invoice.net_payable || 0)}</span>
        </div>
      </div>

      {/* 5. PAYMENT METHOD(S) */}
      <div className="text-xs space-y-0.5 text-black">
        <span className="font-bold text-xs uppercase block mb-0.5">PAYMENT METHOD(S):</span>
        {invoice.payments && invoice.payments.length > 0 ? (
          invoice.payments.map((p, idx) => (
            <div key={idx} className="flex justify-between">
              <span>Paid ({p.method || p.payment_method}):</span>
              <span className="font-bold numeric">{formatCurrency(p.amount || 0)}</span>
            </div>
          ))
        ) : (
          <div className="flex justify-between">
            <span>Paid ({invoice.payment_method || "Cash"}):</span>
            <span className="font-bold numeric">{formatCurrency(invoice.total || 0)}</span>
          </div>
        )}

        {invoice.change_returned > 0 && (
          <div className="flex justify-between font-bold border-t border-slate-200 pt-0.5 mt-0.5">
            <span>Change Returned:</span>
            <span className="numeric">{formatCurrency(invoice.change_returned)}</span>
          </div>
        )}
      </div>

      {/* SEPARATOR 5 */}
      <div className="border-b border-slate-200 my-1 w-full" />

      {/* 6. THANK YOU & FOOTER */}
      <div className="text-center space-y-0.5 text-xs text-black pt-1">
        <p className="font-bold">{settings.thank_you_message || "Thank you. Please visit again."}</p>
        {businessProfile.phone && (
          <p className="text-[11px] font-semibold text-black">For appointments, Please call on {businessProfile.phone}</p>
        )}
        <p className="text-[9px] text-slate-400 font-semibold pt-1">Powered By SmartGoNext</p>
      </div>

      {/* 7. NOTES */}
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
