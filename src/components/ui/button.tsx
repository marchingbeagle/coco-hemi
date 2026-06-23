import React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-[9px] whitespace-nowrap rounded-[var(--radius)] border border-transparent font-bold leading-none transition-[background-color,border-color,color,transform,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50",
  {
  variants: {
    variant: {
      default:
        "border-white/10 bg-[image:var(--primary-gradient)] text-primary-foreground shadow-[0_12px_28px_rgb(239_35_60_/_20%)] hover:-translate-y-px hover:bg-[image:linear-gradient(135deg,#ff6169_0%,#ff3347_46%,#d71920_100%)]",
      secondary: "border-border bg-secondary text-secondary-foreground hover:bg-white/10",
      ghost: "border-border bg-white/5 text-secondary-foreground hover:border-white/20 hover:bg-white/10",
      outline: "border-border bg-transparent text-foreground hover:bg-white/5",
    },
    size: {
      default: "min-h-[42px] px-3.5 py-2",
      sm: "min-h-8 px-2.5 py-1.5 text-xs",
      lg: "min-h-11 px-5 py-2.5",
      icon: "h-9 w-9 p-0",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { buttonVariants };
