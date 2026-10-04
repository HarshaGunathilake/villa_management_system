"use client";

import { useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";
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
  const [receipt, setReceipt] = useState<string | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);

  const valid = amount > 0 && category !== null && date;

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

      <div>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setReceipt(e.target.files?.[0]?.name)} />
        {receipt ? (
          <div className="flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-3">
            <Paperclip className="size-5 text-muted" />
            <span className="min-w-0 flex-1 truncate">{receipt}</span>
            <button type="button" className="grid size-9 place-items-center rounded-full hover:bg-well" aria-label="Remove receipt" onClick={() => setReceipt(undefined)}>
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <Button variant="secondary" block onClick={() => fileRef.current?.click()}>
            <Paperclip /> Attach a receipt photo
          </Button>
        )}
      </div>

      <Button
        size="lg"
        block
        disabled={!valid}
        onClick={() => {
          if (!category) return;
          addExpense({ name: name.trim() || `${category}`, category, amount, date, note: note.trim() || undefined, receiptName: receipt });
          notify("Expense added");
          setExpenseFormOpen(false);
        }}
      >
        Save expense
      </Button>
    </div>
  );
}
