import { useState, useEffect } from "react";
import { ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AvailableAgent } from "../types";

interface AssignAgentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  eligibleAgents: AvailableAgent[];
  onSubmit: (payload: { agentId: string; isLead: boolean }) => void;
  isLoading: boolean;
  error: string | null;
  teamName: string;
}

export function AssignAgentDialog({
  isOpen,
  onClose,
  eligibleAgents,
  onSubmit,
  isLoading,
  error,
  teamName,
}: AssignAgentDialogProps) {
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [assignAsLead, setAssignAsLead] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedAgentId("");
      setAssignAsLead(false);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentId) return;
    onSubmit({ agentId: selectedAgentId, isLead: assignAsLead });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Member to {teamName}</DialogTitle>
          <DialogDescription>
            Select an internal agent or admin to assign to this support team.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-danger/5 ring-1 ring-danger/15 rounded-lg text-xs text-danger flex items-start gap-2">
            <ShieldAlert className="size-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-left">
            <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
              Select Agent
            </span>
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              required
              className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
            >
              <option value="">Choose Staff Member</option>
              {eligibleAgents.map((ag) => (
                <option key={ag.id} value={ag.id}>
                  {ag.firstName} {ag.lastName} ({ag.role})
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-2 py-2">
            <input
              type="checkbox"
              id="isLeadCheck"
              checked={assignAsLead}
              onChange={(e) => setAssignAsLead(e.target.checked)}
              className="size-4 accent-black rounded border-black/10 focus:ring-0"
            />
            <label htmlFor="isLeadCheck" className="text-xs font-medium cursor-pointer">
              Designate as Team Lead for this group
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-black/10">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !selectedAgentId}
            >
              {isLoading ? "Assigning..." : "Add Team Member"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
