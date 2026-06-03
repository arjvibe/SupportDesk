import * as React from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {}

export function PageContainer({ className, children, ...props }: PageContainerProps) {
  return (
    <div
      className={cn("w-full max-w-7xl mx-auto px-6 md:px-12 py-8 md:py-10 animate-in fade-in duration-300", className)}
      {...props}
    >
      {children}
    </div>
  );
}
