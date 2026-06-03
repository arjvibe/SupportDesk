import { useState } from "react";
import { Plus, ArrowLeft, ArrowRight, X, ShieldAlert, Trash2, UserPlus, Search } from "lucide-react";
import { useAuth } from "@/features/tenant/auth";
import {
  useTeamsList,
  useAvailableAgents,
  useTeamMembers,
  useCreateTeam,
  useAssignTeamAgent,
  useRemoveTeamAgent,
  useToggleAgentLead,
  TeamForm,
  AssignAgentDialog,
} from "@/features/tenant/teams";

export default function Teams() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal control states
  const [isNewTeamModalOpen, setIsNewTeamModalOpen] = useState(false);
  const [isAddAgentModalOpen, setIsAddAgentModalOpen] = useState(false);
  const [addAgentError, setAddAgentError] = useState<string | null>(null);
  const [createTeamError, setCreateTeamError] = useState<string | null>(null);

  // Queries
  const { data: teamsList = [], isLoading: loadingTeams } = useTeamsList();
  const { data: staffList = [] } = useAvailableAgents();
  const { data: teamAgents = [], isLoading: loadingTeamAgents } = useTeamMembers(selectedTeamId);

  // Mutations
  const createTeamMutation = useCreateTeam();
  const assignAgentMutation = useAssignTeamAgent(selectedTeamId);
  const removeAgentMutation = useRemoveTeamAgent(selectedTeamId);
  const toggleLeadMutation = useToggleAgentLead(selectedTeamId);

  // Handlers
  const handleCreateTeamSubmit = (data: { name: string; description: string }) => {
    setCreateTeamError(null);
    createTeamMutation.mutate(data, {
      onSuccess: () => {
        setIsNewTeamModalOpen(false);
      },
      onError: (err: any) => {
        setCreateTeamError(err.message || "Failed to create team");
      },
    });
  };

  const handleAssignAgentSubmit = (payload: { agentId: string; isLead: boolean }) => {
    setAddAgentError(null);
    assignAgentMutation.mutate(payload, {
      onSuccess: () => {
        setIsAddAgentModalOpen(false);
      },
      onError: (err: any) => {
        setAddAgentError(err.message || "Failed to assign agent");
      },
    });
  };

  // Search & Filtering
  const filteredTeams = teamsList.filter((team) =>
    team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (team.description && team.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Stats Counters
  const totalTeams = teamsList.length;
  const totalStaff = staffList.length;
  const assignedStaff = staffList.filter((st) => st.teamCount > 0).length;

  const selectedTeam = teamsList.find((t) => t.id === selectedTeamId);

  // Filter out agents already assigned to the selected team for the dropdown selection
  const eligibleAgents = staffList.filter(
    (st) => !teamAgents.some((ta) => ta.id === st.id)
  );

  if (selectedTeamId && selectedTeam) {
    return (
      <div className="w-full px-6 md:px-12 py-12 font-sans text-ink">
        {/* Detail Header */}
        <div className="mb-8 flex items-center justify-between">
          <button
            onClick={() => setSelectedTeamId(null)}
            className="flex items-center gap-2 text-xs font-semibold font-mono uppercase tracking-wider text-muted-foreground hover:text-ink transition-colors cursor-pointer text-left"
          >
            <ArrowLeft className="size-4" />
            Back to teams
          </button>
          
          {isAdmin && (
            <button
              onClick={() => setIsAddAgentModalOpen(true)}
              className="bg-brand-primary text-brand-secondary py-2 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all shadow-sm cursor-pointer"
            >
              <UserPlus className="size-4" />
              Add Agent
            </button>
          )}
        </div>

        {/* Team Details Hero Card */}
        <div className="mb-10 p-6 border border-black/10 rounded-2xl bg-surface/5 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-[70ch]">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Support team profile
            </span>
            <h1 className="font-serif text-4xl mt-2">{selectedTeam.name}</h1>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              {selectedTeam.description || "No description provided for this group."}
            </p>
          </div>

          <div className="flex flex-wrap gap-8 text-left">
            <div>
              <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block">
                Total Members
              </span>
              <span className="text-4xl font-serif mt-1 block">
                {teamAgents.length}
              </span>
            </div>
            <div>
              <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block">
                Designated Lead
              </span>
              <div className="flex items-center gap-2 mt-2">
                {selectedTeam.lead ? (
                  <>
                    <div className="size-6 rounded-full bg-black/10 grid place-items-center font-mono text-[9px] font-semibold">
                      {selectedTeam.lead.initials}
                    </div>
                    <span className="text-xs font-semibold">
                      {selectedTeam.lead.firstName} {selectedTeam.lead.lastName}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground italic">None assigned</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mapped Members Directory Table */}
        <div className="border border-black/10 rounded-2xl bg-canvas p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-muted-foreground">
                Team Members Directory
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Staff members currently triaging and resolving cases assigned to this support unit.
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/5 select-none">
              {teamAgents.length} assigned
            </span>
          </div>

          {loadingTeamAgents ? (
            <div className="text-xs text-muted-foreground py-6 text-center">Loading team members…</div>
          ) : teamAgents.length === 0 ? (
            <div className="text-xs text-muted-foreground py-12 text-center border border-dashed border-black/10 rounded-xl bg-surface/30">
              No staff members assigned to this team yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-black/5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground select-none">
                    <th className="py-3 font-semibold">Agent</th>
                    <th className="py-3 font-semibold">Email</th>
                    <th className="py-3 font-semibold">Job Title</th>
                    <th className="py-3 font-semibold">Role</th>
                    <th className="py-3 font-semibold text-center">Team Lead</th>
                    {isAdmin && <th className="py-3 font-semibold text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {teamAgents.map((agent) => (
                    <tr key={agent.id} className="hover:bg-black/[0.01]">
                      <td className="py-4 flex items-center gap-3">
                        <div className="size-8 rounded-full bg-surface border border-black/5 grid place-items-center font-mono text-[9px] font-semibold text-muted-foreground relative">
                          {agent.initials}
                          {agent.isLead && (
                            <span className="absolute -top-1 -right-1 bg-brand-primary text-brand-secondary rounded-full size-4 grid place-items-center scale-90 border border-canvas shadow-sm" title="Team Lead">
                              ★
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="font-semibold text-ink block">
                            {agent.firstName} {agent.lastName}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 text-muted-foreground font-mono">{agent.email}</td>
                      <td className="py-4">
                        {agent.jobTitle ? (
                          <span className="px-1.5 py-0.5 rounded bg-black/[0.03] text-[10px]">
                            {agent.jobTitle}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/45 italic">—</span>
                        )}
                      </td>
                      <td className="py-4">
                        <span className="text-[9px] font-mono uppercase tracking-wider bg-black/5 text-muted-foreground px-1.5 py-0.5 rounded">
                          {agent.role}
                        </span>
                      </td>
                      <td className="py-4 text-center">
                        {isAdmin ? (
                          <button
                            onClick={() => toggleLeadMutation.mutate({ agentId: agent.id, isLead: !agent.isLead })}
                            className={`text-xs font-mono uppercase tracking-widest px-2.5 py-1 rounded border transition-all cursor-pointer ${
                              agent.isLead
                                ? "bg-brand-primary text-brand-secondary border-brand-primary hover:opacity-90"
                                : "bg-transparent text-muted-foreground border-black/10 hover:border-black/20 hover:text-ink"
                            }`}
                            disabled={toggleLeadMutation.isPending}
                          >
                            {agent.isLead ? "Lead" : "Make Lead"}
                          </button>
                        ) : (
                          <span className="font-mono text-xs text-muted-foreground">
                            {agent.isLead ? "Yes" : "No"}
                          </span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="py-4 text-right">
                          <button
                            onClick={() => {
                              if (confirm(`Remove ${agent.firstName} from this team?`)) {
                                removeAgentMutation.mutate(agent.id);
                              }
                            }}
                            className="p-1.5 rounded-md hover:bg-danger/10 hover:text-danger text-muted-foreground transition-all cursor-pointer"
                            title="Remove agent from team"
                            disabled={removeAgentMutation.isPending}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add Agent Modal */}
        <AssignAgentDialog
          isOpen={isAddAgentModalOpen}
          onClose={() => setIsAddAgentModalOpen(false)}
          eligibleAgents={eligibleAgents}
          onSubmit={handleAssignAgentSubmit}
          isLoading={assignAgentMutation.isPending}
          error={addAgentError}
          teamName={selectedTeam.name}
        />
      </div>
    );
  }

  return (
    <div className="w-full px-6 md:px-12 py-12 font-sans text-ink">
      {/* Title Header */}
      <div className="mb-10 flex items-start justify-between">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Workspace Configuration
          </span>
          <h1 className="font-serif text-5xl leading-tight mt-1 text-balance">
            Support Teams
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-[65ch] leading-relaxed">
            Create specialty support departments (e.g., billing, technical helpdesk) and distribute internal agents to handle cases.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setIsNewTeamModalOpen(true)}
            className="bg-brand-primary text-brand-secondary py-3 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all shrink-0 shadow-sm cursor-pointer"
          >
            <Plus className="size-4" />
            + New team
          </button>
        )}
      </div>

      {/* Analytics Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 border border-black/10 rounded-2xl overflow-hidden bg-surface/5 mb-10 shadow-sm">
        <div className="p-6 text-left border-b md:border-b-0 md:border-r border-black/10">
          <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-2">
            Support Teams
          </span>
          <span className="text-4xl font-serif font-medium">{totalTeams}</span>
        </div>
        
        <div className="p-6 text-left border-b md:border-b-0 md:border-r border-black/10">
          <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-2">
            Staff Members
          </span>
          <span className="text-4xl font-serif font-medium">{totalStaff}</span>
        </div>

        <div className="p-6 text-left">
          <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-2">
            Assigned Agents
          </span>
          <span className="text-4xl font-serif font-medium">{assignedStaff}</span>
        </div>
      </div>

      {/* Filter and Search Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex-1 max-w-sm w-full relative">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground/60" />
          <input
            type="text"
            placeholder="Search teams by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface ring-1 ring-black/10 rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
          />
        </div>
      </div>

      {/* Primary Teams Card Grid */}
      {loadingTeams ? (
        <div className="text-xs text-muted-foreground py-10 text-center">Loading teams directory…</div>
      ) : filteredTeams.length === 0 ? (
        <div className="text-xs text-muted-foreground py-12 text-center border border-dashed border-black/10 rounded-xl bg-surface/30">
          No support groups match your query.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTeams.map((team) => (
            <div
              key={team.id}
              onClick={() => setSelectedTeamId(team.id)}
              className="border border-black/10 rounded-2xl bg-canvas p-6 shadow-sm hover:border-black/25 cursor-pointer transition-all duration-150 flex flex-col justify-between group"
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-serif text-lg font-medium text-ink group-hover:underline">
                    {team.name}
                  </h3>
                  <span className="text-[10px] font-mono bg-black/5 text-muted-foreground px-2 py-0.5 rounded-full font-medium">
                    {team.agentCount} members
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-6">
                  {team.description || "No description provided."}
                </p>
              </div>

              <div className="pt-4 border-t border-black/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">Lead:</span>
                  {team.lead ? (
                    <div className="flex items-center gap-1.5">
                      <div className="size-5 rounded-full bg-black/10 grid place-items-center font-mono text-[8px] font-semibold">
                        {team.lead.initials}
                      </div>
                      <span className="text-xs font-medium text-ink">
                        {team.lead.firstName} {team.lead.lastName.charAt(0)}.
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">None</span>
                  )}
                </div>

                <span className="text-muted-foreground group-hover:text-ink transition-colors">
                  <ArrowRight className="size-4" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Team Dialog */}
      {isNewTeamModalOpen && isAdmin && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-canvas border border-black/10 rounded-2xl w-full max-w-md p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setIsNewTeamModalOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-ink transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
            
            <h2 className="text-lg font-serif mb-2">New Support Team</h2>
            <p className="text-xs text-muted-foreground mb-6">
              Establish a specialty group for managing incoming tickets.
            </p>

            {createTeamError && (
              <div className="mb-4 p-3 bg-danger/5 ring-1 ring-danger/15 rounded-lg text-xs text-danger flex items-start gap-2">
                <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                <span>{createTeamError}</span>
              </div>
            )}

            <TeamForm
              onSubmit={handleCreateTeamSubmit}
              isLoading={createTeamMutation.isPending}
              onCancel={() => setIsNewTeamModalOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
