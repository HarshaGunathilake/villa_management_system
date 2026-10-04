import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type Size = "md" | "lg" | "sm";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-black active:bg-black",
  accent: "bg-brass-soft text-brass-deep hover:bg-[#ecdfcc]",
  secondary: "bg-card text-ink border border-line-strong hover:bg-well",
  ghost: "text-ink hover:bg-well",
  danger: "bg-card text-clay border border-clay/30 hover:bg-clay-soft",
};

const sizes: Record<Size, string> = {
  sm: "min-h-10 px-3.5 text-[0.9375rem] rounded-[0.625rem]",
  md: "min-h-12 px-5 text-base rounded-xl",
  lg: "min-h-14 px-6 text-[1.0625rem] rounded-xl",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", block, className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap transition-colors select-none",
        "disabled:opacity-45 disabled:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0",
        variants[variant],
        sizes[size],
        block && "w-full",
        className,
      )}
      {...props}
    />
  );
});
