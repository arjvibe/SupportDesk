import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Something went wrong",
  message = "An error occurred while loading this section.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 md:p-12 text-center rounded-2xl border border-danger/10 bg-danger/5 shadow-sm max-w-md mx-auto my-6">
      <div className="size-10 rounded-full bg-danger/10 flex items-center justify-center text-danger mb-4">
        <AlertCircle className="size-5" />
      </div>
      <h3 className="font-serif text-lg text-ink font-semibold mb-2">{title}</h3>
      <p className="text-xs text-muted-foreground mb-6 max-w-[32ch] leading-relaxed">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm" className="gap-1.5">
          <RotateCcw className="size-3" />
          Retry Request
        </Button>
      )}
    </div>
  );
}
