import React from "react";
import { cn } from "../../lib/utils";

export function Card({ className, ...props }) {
  return <div className={cn("shadcn-card", className)} {...props} />;
}

export function CardHeader({ className, ...props }) {
  return <div className={cn("shadcn-card-header", className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
  return <div className={cn("shadcn-card-title", className)} {...props} />;
}

export function CardContent({ className, ...props }) {
  return <div className={cn("shadcn-card-content", className)} {...props} />;
}
