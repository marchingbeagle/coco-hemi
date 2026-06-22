import React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva("shadcn-button", {
  variants: {
    variant: {
      default: "shadcn-button-default",
      secondary: "shadcn-button-secondary",
      ghost: "shadcn-button-ghost",
      outline: "shadcn-button-outline",
    },
    size: {
      default: "shadcn-button-md",
      sm: "shadcn-button-sm",
      lg: "shadcn-button-lg",
      icon: "shadcn-button-icon",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { buttonVariants };
