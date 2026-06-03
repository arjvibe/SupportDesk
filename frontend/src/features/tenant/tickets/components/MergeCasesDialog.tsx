import { useState, useEffect } from "react";
import { Merge, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface MergeCasesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitMerge: (childCode: string) => void;
  currentTicketCode: number;
  isPending: boolean;
  mergeError: string | null;
}

export function MergeCasesDialog({
  isOpen,
  onClose,
  onSubmitMerge,
  currentTicketCode,
  isPending,
  mergeError,
}: MergeCasesDialogProps) {
  const [mergeChildCode, setMergeChildCode] = useState("");

  // Reset input state when dialog visibility resets
  useEffect(() => {
    if (!isOpen) {
      setMergeChildCode("");
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mergeChildCode.trim()) return;
    onSubmitMerge(mergeChildCode);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Merge Duplicate Ticket</DialogTitle>
          <DialogDescription>
            Close a duplicate ticket and merge its entire messaging history into
            the current ticket: <strong>#{currentTicketCode}</strong>.
          </DialogDescription>
        </DialogHeader>

        {mergeError && (
          <div className="p-3 bg-danger/5 ring-1 ring-danger/15 rounded-lg text-xs text-danger flex items-start gap-2">
            <ShieldAlert className="size-4 shrink-0 mt-0.5" />
            <span>{mergeError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-left">
            <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
              Duplicate Ticket Code
            </span>
            <input
              type="number"
              required
              placeholder="e.g. 102"
              value={mergeChildCode}
              onChange={(e) => setMergeChildCode(e.target.value)}
              className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
            />
          </label>

          <button
            type="submit"
            disabled={isPending || !mergeChildCode}
            className="w-full bg-brand-primary text-brand-secondary py-2 rounded-lg text-xs font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 mt-4 flex items-center justify-center gap-1 cursor-pointer"
          >
            <Merge className="size-3.5" />
            {isPending ? "Merging..." : "Merge Duplicate Ticket"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
