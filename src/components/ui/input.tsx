import React from "react";
import { cn } from "../../lib/utils";

export function Input({ className, type = "text", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        "min-h-[42px] w-full rounded-[var(--radius)] border border-input bg-[#09090b] px-3 text-foreground outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground focus:border-accent focus:shadow-[0_0_0_3px_var(--ring)] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
