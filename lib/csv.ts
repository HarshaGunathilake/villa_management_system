/** Builds a CSV file in the browser and downloads it. Opens cleanly in Excel and Google Sheets. */

type Cell = string | number | null | undefined;

function cell(value: Cell) {
  let s = value === null || value === undefined ? "" : String(value);
  // A cell starting with = + - @ would run as a formula in a spreadsheet.
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: Cell[][]) {
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, header: string[], rows: Cell[][]) {
  // The byte-order mark tells Excel the file is UTF-8.
  const blob = new Blob(["﻿", toCsv(header, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
