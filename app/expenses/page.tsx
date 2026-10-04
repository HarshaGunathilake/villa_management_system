"use client";

import { useState } from "react";
import { Droplets, Hammer, Paperclip, Plus, Receipt, ShoppingBasket, Sparkles, Trash2, Users, Wifi, Zap } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@/components/app-shell";
import { MonthNav } from "@/components/month-nav";
import { Button } from "@/components/ui/button";
import { fmtDay, monthKey } from "@/lib/dates";
import { useStore } from "@/lib/store";
import type { ExpenseCategory } from "@/lib/types";
import { money } from "@/lib/utils";

const ICONS: Record<ExpenseCategory, React.ComponentType<{ className?: string }>> = {
  Electricity: Zap,
  Water: Droplets,
  Cleaning: Sparkles,
  Maintenance: Hammer,
  Groceries: ShoppingBasket,
  Staff: Users,
  Internet: Wifi,
  Other: Receipt,
};

export default function ExpensesPage() {
  const { expenses, today, setExpenseFormOpen, deleteExpense, notify } = useStore();
  const [month, setMonth] = useState(monthKey(today));
  const [removing, setRemoving] = useState<string | null>(null);

  const list = expenses.filter((e) => monthKey(e.date) === month).sort((a, b) => b.date.localeCompare(a.date));
  const total = list.reduce((sum, e) => sum + e.amount, 0);
  const byCategory = Object.entries(
    list.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.category]: (acc[e.category] ?? 0) + e.amount }), {}),
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <PageHeader
        title="Expenses"
        action={
          <Button onClick={() => setExpenseFormOpen(true)}>
            <Plus /> Add expense
          </Button>
        }
      />
      <MonthNav value={month} onChange={setMonth} max={monthKey(today)} />

      {list.length === 0 ? (
        <EmptyState
          title="No expenses this month"
          action={
            <Button onClick={() => setExpenseFormOpen(true)}>
              <Plus /> Add expense
            </Button>
          }
        >
          Add bills, cleaning, repairs and anything else you spend on the villa.
        </EmptyState>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card className="divide-y divide-line overflow-hidden lg:order-1">
            {list.map((e) => {
              const Icon = ICONS[e.category];
              return (
                <div key={e.id} className="px-5 py-4">
                  <div className="flex items-center gap-4">
                    <span className="hidden size-11 shrink-0 place-items-center rounded-full bg-well sm:grid">
                      <Icon className="size-5 text-brass-deep" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-lg leading-tight font-medium">{e.name}</div>
                      <div className="text-muted">
                        {e.category}, {fmtDay(e.date)}
                      </div>
                    </div>
                    <div className="tnum text-lg font-semibold whitespace-nowrap">{money(e.amount)}</div>
                    <button type="button" onClick={() => setRemoving(removing === e.id ? null : e.id)} className="-mr-2 grid size-11 place-items-center rounded-full text-muted hover:bg-well hover:text-clay" aria-label={`Delete ${e.name}`}>
                      <Trash2 className="size-5" />
                    </button>
                  </div>
                  {e.note || e.receiptName ? (
                    <div className="mt-2 sm:pl-[3.75rem] text-[0.9375rem] text-muted">
                      {e.note}
                      {e.receiptName ? (
                        <span className="mt-1 flex items-center gap-1.5">
                          <Paperclip className="size-4" /> {e.receiptName}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {removing === e.id ? (
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <span className="mr-auto sm:pl-[3.75rem] text-[0.9375rem]">Delete this expense?</span>
                      <Button variant="secondary" size="sm" onClick={() => setRemoving(null)}>
                        Keep
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          deleteExpense(e.id);
                          setRemoving(null);
                          notify("Expense deleted");
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </Card>

          <Card className="p-5 lg:order-2">
            <div className="text-muted">Spent this month</div>
            <div className="tnum mt-1 text-[2rem] leading-tight font-semibold">{money(total)}</div>
            <ul className="mt-4 space-y-3 border-t border-line pt-4">
              {byCategory.map(([category, amount]) => (
                <li key={category}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span>{category}</span>
                    <span className="tnum font-medium">{money(amount)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-well">
                    <div className="h-full rounded-full bg-brass" style={{ width: `${Math.max((amount / total) * 100, 3)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
