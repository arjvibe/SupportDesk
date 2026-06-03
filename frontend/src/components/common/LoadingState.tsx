import { Loader2 } from "lucide-react";

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "Loading content..." }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center my-6">
      <Loader2 className="size-6 animate-spin text-muted-foreground/75 mb-3" />
      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {message}
      </span>
    </div>
  );
}
