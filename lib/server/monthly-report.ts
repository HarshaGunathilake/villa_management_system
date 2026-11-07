import { toCsv } from "../csv";
import { addMonths, fmtFull, fmtMonthLong, monthKey } from "../dates";
import { payslipNumber, payslipTotals } from "../payroll";
import { buildReport, type VillaReport } from "../reports";
import type { AppData } from "../types";
import { config, nowSql, serverToday } from "./config";
import { db } from "./db";
import { ApiError } from "./http";
import { esc, sendEmail, type MailAttachment } from "./mail";
import { loadVillaData } from "./tenant";

/*
 * The monthly report an owner can choose to get by email. It is sent on the
 * 1st for the month just finished (a daily job, see /api/cron/monthly-reports),
 * and an owner can also send any past month to themselves from Villa settings.
 * The figures are the same as on the Reports page.
 */

const money = (n: number) => `LKR ${Math.round(n).toLocaleString("en-US")}`;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "villa";
const BOM = "﻿";

interface Recipients {
  to: string[];
  cc: string;
}

async function recipients(villaId: string): Promise<Recipients & { villaName: string; ownerName: string }> {
  const villa = await db.one<{ name: string; report_cc: string | null }>("SELECT name, report_cc FROM villas WHERE id = ?", [villaId]);
  if (!villa) throw new ApiError(404, "not_found", "Villa not found.");
  const owners = await db.query<{ name: string; email: string }>(
    "SELECT name, email FROM users WHERE villa_id = ? AND role = 'villa_admin' AND status = 'active' ORDER BY created_at",
    [villaId],
  );
  return { to: owners.map((o) => o.email), cc: villa.report_cc ?? "", villaName: villa.name, ownerName: owners[0]?.name ?? "" };
}

/* ------------------------------------------------------------- the email */

function change(now: number, before: number) {
  if (before <= 0 || now === before) return "";
  const pct = Math.round(((now - before) / Math.abs(before)) * 100);
  return pct === 0 ? "" : `${pct > 0 ? "▲" : "▼"} ${Math.abs(pct)}%`;
}

function tile(label: string, value: string, note: string, tint = "#ffffff") {
  return `<td width="50%" style="padding:6px"><div style="background:${tint};border:1px solid #e3e8e6;border-radius:12px;padding:14px 16px">
<div style="font-size:13px;color:#55615f">${esc(label)}</div>
<div style="font-size:22px;font-weight:700;color:#0e1a19;margin-top:4px">${esc(value)}</div>
<div style="font-size:12px;color:#55615f;margin-top:4px">${esc(note)}</div></div></td>`;
}

function table(title: string, rows: { label: string; value: string; extra?: string }[], empty: string) {
  const body = rows.length
    ? rows
        .map(
          (r) => `<tr><td style="padding:8px 0;border-bottom:1px solid #eef1f0;font-size:14px;color:#0e1a19">${esc(r.label)}${r.extra ? `<div style="font-size:12px;color:#55615f">${esc(r.extra)}</div>` : ""}</td>
<td align="right" style="padding:8px 0;border-bottom:1px solid #eef1f0;font-size:14px;font-weight:600;color:#0e1a19;white-space:nowrap">${esc(r.value)}</td></tr>`,
        )
        .join("")
    : `<tr><td style="padding:8px 0;font-size:14px;color:#55615f">${esc(empty)}</td></tr>`;
  return `<h2 style="margin:28px 0 6px;font-size:16px;color:#0e1a19">${esc(title)}</h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table>`;
}

const share = (value: number, total: number) => (total > 0 ? `${Math.round((value / total) * 100)}%` : "");

