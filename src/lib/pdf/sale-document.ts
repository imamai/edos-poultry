"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatMoney } from "@/lib/money";

export interface SaleDocumentLine {
  description: string;
  quantity: string;
  unitPrice: number;
  lineTotal: number;
}

export type SaleDocumentKind = "quotation" | "invoice" | "receipt";

export interface SaleDocument {
  kind: SaleDocumentKind;
  tenantName: string;
  farmName: string;
  documentNumber: string;
  date: string;
  currency: string;
  billTo: { name: string; phone?: string | null };
  lines: SaleDocumentLine[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  amountPaidCents?: number; // invoice/receipt only
  validUntil?: string; // quotation only
  filename: string;
}

const PAGE_RIGHT = 555;
const MARGIN_X = 40;

const KIND_LABEL: Record<SaleDocumentKind, string> = {
  quotation: "Quotation",
  invoice: "Invoice",
  receipt: "Receipt",
};

/**
 * Same visual family as downloadSimpleReportPdf (src/lib/pdf/simple-report.ts)
 * -- same header block, printed-date line, divider, and autoTable styling
 * -- extended with a "Bill To" block and a document-status line, since a
 * quotation/invoice/receipt is addressed to one client rather than being
 * a tenant-wide summary.
 */
export function downloadSaleDocumentPdf(doc: SaleDocument) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  let y = 50;

  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text(doc.tenantName, MARGIN_X, y);
  pdf.setFontSize(14);
  pdf.text(KIND_LABEL[doc.kind], PAGE_RIGHT, y, { align: "right" });
  y += 20;

  pdf.setFontSize(11);
  pdf.setFont("helvetica", "normal");
  pdf.text(doc.farmName, MARGIN_X, y);
  pdf.text(`No. ${doc.documentNumber}`, PAGE_RIGHT, y, { align: "right" });
  y += 16;

  pdf.setFontSize(9);
  pdf.setTextColor(120);
  pdf.text(`Date: ${doc.date}`, MARGIN_X, y);
  pdf.setTextColor(0);
  y += 16;

  pdf.setDrawColor(200);
  pdf.line(MARGIN_X, y, PAGE_RIGHT, y);
  y += 18;

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.text("BILL TO", MARGIN_X, y);
  y += 14;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(doc.billTo.name, MARGIN_X, y);
  y += 14;
  if (doc.billTo.phone) {
    pdf.text(doc.billTo.phone, MARGIN_X, y);
    y += 14;
  }
  y += 6;

  autoTable(pdf, {
    startY: y,
    head: [["Description", "Qty", "Unit price", "Total"]],
    body: doc.lines.map((l) => [l.description, l.quantity, formatMoney(l.unitPrice, doc.currency), formatMoney(l.lineTotal, doc.currency)]),
    margin: { left: MARGIN_X, right: 595 - PAGE_RIGHT },
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [29, 77, 67] },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (pdf as any).lastAutoTable.finalY + 20;

  const totalsRows: [string, string][] = [["Subtotal", formatMoney(doc.subtotalCents, doc.currency)]];
  if (doc.discountCents > 0) totalsRows.push(["Discount", `- ${formatMoney(doc.discountCents, doc.currency)}`]);
  totalsRows.push(["Total", formatMoney(doc.totalCents, doc.currency)]);
  if (doc.kind !== "quotation") {
    totalsRows.push(["Amount paid", formatMoney(doc.amountPaidCents ?? 0, doc.currency)]);
    totalsRows.push(["Balance due", formatMoney(doc.totalCents - (doc.amountPaidCents ?? 0), doc.currency)]);
  }

  pdf.setFontSize(10);
  for (const [label, value] of totalsRows) {
    pdf.setFont("helvetica", label === "Total" || label === "Balance due" ? "bold" : "normal");
    pdf.text(label, 380, y);
    pdf.text(value, PAGE_RIGHT, y, { align: "right" });
    y += 16;
  }

  y += 14;
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  if (doc.kind === "quotation") {
    pdf.text(doc.validUntil ? `Valid until ${doc.validUntil}` : "No expiry date set", MARGIN_X, y);
  } else {
    const balance = doc.totalCents - (doc.amountPaidCents ?? 0);
    pdf.text(balance <= 0 ? "PAID IN FULL" : `BALANCE DUE: ${formatMoney(balance, doc.currency)}`, MARGIN_X, y);
  }

  pdf.save(doc.filename);
}
