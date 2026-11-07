"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, MessageCircle, Printer, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { whatsappNumber } from "@/components/whatsapp-share";
import { fmtFull, fmtMonthLong } from "@/lib/dates";
import { payslipNumber, payslipTotals } from "@/lib/payroll";
import { useStore } from "@/lib/store";
import { money } from "@/lib/utils";

export default function PayslipPage() {
  return (
    <Suspense fallback={null}>
      <PayslipDocument />
    </Suspense>
  );
}

/** One payslip, ready to print, save as PDF or send to the staff member on WhatsApp. */
function PayslipDocument() {
  const router = useRouter();
  const params = useSearchParams();
  const { payslips, staff, villa, today, payPayslip, deletePayslip, notify, readOnly } = useStore();
  const [paidOn, setPaidOn] = useState(today);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const p = payslips.find((x) => x.id === params.get("p"));

  if (!p) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <EmptyState title="Payslip not found" action={<Button onClick={() => router.push("/staff")}>Go to staff</Button>}>
          This payslip may have been deleted.
        </EmptyState>
      </div>
    );
  }

  const t = payslipTotals(p);
  const person = staff.find((s) => s.id === p.staffId);
  const number = payslipNumber(p.number);
  const label = fmtMonthLong(p.month);
  const basicLabel = p.payType === "daily" ? `Basic pay, ${p.days} days × ${money(p.rate)}` : "Basic salary";

  const message = [
    `Hello ${p.staffName.split(/\s+/)[0]}, here is your payslip from ${villa.name}.`,
    "",
    `*Payslip ${number}, ${label}*`,
    `${basicLabel}: ${money(t.basic)}`,
    ...p.additions.map((a) => `${a.name}: + ${money(a.amount)}`),
    ...(p.epf ? [`EPF 8% of ${money(t.epfBase)}: − ${money(t.epfEmployee)}`] : []),
    ...p.deductions.map((d) => `${d.name}: − ${money(d.amount)}`),
    `*Net pay: ${money(t.net)}*`,
    ...(p.epf ? [`EPF 12% and ETF 3% paid by ${villa.name}: ${money(t.epfEmployer + t.etf)}`] : []),
    p.paidOn ? `Paid on ${fmtFull(p.paidOn)}.` : "",
    "",
    "Thank you for your work.",
  ].filter((l, i, a) => l !== "" || a[i - 1] !== "");
  const to = whatsappNumber(person?.phone);
  const href = `https://wa.me/${to ?? ""}?text=${encodeURIComponent(message.join("\n"))}`;

  const lineRow = (name: string, amount: string, key?: string | number) => (
    <tr key={key ?? name} className="border-b border-line/70">
      <td className="py-2.5 pr-3">{name}</td>
      <td className="py-2.5 text-right font-medium whitespace-nowrap">{amount}</td>
    </tr>
  );

  return (
    <div className="min-h-dvh bg-well/60 px-4 py-6 sm:py-10 print:bg-white print:p-0">
      <div className="no-print mx-auto mb-5 max-w-[50rem] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="secondary" onClick={() => router.push("/staff")}>
            <ArrowLeft /> Back to staff
          </Button>
          <div className="flex flex-wrap gap-3">
            <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#1d7a4a] px-5 font-medium text-white hover:bg-[#166339] [&_svg]:size-5">
              <MessageCircle aria-hidden /> {to ? "Send on WhatsApp" : "Share on WhatsApp"}
              <span className="sr-only">(opens WhatsApp)</span>
            </a>
            <Button onClick={() => window.print()}>
              <Printer /> Print or save as PDF
            </Button>
          </div>
        </div>

        {!p.paidOn ? (
          <div className="flex flex-wrap items-end gap-3 rounded-card border border-amber/40 bg-amber-soft px-4 py-3">
            <div className="min-w-0 flex-[1_1_14rem]">
              <div className="font-semibold text-amber-deep">Not paid yet</div>
              <div className="text-[0.9375rem] text-amber-deep">Marking it paid adds {money(t.cost)} to Expenses under Staff.</div>
            </div>
            <label className="sr-only" htmlFor="paid-on">
              Paid on
            </label>
            <Input id="paid-on" type="date" value={paidOn} max={today} onChange={(e) => setPaidOn(e.target.value)} className="w-auto bg-white" />
            <Button
              disabled={readOnly || !paidOn}
              onClick={() => {
                payPayslip(p.id, paidOn);
                notify("Marked paid and added to expenses");
              }}
            >
              <CheckCircle2 /> Mark as paid
            </Button>
          </div>
        ) : null}
      </div>

      <article className="mx-auto max-w-[50rem] rounded-card border border-line bg-white p-6 shadow-card sm:p-12 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-line pb-6">
          <div>
            <div className="text-2xl font-semibold tracking-tight sm:text-3xl">{villa.name}</div>
            <div className="mt-1 text-muted">{villa.location}</div>
            <div className="text-muted">{villa.phone}</div>
          </div>
          <div className="sm:text-right">
            <h1 className="text-2xl font-semibold sm:text-3xl">Payslip</h1>
            <div className="tnum mt-1 font-medium">{number}</div>
            <div className="text-muted">For {label}</div>
          </div>
        </header>

        <section className="grid gap-6 border-b border-line py-6 sm:grid-cols-2">
          <div>
            <h2 className="mb-1 text-sm font-medium text-muted">Employee</h2>
            <div className="text-lg font-semibold">{p.staffName}</div>
            {p.staffRole ? <div>{p.staffRole}</div> : null}
            {person?.phone ? <div>{person.phone}</div> : null}
            {p.epf && p.epfNumber ? <div>EPF no. {p.epfNumber}</div> : null}
          </div>
          <div>
            <h2 className="mb-1 text-sm font-medium text-muted">Pay</h2>
            <div className="text-lg font-semibold">{p.payType === "daily" ? "Daily wage" : "Monthly salary"}</div>
            <div className="tnum">
              {money(p.rate)} {p.payType === "daily" ? "a day" : "a month"}
            </div>
            {p.payType === "daily" ? <div>{p.days} days worked</div> : null}
          </div>
        </section>

        <section className="grid gap-x-10 gap-y-6 py-6 sm:grid-cols-2">
          <div>
            <h2 className="mb-2 text-sm font-medium text-muted">Earnings</h2>
            <table className="tnum w-full text-left">
              <tbody>
                {lineRow(basicLabel, money(t.basic), "basic")}
                {p.additions.map((a, i) => lineRow(a.name, money(a.amount), `a${i}`))}
                <tr>
                  <td className="pt-2.5 font-semibold">Gross pay</td>
                  <td className="pt-2.5 text-right font-semibold whitespace-nowrap">{money(t.gross)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <h2 className="mb-2 text-sm font-medium text-muted">Deductions</h2>
            <table className="tnum w-full text-left">
              <tbody>
                {p.epf ? lineRow(`EPF, employee 8% of ${money(t.epfBase)}`, money(t.epfEmployee), "epf") : null}
                {p.deductions.map((d, i) => lineRow(d.name, money(d.amount), `d${i}`))}
                {!p.epf && p.deductions.length === 0 ? (
                  <tr className="border-b border-line/70">
                    <td className="py-2.5 text-muted">None</td>
                    <td />
                  </tr>
                ) : null}
                <tr>
                  <td className="pt-2.5 font-semibold">Total deductions</td>
                  <td className="pt-2.5 text-right font-semibold whitespace-nowrap">{money(t.deductions)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-sage-soft px-5 py-4 print:border print:border-line print:bg-white">
          <div>
            <div className="font-medium text-sage-deep">Net pay</div>
            <div className="text-sm text-sage-deep">{p.paidOn ? `Paid on ${fmtFull(p.paidOn)}` : "Not paid yet"}</div>
          </div>
          <div className="tnum text-3xl font-semibold text-sage-deep">{money(t.net)}</div>
        </section>

        {p.epf ? (
          <section className="tnum mt-6 space-y-1.5 text-[0.9375rem]">
            <h2 className="mb-1 text-sm font-medium text-muted">Paid by the employer, on top of pay</h2>
            <p className="mb-2 text-sm text-muted">EPF and ETF are worked out on {money(t.epfBase)}: basic pay less deductions.</p>
            <div className="flex justify-between gap-4">
              <span>EPF, employer 12%</span>
              <span>{money(t.epfEmployer)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>ETF, employer 3%</span>
              <span>{money(t.etf)}</span>
            </div>
          </section>
        ) : null}

        {p.note ? (
          <section className="mt-6 border-t border-line pt-5">
            <h2 className="mb-1 text-sm font-medium text-muted">Note</h2>
            <p className="whitespace-pre-wrap">{p.note}</p>
          </section>
        ) : null}

        <footer className="mt-10 grid gap-10 pt-2 sm:grid-cols-2">
          <div>
            <div className="h-10 border-b border-line-strong" />
            <div className="mt-2 text-sm text-muted">Received by {p.staffName}</div>
          </div>
          <div>
            <div className="h-10 border-b border-line-strong" />
            <div className="mt-2 text-sm text-muted">For {villa.name}</div>
          </div>
        </footer>
      </article>

      <div className="no-print mx-auto mt-5 max-w-[50rem] text-right">
        {confirmDelete ? (
          <div className="inline-flex flex-wrap items-center justify-end gap-2">
            <span className="mr-2">Delete this payslip{p.paidOn ? " and its expense" : ""}?</span>
            <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>
              Keep
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                deletePayslip(p.id);
                notify("Payslip deleted");
                router.push("/staff");
              }}
            >
              Delete
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="text-clay" disabled={readOnly} onClick={() => setConfirmDelete(true)}>
            <Trash2 /> Delete payslip
          </Button>
        )}
      </div>
    </div>
  );
}