export function monthlyReportEmail(platform: string, villaName: string, month: string, r: VillaReport, prev: VillaReport, data: AppData) {
  const m = r.months[0];
  const label = fmtMonthLong(month);
  const prevLabel = fmtMonthLong(addMonths(month, -1)).split(" ")[0];
  const slips = data.payslips.filter((p) => p.month === month);
  const staffPaid = slips.reduce((s, p) => s + payslipTotals(p).net, 0);
  const owing = r.bookings.filter((b) => b.booking.total - b.booking.paid > 0).sort((a, b) => b.booking.total - b.booking.paid - (a.booking.total - a.booking.paid));
  const guestName = new Map(data.guests.map((g) => [g.id, g.name]));
  const link = config.appUrl ? `${config.appUrl}/reports` : null;
  const vs = (now: number, before: number) => {
    const c = change(now, before);
    return c ? `${c} on ${prevLabel}` : `${prevLabel}: ${money(before)}`;
  };

  const html = `<!doctype html><html><body style="margin:0;background:#f3f5f4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f4;padding:28px 10px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;padding:28px">
<tr><td style="font-size:14px;font-weight:700;color:#0b5d50;padding-bottom:18px">${esc(platform)} · Monthly report</td></tr>
<tr><td>
<h1 style="margin:0;font-size:26px;line-height:1.2;color:#0e1a19">${esc(villaName)}</h1>
<div style="margin-top:4px;font-size:16px;color:#55615f">${esc(label)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;margin-left:-6px;margin-right:-6px">
<tr>${tile("Income", money(r.income), vs(r.income, prev.income))}${tile("Expenses", money(r.expenses), vs(r.expenses, prev.expenses))}</tr>
<tr>${tile("Profit", money(r.profit), r.income > 0 ? `${Math.round((r.profit / r.income) * 100)}% of income` : vs(r.profit, prev.profit), "#e9f4ef")}${tile("Occupancy", `${r.occupancy}%`, `${m?.nightsBooked ?? 0} nights with guests`)}</tr>
</table>
<p style="margin:14px 0 0;font-size:14px;color:#3c4846">${m?.bookings ?? 0} bookings${r.averageNight ? `, ${money(r.averageNight)} a night on average` : ""}.</p>
${table("Income by room", r.byPlace.map((x) => ({ label: x.label, value: money(x.value), extra: share(x.value, r.income) })), "No income this month.")}
${table("Where bookings came from", r.bySource.map((x) => ({ label: x.label, value: money(x.value), extra: share(x.value, r.income) })), "No bookings this month.")}
${table("Expenses by category", r.byCategory.map((x) => ({ label: x.label, value: money(x.value), extra: share(x.value, r.expenses) })), "No expenses this month.")}
${slips.length ? table("Staff pay", slips.map((p) => ({ label: `${p.staffName} (${payslipNumber(p.number)})`, value: money(payslipTotals(p).net), extra: p.paidOn ? `Paid ${fmtFull(p.paidOn)}` : "Not paid yet" })), "") : ""}
${owing.length ? table(`Still to collect: ${money(r.toCollect)}`, owing.slice(0, 8).map((b) => ({ label: guestName.get(b.booking.guestId) ?? "Guest", value: money(b.booking.total - b.booking.paid), extra: b.number })), "") : ""}
${link ? `<p style="margin:28px 0 0"><a href="${esc(link)}" style="display:inline-block;background:#0b5d50;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:10px">Open your reports</a></p>` : ""}
<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#55615f">Every booking and expense for the month is attached as a spreadsheet (CSV). You get this email because Monthly report is switched on in Villa settings, where you can turn it off.</p>
</td></tr></table></td></tr></table></body></html>`;

  const text = [
    `${villaName}: ${label}`,
    "",
    `Income ${money(r.income)} (${vs(r.income, prev.income)})`,
    `Expenses ${money(r.expenses)} (${vs(r.expenses, prev.expenses)})`,
    `Profit ${money(r.profit)}`,
    `Occupancy ${r.occupancy}%, ${m?.bookings ?? 0} bookings`,
    "",
    "Income by room:",
    ...r.byPlace.map((x) => `  ${x.label}: ${money(x.value)}`),
    "Expenses by category:",
    ...r.byCategory.map((x) => `  ${x.label}: ${money(x.value)}`),
    ...(slips.length ? ["", `Staff pay: ${money(staffPaid)} (${slips.length} payslips)`] : []),
    ...(r.toCollect ? [`Still to collect: ${money(r.toCollect)}`] : []),
    ...(link ? ["", `Open your reports: ${link}`] : []),
    "",
    `— ${platform}`,
  ].join("\n");

  return { subject: `${villaName}: your report for ${label}`, html, text };
}

/* ------------------------------------------------------------ attachments */

