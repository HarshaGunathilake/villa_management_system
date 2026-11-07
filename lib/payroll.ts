import { fmtMonthLong } from "./dates";
import type { PayLine, Payslip } from "./types";

/*
 * Payslip sums. EPF and ETF follow the Sri Lankan rates and are worked out on
 * basic pay (the monthly salary, or the daily wage times the days worked) less
 * the deductions. Additions such as overtime or a bonus are left out:
 *   EPF from the employee  8%, taken off their pay
 *   EPF from the employer 12%, paid on top
 *   ETF from the employer  3%, paid on top
 */

export const EPF_EMPLOYEE = 0.08;
export const EPF_EMPLOYER = 0.12;
export const ETF_EMPLOYER = 0.03;

export interface PayslipTotals {
  basic: number;
  /** What EPF and ETF are worked out on: basic pay less deductions */
  epfBase: number;
  additions: number;
  gross: number;
  epfEmployee: number;
  otherDeductions: number;
  deductions: number;
  net: number;
  epfEmployer: number;
  etf: number;
  /** What the month costs the villa: net pay, both EPF shares and ETF. This is the expense. */
  cost: number;
}

const sum = (lines: PayLine[]) => lines.reduce((s, l) => s + l.amount, 0);

export function payslipTotals(p: Pick<Payslip, "payType" | "rate" | "days" | "additions" | "deductions" | "epf">): PayslipTotals {
  const basic = p.payType === "daily" ? p.rate * (p.days ?? 0) : p.rate;
  const additions = sum(p.additions);
  const gross = basic + additions;
  const otherDeductions = sum(p.deductions);
  const epfBase = Math.max(basic - otherDeductions, 0);
  const epfEmployee = p.epf ? Math.round(epfBase * EPF_EMPLOYEE) : 0;
  const epfEmployer = p.epf ? Math.round(epfBase * EPF_EMPLOYER) : 0;
  const etf = p.epf ? Math.round(epfBase * ETF_EMPLOYER) : 0;
  const deductions = epfEmployee + otherDeductions;
  const net = Math.max(gross - deductions, 0);
  return { basic, epfBase, additions, gross, epfEmployee, otherDeductions, deductions, net, epfEmployer, etf, cost: net + epfEmployee + epfEmployer + etf };
}

export const payslipNumber = (n: number) => `PS-${String(n).padStart(4, "0")}`;

/** The expense a paid payslip becomes. */
export function payslipExpense(p: Payslip) {
  const t = payslipTotals(p);
  const parts = [`${payslipNumber(p.number)}. Net pay LKR ${t.net.toLocaleString("en-US")}`];
  if (p.epf) parts.push(`EPF and ETF LKR ${(t.epfEmployee + t.epfEmployer + t.etf).toLocaleString("en-US")}`);
  return { name: `Salary: ${p.staffName}, ${fmtMonthLong(p.month)}`, amount: t.cost, note: parts.join(". ") };
}
