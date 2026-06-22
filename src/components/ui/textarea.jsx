import React from "react";
import { cn } from "../../lib/utils";

export function Textarea({ className, ...props }) {
  return <textarea className={cn("shadcn-textarea", className)} {...props} />;
}
