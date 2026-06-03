import { useState, useEffect } from "react";
import { Star, Merge } from "lucide-react";
import type { TicketDetails, SupportTeam, StaffMember } from "../types";

interface TicketPropertiesSidebarProps {
  ticketDetails: TicketDetails;
  onUpdateProperty: (field: string, value: any) => void;
  teamsList: SupportTeam[];
  staffList: StaffMember[];
  onOpenMergeModal: () => void;
}

export function TicketPropertiesSidebar({
  ticketDetails,
  onUpdateProperty,
  teamsList,
  staffList,
  onOpenMergeModal,
}: TicketPropertiesSidebarProps) {
  const [editStatus, setEditStatus] = useState(ticketDetails.status);
  const [editPriority, setEditPriority] = useState(ticketDetails.priority);
  const [editTeamId, setEditTeamId] = useState(ticketDetails.teamId || "");
  const [editAssigneeId, setEditAssigneeId] = useState(
    ticketDetails.assigneeId || ""
  );
  const [editWorkstream, setEditWorkstream] = useState(
    ticketDetails.workstream || ""
  );

  // Sync state with details when details change (due to refresh or updates)
  useEffect(() => {
    setEditStatus(ticketDetails.status);
    setEditPriority(ticketDetails.priority);
    setEditTeamId(ticketDetails.teamId || "");
    setEditAssigneeId(ticketDetails.assigneeId || "");
    setEditWorkstream(ticketDetails.workstream || "");
  }, [ticketDetails]);

  return (
    <div className="w-[300px] shrink-0 bg-canvas flex flex-col overflow-y-auto p-6 space-y-6 text-left border-l border-black/10">
      <div>
        <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-4">
          Ticket Properties
        </h2>

        <div className="space-y-4">
          {/* Status Dropdown */}
          <label className="block">
            <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
              Ticket Status
            </span>
            <select
              value={editStatus}
              onChange={(e) => {
                setEditStatus(e.target.value as any);
                onUpdateProperty("status", e.target.value);
              }}
              className="w-full bg-canvas border border-black/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-black/20 cursor-pointer"
            >
              <option value="new">New</option>
              <option value="open">Open</option>
              <option value="pending">Pending</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </label>

          {/* Priority Dropdown */}
          <label className="block">
            <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
              Priority
            </span>
            <select
              value={editPriority}
              onChange={(e) => {
                setEditPriority(e.target.value as any);
                onUpdateProperty("priority", e.target.value);
              }}
              className="w-full bg-canvas border border-black/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-black/20 cursor-pointer"
            >
              <option value="low">Low Priority</option>
              <option value="normal">Normal Priority</option>
              <option value="high">High Priority</option>
              <option value="urgent">Urgent Priority</option>
            </select>
          </label>

          {/* Support Team assignment */}
          <label className="block">
            <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
              Assigned Team
            </span>
            <select
              value={editTeamId}
              onChange={(e) => {
                setEditTeamId(e.target.value);
                onUpdateProperty("teamId", e.target.value || null);
              }}
              className="w-full bg-canvas border border-black/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-black/20 cursor-pointer"
            >
              <option value="">Unassigned</option>
              {teamsList.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>

          {/* Staff Agent assignment */}
          <label className="block">
            <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
              Assignee Agent
            </span>
            <select
              value={editAssigneeId}
              onChange={(e) => {
                setEditAssigneeId(e.target.value);
                onUpdateProperty("assigneeId", e.target.value || null);
              }}
              className="w-full bg-canvas border border-black/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-black/20 cursor-pointer"
            >
              <option value="">Unassigned</option>
              {staffList.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.firstName} {agent.lastName}
                </option>
              ))}
            </select>
          </label>

          {/* Workstream/Category input */}
          <label className="block">
            <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
              Workstream / Category
            </span>
            <input
              type="text"
              value={editWorkstream}
              onChange={(e) => setEditWorkstream(e.target.value)}
              onBlur={() => onUpdateProperty("workstream", editWorkstream || null)}
              placeholder="e.g. billing, setup"
              className="w-full bg-canvas border border-black/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-black/20"
            />
          </label>
        </div>
      </div>

      <div className="pt-6 border-t border-black/10">
        <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-4">
          Agent Actions
        </h2>

        {/* Merge Duplicate Tickets */}
        <button
          onClick={onOpenMergeModal}
          className="w-full border border-black/15 bg-canvas hover:bg-surface text-ink text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-[0.98] cursor-pointer"
        >
          <Merge className="size-3.5" />
          Merge Duplicate Cases
        </button>
      </div>

      {/* Render CSAT Feedback detail (if has csat feedback) */}
      {ticketDetails.feedback && (
        <div className="pt-6 border-t border-black/10 text-left">
          <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-2">
            Client CSAT Score
          </span>
          <div className="bg-success/5 border border-success/15 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`size-3.5 ${
                    star <= ticketDetails.feedback!.rating
                      ? "text-warning fill-warning"
                      : "text-black/10"
                  }`}
                />
              ))}
            </div>
            <span className="text-[10px] font-semibold text-ink block">
              Customer comment:
            </span>
            <p className="text-[10px] text-muted-foreground italic leading-relaxed">
              "{ticketDetails.feedback.comment || "No comment left."}"
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
