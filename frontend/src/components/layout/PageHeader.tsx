import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions, className, ...props }: PageHeaderProps) {
  return (
    <div
      className={cn("flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8", className)}
      {...props}
    >
      <div className="space-y-1.5">
        <h1 className="font-serif text-3xl md:text-4xl leading-tight text-ink tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs md:text-sm text-muted-foreground max-w-[65ch] leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
    </div>
  );
}
