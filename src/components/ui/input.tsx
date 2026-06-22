import React from "react";
import { cn } from "../../lib/utils";

export function Input({ className, type = "text", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type={type} className={cn("shadcn-input", className)} {...props} />;
}