export function monthlyReportFiles(villaName: string, month: string, r: VillaReport, data: AppData): MailAttachment[] {
  const base = `${slug(villaName)}-${month}`;
  const guest = new Map(data.guests.map((g) => [g.id, g]));
  const room = new Map(data.rooms.map((x) => [x.id, x.name]));
  const files: MailAttachment[] = [
    {
      filename: `${base}-bookings.csv`,
      contentType: "text/csv; charset=utf-8",
      content:
        BOM +
        toCsv(
          ["Booking", "Guest", "Phone", "Stay", "Check-in", "Check-out", "Nights this month", "Income this month (LKR)", "Booking total (LKR)", "Paid (LKR)", "Balance (LKR)", "Source", "Status"],
          r.bookings.map((x) => {
            const b = x.booking;
            return [
              x.number, guest.get(b.guestId)?.name ?? "", guest.get(b.guestId)?.phone ?? "", b.type === "villa" ? "Entire Villa" : room.get(b.roomId ?? "") ?? "Room",
              b.checkIn, b.checkOut, x.nightsInPeriod, x.incomeInPeriod, b.total, b.paid, Math.max(b.total - b.paid, 0), b.source, b.status.replace("_", " "),
            ];
          }),
        ),
    },
    {
      filename: `${base}-expenses.csv`,
      contentType: "text/csv; charset=utf-8",
      content:
        BOM +
        toCsv(
          ["Date", "What for", "Category", "Amount (LKR)", "Note"],
          data.expenses.filter((e) => monthKey(e.date) === month).sort((a, b) => a.date.localeCompare(b.date)).map((e) => [e.date, e.name, e.category, e.amount, e.note ?? ""]),
        ),
    },
  ];
  const slips = data.payslips.filter((p) => p.month === month);
  if (slips.length) {
    files.push({
      filename: `${base}-payslips.csv`,
      contentType: "text/csv; charset=utf-8",
      content:
        BOM +
        toCsv(
          ["Payslip", "Name", "Job", "Pay", "Days worked", "Basic (LKR)", "Additions (LKR)", "Deductions (LKR)", "Net pay (LKR)", "EPF 12% + ETF 3% (LKR)", "Paid on"],
          slips.map((p) => {
            const t = payslipTotals(p);
            return [payslipNumber(p.number), p.staffName, p.staffRole, p.payType === "daily" ? "Daily wage" : "Monthly salary", p.days ?? "", t.basic, t.additions, t.deductions, t.net, t.epfEmployer + t.etf, p.paidOn ?? "Not paid"];
          }),
        ),
    });
  }
  return files;
}

/* ---------------------------------------------------------------- sending */

/** Builds and sends one month's report to the villa's owners (and the extra address). */
export async function sendMonthlyReport(villaId: string, month: string): Promise<{ ok: boolean; to: string[]; error?: string }> {
  const who = await recipients(villaId);
  if (!who.to.length) return { ok: false, to: [], error: "This villa has no active owner account to send the report to." };
  const data = await loadVillaData(villaId, who.ownerName);
  const report = buildReport(data, month, month);
  const prev = buildReport(data, addMonths(month, -1), addMonths(month, -1));
  const result = await sendEmail({
    kind: "monthly_report",
    to: who.to.join(", "),
    cc: who.cc && !who.to.includes(who.cc) ? who.cc : undefined,
    villaId,
    attachments: monthlyReportFiles(data.villa.name, month, report, data),
    build: (platform) => monthlyReportEmail(platform, data.villa.name, month, report, prev, data),
  });
  if (result.ok) {
    await db.run("INSERT INTO monthly_reports_sent (villa_id, month, sent_at) VALUES (?,?,?) ON DUPLICATE KEY UPDATE sent_at = VALUES(sent_at)", [villaId, month, nowSql()]);
  }
  return { ok: result.ok, to: [...who.to, ...(who.cc ? [who.cc] : [])], error: result.error };
}

/**
 * The daily job. In the first week of a month it sends last month's report to
 * every villa that has it switched on and hasn't had it yet, so a missed run
 * (or a mail server that was down) is caught up the next day.
 */
export async function runMonthlyReports(today = serverToday()) {
  const day = Number(today.slice(8, 10));
  const month = addMonths(monthKey(today), -1);
  if (day > 7) return { month, due: 0, sent: 0, failed: 0, note: "Reports go out in the first week of the month." };
  const villas = await db.query<{ id: string }>(
    `SELECT v.id FROM villas v
      WHERE v.monthly_report = 1 AND v.account_status = 'active'
        AND NOT EXISTS (SELECT 1 FROM monthly_reports_sent s WHERE s.villa_id = v.id AND s.month = ?)`,
    [month],
  );
  let sent = 0;
  let failed = 0;
  for (const v of villas) {
    const r = await sendMonthlyReport(v.id, month).catch((e) => ({ ok: false, error: String(e) }));
    if (r.ok) sent += 1;
    else failed += 1;
  }
  return { month, due: villas.length, sent, failed };
}
