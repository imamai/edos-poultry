"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface ReportSection {
  title: string;
  rows: [string, string][];
}

export interface ReportTable {
  title: string;
  head: string[];
  body: (string | number)[][];
}

export interface SimpleReport {
  tenantName: string;
  subtitle?: string;
  title: string;
  sections?: ReportSection[];
  table?: ReportTable;
  filename: string;
}

const PAGE_RIGHT = 555;
const MARGIN_X = 40;

/**
 * Builds a small, clean, text-based (not screenshot-based) PDF and triggers
 * a download — real selectable text, small file size, crisp at any zoom.
 * Shared by the Flock and Sales "Download PDF" buttons so every report in
 * the app has the same layout.
 */
export function downloadSimpleReportPdf(report: SimpleReport) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = 50;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(report.tenantName, MARGIN_X, y);
  y += 20;

  if (report.subtitle) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(report.subtitle, MARGIN_X, y);
    y += 16;
  }

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(report.title, MARGIN_X, y);
  y += 14;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  const printedOn = new Date().toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" });
  doc.text(`Printed ${printedOn}`, MARGIN_X, y);
  doc.setTextColor(0);
  y += 16;

  doc.setDrawColor(200);
  doc.line(MARGIN_X, y, PAGE_RIGHT, y);
  y += 18;

  for (const section of report.sections ?? []) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(section.title.toUpperCase(), MARGIN_X, y);
    y += 14;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (const [label, value] of section.rows) {
      doc.text(label, MARGIN_X, y);
      doc.text(value, PAGE_RIGHT, y, { align: "right" });
      doc.setDrawColor(230);
      doc.line(MARGIN_X, y + 4, PAGE_RIGHT, y + 4);
      y += 16;
    }
    y += 10;
  }

  if (report.table) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(report.table.title.toUpperCase(), MARGIN_X, y);
    y += 8;

    autoTable(doc, {
      startY: y,
      head: [report.table.head],
      body: report.table.body,
      margin: { left: MARGIN_X, right: 595 - PAGE_RIGHT },
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [29, 77, 67] },
    });
  }

  doc.save(report.filename);
}
