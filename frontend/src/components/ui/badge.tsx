import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default: "border-transparent bg-black text-canvas",
        secondary: "border-transparent bg-black/5 text-ink",
        outline: "border-black/10 bg-transparent text-ink",
        destructive: "border-transparent bg-danger/10 text-danger border border-danger/25",
        success: "border-transparent bg-success/10 text-success border border-success/25",
        warning: "border-transparent bg-warning/10 text-warning border border-warning/25",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
