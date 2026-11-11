"use client";

import { useState } from "react";
import { ReceiptPicker, type Receipt } from "@/components/receipt-picker";
import { Button } from "@/components/ui/button";
import { Chip, Field, Input, MoneyInput, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { useStore } from "@/lib/store";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/types";

export function ExpenseSheet() {
  const { expenseFormOpen, setExpenseFormOpen } = useStore();
  return (
    <Sheet open={expenseFormOpen} onOpenChange={setExpenseFormOpen} title="Add expense">
      {expenseFormOpen ? <ExpenseForm /> : null}
    </Sheet>
  );
}

function ExpenseForm() {
  const { today, addExpense, setExpenseFormOpen, notify } = useStore();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [uploading, setUploading] = useState(false);

  const valid = amount > 0 && category !== null && date && !uploading;

  return (
    <div className="space-y-6">
      <Field label="Amount">
        {(id) => <MoneyInput id={id} value={amount} onChange={setAmount} autoFocus />}
      </Field>

      <div>
        <div className="mb-2 font-medium">Category</div>
        <div className="flex flex-wrap gap-2">
          {EXPENSE_CATEGORIES.map((c) => (
            <Chip key={c} selected={category === c} onClick={() => setCategory(c)}>
              {c}
            </Chip>
          ))}
        </div>
      </div>

      <Field label="What was it for" optional>
        {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder={category ? `${category} bill` : "e.g. Electricity bill"} />}
      </Field>

      <Field label="Date">
        {(id) => <Input id={id} type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />}
      </Field>

      <Field label="Note" optional>
        {(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} className="min-h-20" />}
      </Field>

      <ReceiptPicker value={receipt} onChange={setReceipt} onBusy={setUploading} label="Attach a receipt photo or PDF" />

      <Button
        size="lg"
        block
        disabled={!valid}
        onClick={() => {
          if (!category) return;
          addExpense({ name: name.trim() || `${category}`, category, amount, date, note: note.trim() || undefined, receiptName: receipt?.name, receiptKey: receipt?.key });
          notify("Expense added");
          setExpenseFormOpen(false);
        }}
      >
        Save expense
      </Button>
    </div>
  );
}
