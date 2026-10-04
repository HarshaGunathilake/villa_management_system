import { forwardRef, useId } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const inputBase =
  "w-full min-h-12 rounded-xl border border-line-strong bg-card px-4 text-base text-ink placeholder:text-muted/70 " +
  "focus:border-brass-deep focus:outline-none focus:ring-2 focus:ring-brass/25";

export function Field({
  label,
  hint,
  optional,
  children,
  className,
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  children: (id: string) => React.ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 flex items-baseline gap-2 font-medium">
        {label}
        {optional ? <span className="text-sm font-normal text-muted">optional</span> : null}
      </label>
      {children(id)}
      {hint ? <p className="mt-1.5 text-sm text-muted">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(inputBase, className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(inputBase, "min-h-24 py-3 leading-snug", className)} {...props} />;
  },
);

/** Amount in rupees with the currency shown inside the field. */
export function MoneyInput({
  id,
  value,
  onChange,
  className,
  ...rest
}: {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted">LKR</span>
      <input
        id={id}
        inputMode="numeric"
        className={cn(inputBase, "tnum pl-14 text-lg font-medium")}
        value={value === 0 ? "" : value.toLocaleString("en-US")}
        placeholder="0"
        onChange={(e) => onChange(Number(e.target.value.replace(/[^\d]/g, "")) || 0)}
        {...rest}
      />
    </div>
  );
}

export function Stepper({
  label,
  hint,
  value,
  onChange,
  min = 0,
  max = 99,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  const btn =
    "grid size-12 place-items-center rounded-full border border-line-strong bg-card text-ink hover:bg-well disabled:opacity-35";
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <div className="font-medium">{label}</div>
        {hint ? <div className="text-sm text-muted">{hint}</div> : null}
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className={btn} disabled={value <= min} onClick={() => onChange(value - 1)} aria-label={`Fewer ${label.toLowerCase()}`}>
          <Minus className="size-5" />
        </button>
        <span className="tnum w-8 text-center text-xl font-semibold" aria-live="polite">
          {value}
        </span>
        <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(value + 1)} aria-label={`More ${label.toLowerCase()}`}>
          <Plus className="size-5" />
        </button>
      </div>
    </div>
  );
}

/** One-tap choice, used instead of dropdowns. */
export function Chip({
  selected,
  children,
  className,
  ...props
}: { selected?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "min-h-11 rounded-full border px-4 text-[0.9375rem] font-medium transition-colors",
        selected ? "border-ink bg-ink text-white" : "border-line-strong bg-card text-ink hover:bg-well",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-8 w-14 shrink-0 rounded-full transition-colors",
        checked ? "bg-sage" : "bg-line-strong",
      )}
    >
      <span
        className={cn(
          "absolute top-1 left-1 size-6 rounded-full bg-white shadow-sm transition-transform",
          checked && "translate-x-6",
        )}
      />
    </button>
  );
}
