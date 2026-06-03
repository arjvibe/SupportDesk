import { Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={cn("text-[10px] font-mono uppercase tracking-wider font-semibold text-muted-foreground", className)}>{title}</div>;
  }

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8 text-[10px] font-mono uppercase tracking-wider font-semibold text-muted-foreground hover:bg-black/5 hover:text-ink cursor-pointer"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        <span>{title}</span>
        {column.getIsSorted() === "desc" ? (
          <ArrowDown className="ml-1.5 size-3.5" />
        ) : column.getIsSorted() === "asc" ? (
          <ArrowUp className="ml-1.5 size-3.5" />
        ) : (
          <ArrowUpDown className="ml-1.5 size-3.5 opacity-55" />
        )}
      </Button>
    </div>
  );
}
