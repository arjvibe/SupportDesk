import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import {
  useTicketsList,
  useTicketDetails,
  usePostTicketMessage,
  useUpdateTicketProperties,
  useMergeTickets,
  useTeamsAssignList,
  useStaffAssignList,
  useTicketUrlState,
  TicketFilters,
  TicketCard,
  TicketHeader,
  TicketTimeline,
  TicketReplyEditor,
  TicketPropertiesSidebar,
  MergeCasesDialog,
} from "@/features/tenant/tickets";

export default function Inbox() {
  const { user } = useAuth();
  const [selectedTicketId, setSelectedTicketId] = useTicketUrlState();

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [queueTab, setQueueTab] = useState<"all" | "mine" | "unassigned" | "priority">("all");

  // Merge modal state
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);

  // =========================================================================
  // 1. Data Fetching
  // =========================================================================
  const { data: ticketsQueue = [], isLoading: loadingQueue } = useTicketsList(search);
  const { data: ticketDetails, isLoading: loadingDetails } = useTicketDetails(selectedTicketId);

  const { data: teamsList = [] } = useTeamsAssignList();
  const { data: staffList = [] } = useStaffAssignList();

  // =========================================================================
  // 2. Filter Queue Logic
  // =========================================================================
  const filteredQueue = ticketsQueue.filter((t) => {
    if (queueTab === "mine") {
      return t.assigneeId === user?.id;
    }
    if (queueTab === "unassigned") {
      return !t.assigneeId;
    }
    if (queueTab === "priority") {
      return t.priority === "high" || t.priority === "urgent";
    }
    return true;
  });

  // =========================================================================
  // 3. Mutation Hooks
  // =========================================================================
  const postMsgMutation = usePostTicketMessage(selectedTicketId);
  const updatePropsMutation = useUpdateTicketProperties(selectedTicketId);
  const mergeTicketsMutation = useMergeTickets(selectedTicketId);

  // =========================================================================
  // 4. Handlers
  // =========================================================================
  const handleSendReply = (payload: { body: string; isInternal: boolean; attachments: any[] }) => {
    postMsgMutation.mutate(payload);
  };

  const handleUpdateProperty = (field: string, value: any) => {
    updatePropsMutation.mutate({ [field]: value });
  };

  const handleMergeSubmit = (mergeChildCode: string) => {
    const childNum = parseInt(mergeChildCode, 10);
    const childTicket = ticketsQueue.find((t) => t.code === childNum);

    if (!childTicket) {
      setMergeError(`Duplicate ticket #${mergeChildCode} not found in active list`);
      return;
    }

    mergeTicketsMutation.mutate(
      {
        parentTicketId: selectedTicketId!,
        childTicketId: childTicket.id,
      },
      {
        onSuccess: () => {
          setMergeError(null);
          setIsMergeModalOpen(false);
        },
        onError: (err: any) => {
          setMergeError(err.message || "Failed to merge tickets");
        },
      }
    );
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] divide-x divide-black/10 text-ink bg-canvas overflow-hidden w-full">
      {/* PANEL 1: TICKET QUEUE COLUMN */}
      <div className="w-[380px] flex flex-col shrink-0 bg-canvas">
        <TicketFilters
          search={search}
          onSearchChange={setSearch}
          activeTab={queueTab}
          onTabChange={setQueueTab}
        />

        {/* Scrollable Queue List */}
        <div className="flex-1 overflow-y-auto divide-y divide-black/5">
          {loadingQueue ? (
            <div className="text-center text-xs text-muted-foreground py-10 font-mono">
              Loading queue…
            </div>
          ) : filteredQueue.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-12 px-6">
              No tickets found in this tab.
            </div>
          ) : (
            filteredQueue.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                isSelected={selectedTicketId === ticket.id}
                onClick={() => setSelectedTicketId(ticket.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* PANEL 2: CONVERSATION TIMELINE COLUMN */}
      <div className="flex-1 flex flex-col bg-canvas min-w-0">
        {!selectedTicketId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-12">
            <HelpCircle className="size-10 stroke-[1.2] mb-3 text-muted-foreground/50" />
            <h3 className="font-serif text-lg text-ink">No Ticket Selected</h3>
            <p className="text-xs max-w-[35ch] text-center mt-1 leading-relaxed">
              Select a technical ticket request from the left queue directory to review details, logs, and compose message responses.
            </p>
          </div>
        ) : loadingDetails || !ticketDetails ? (
          <div className="flex-1 flex flex-col items-center justify-center text-xs text-muted-foreground font-mono">
            Loading support thread details…
          </div>
        ) : (
          <>
            <TicketHeader ticketDetails={ticketDetails} />

            <TicketTimeline ticketDetails={ticketDetails} />

            {ticketDetails.status !== "closed" ? (
              <TicketReplyEditor
                onSubmit={handleSendReply}
                isPending={postMsgMutation.isPending}
              />
            ) : (
              <div className="p-3 border-t border-black/10 bg-canvas">
                <div className="p-3 border border-dashed border-black/10 rounded-xl bg-black/[0.01] text-center text-xs text-muted-foreground font-mono">
                  This ticket has been closed. Change status in the sidebar details panel to open and compose messages.
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* PANEL 3: TICKET METADATA SIDEBAR */}
      {selectedTicketId && ticketDetails && (
        <TicketPropertiesSidebar
          ticketDetails={ticketDetails}
          onUpdateProperty={handleUpdateProperty}
          teamsList={teamsList}
          staffList={staffList}
          onOpenMergeModal={() => setIsMergeModalOpen(true)}
        />
      )}

      {/* Merge overlay popup */}
      {selectedTicketId && ticketDetails && (
        <MergeCasesDialog
          isOpen={isMergeModalOpen}
          onClose={() => {
            setIsMergeModalOpen(false);
            setMergeError(null);
          }}
          onSubmitMerge={handleMergeSubmit}
          currentTicketCode={ticketDetails.code}
          isPending={mergeTicketsMutation.isPending}
          mergeError={mergeError}
        />
      )}
    </div>
  );
}
