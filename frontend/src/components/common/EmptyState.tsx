import { FolderOpen } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: any;
}

export function EmptyState({
  title = "No data found",
  description = "There are no records matching your criteria.",
  icon: Icon = FolderOpen,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-black/10 bg-surface/10 max-w-md mx-auto my-6 animate-in fade-in duration-300">
      <div className="size-10 rounded-full bg-black/5 flex items-center justify-center text-muted-foreground mb-4">
        <Icon className="size-5" />
      </div>
      <h3 className="font-serif text-base text-ink font-semibold mb-1.5">{title}</h3>
      <p className="text-xs text-muted-foreground max-w-[34ch] leading-relaxed">{description}</p>
    </div>
  );
}
