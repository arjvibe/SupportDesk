import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { getApiBase } from "../utils/api";
import { Plus, ArrowLeft, ArrowRight, X, ShieldAlert, Trash2, UserPlus, Search } from "lucide-react";

type TeamLead = {
  id: string;
  firstName: string;
  lastName: string;
  initials: string;
};

type SupportTeam = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  lead: TeamLead | null;
  agentCount: number;
};

type TeamAgent = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "admin" | "agent";
  jobTitle: string | null;
  initials: string;
  isLead: boolean;
};

type StaffMember = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "admin" | "agent";
  jobTitle: string | null;
  initials: string;
  teamCount: number;
};

const API_BASE = getApiBase();

/**
 * Teams page component.
 * Exposes a dashboard of support teams inside the organization.
 * Permits Admins to create new teams, assign agents, promote agents to team lead,
 * and remove agents from teams. Enables Agents to view team directories.
 */
export default function Teams() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "admin";

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal control states
  const [isNewTeamModalOpen, setIsNewTeamModalOpen] = useState(false);
  const [isAddAgentModalOpen, setIsAddAgentModalOpen] = useState(false);

  // Form states for creating a new support team
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDescription, setNewTeamDescription] = useState("");
  const [newTeamError, setNewTeamError] = useState<string | null>(null);

  // Form states for adding an agent to the team
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [assignAsLead, setAssignAsLead] = useState(false);
  const [addAgentError, setAddAgentError] = useState<string | null>(null);

  // =========================================================================
  // 1. Data Fetching Queries
  // =========================================================================

  // Fetch support teams list
  const { data: teamsList = [], isLoading: loadingTeams } = useQuery<SupportTeam[]>({
    queryKey: ["teams"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/teams`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch support teams");
      return res.json();
    },
  });

  // Fetch all staff members in the Org (to compute counters & populate assignments)
  const { data: staffList = [] } = useQuery<StaffMember[]>({
    queryKey: ["available_agents"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/teams/agents/available`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch agents mapped to the currently selected support team
  const { data: teamAgents = [], isLoading: loadingTeamAgents } = useQuery<TeamAgent[]>({
    queryKey: ["teams", selectedTeamId, "agents"],
    queryFn: async () => {
      if (!selectedTeamId) return [];
      const res = await fetch(`${API_BASE}/teams/${selectedTeamId}/agents`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch team members");
      return res.json();
    },
    enabled: !!selectedTeamId,
  });

  // =========================================================================
  // 2. Mutation Hooks
  // =========================================================================

  /**
   * Mutation hook to register a new support team in the database.
   * Invalidates the 'teams' query key on success to refresh the grid layout.
   */
  const createTeamMutation = useMutation({
    mutationFn: async (payload: { name: string; description: string }) => {
      const res = await fetch(`${API_BASE}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create support team");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      setNewTeamName("");
      setNewTeamDescription("");
      setNewTeamError(null);
      setIsNewTeamModalOpen(false);
    },
    onError: (err: any) => {
      setNewTeamError(err.message);
    },
  });

  /**
   * Mutation hook to add an agent mapping to the selected support team.
   * Invalidates both the team members list and available agents directory (to refresh stats).
   */
  const addAgentMutation = useMutation({
    mutationFn: async (payload: { agentId: string; isLead: boolean }) => {
      const res = await fetch(`${API_BASE}/teams/${selectedTeamId}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign agent");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams", selectedTeamId, "agents"] });
      queryClient.invalidateQueries({ queryKey: ["teams"] }); // update counters in team card
      queryClient.invalidateQueries({ queryKey: ["available_agents"] }); // update assigned stats
      setSelectedAgentId("");
      setAssignAsLead(false);
      setAddAgentError(null);
      setIsAddAgentModalOpen(false);
    },
    onError: (err: any) => {
      setAddAgentError(err.message);
    },
  });

  /**
   * Mutation hook to remove an agent from the support team.
   */
  const removeAgentMutation = useMutation({
    mutationFn: async (agentId: string) => {
      const res = await fetch(`${API_BASE}/teams/${selectedTeamId}/agents/${agentId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove agent");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams", selectedTeamId, "agents"] });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["available_agents"] });
    },
  });

  /**
   * Mutation hook to toggle an agent's leadership status for this support team.
   */
  const toggleLeadMutation = useMutation({
    mutationFn: async ({ agentId, isLead }: { agentId: string; isLead: boolean }) => {
      const res = await fetch(`${API_BASE}/teams/${selectedTeamId}/agents/${agentId}/lead`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isLead }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update lead status");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams", selectedTeamId, "agents"] });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });

  // =========================================================================
  // 3. Form Handlers
  // =========================================================================

  /**
   * Submits the create team form to the backend mutation.
   * 
   * @param e React form submission event
   */
  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    createTeamMutation.mutate({
      name: newTeamName,
      description: newTeamDescription,
    });
  };

  /**
   * Submits the assign agent form to the backend mutation.
   * 
   * @param e React form submission event
   */
  const handleAddAgent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentId) {
      setAddAgentError("Please select an agent");
      return;
    }
    addAgentMutation.mutate({
      agentId: selectedAgentId,
      isLead: assignAsLead,
    });
  };

  // =========================================================================
  // 4. Client Search & Filtering Logic
  // =========================================================================

  const filteredTeams = teamsList.filter((team) =>
    team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (team.description && team.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Stats Counters Calculations
  const totalTeams = teamsList.length;
  const totalStaff = staffList.length;
  const assignedStaff = staffList.filter((st) => st.teamCount > 0).length;

  const selectedTeam = teamsList.find((t) => t.id === selectedTeamId);

  // Filter out agents already assigned to the selected team for the dropdown selection
  const eligibleAgents = staffList.filter(
    (st) => !teamAgents.some((ta) => ta.id === st.id)
  );

  // =========================================================================
  // Render View (List View vs Drilldown View)
  // =========================================================================

  if (selectedTeamId && selectedTeam) {
    return (
      <div className="w-full px-6 md:px-12 py-12 font-sans text-ink">
        {/* Detail Header */}
        <div className="mb-8 flex items-center justify-between">
          <button
            onClick={() => setSelectedTeamId(null)}
            className="flex items-center gap-2 text-xs font-semibold font-mono uppercase tracking-wider text-muted-foreground hover:text-ink transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to teams
          </button>
          
          {isAdmin && (
            <button
              onClick={() => setIsAddAgentModalOpen(true)}
              className="bg-brand-primary text-brand-secondary py-2 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all shadow-sm"
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
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/5">
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
                  <tr className="border-b border-black/5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
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
                            className={`text-xs font-mono uppercase tracking-widest px-2.5 py-1 rounded border transition-all ${
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
                            className="p-1.5 rounded-md hover:bg-danger/10 hover:text-danger text-muted-foreground transition-all"
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
        {isAddAgentModalOpen && isAdmin && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-canvas border border-black/10 rounded-2xl w-full max-w-md p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
              <button
                onClick={() => setIsAddAgentModalOpen(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-ink transition-colors"
              >
                <X className="size-4" />
              </button>
              
              <h2 className="text-lg font-serif mb-2">Add Member to {selectedTeam.name}</h2>
              <p className="text-xs text-muted-foreground mb-6">
                Select an internal agent or admin to assign to this support team.
              </p>

              {addAgentError && (
                <div className="mb-4 p-3 bg-danger/5 ring-1 ring-danger/15 rounded-lg text-xs text-danger flex items-start gap-2">
                  <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                  <span>{addAgentError}</span>
                </div>
              )}

              <form onSubmit={handleAddAgent} className="space-y-4">
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

                <button
                  type="submit"
                  disabled={addAgentMutation.isPending}
                  className="w-full bg-brand-primary text-brand-secondary py-2.5 rounded-lg text-xs font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 mt-2"
                >
                  {addAgentMutation.isPending ? "Assigning agent…" : "Add Team Member"}
                </button>
              </form>
            </div>
          </div>
        )}
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
            className="bg-brand-primary text-brand-secondary py-3 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all shrink-0 shadow-sm"
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

      {/* Create Team Modal */}
      {isNewTeamModalOpen && isAdmin && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-canvas border border-black/10 rounded-2xl w-full max-w-md p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setIsNewTeamModalOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-ink transition-colors"
            >
              <X className="size-4" />
            </button>
            
            <h2 className="text-lg font-serif mb-2">New Support Team</h2>
            <p className="text-xs text-muted-foreground mb-6">
              Establish a specialty group for managing incoming tickets.
            </p>

            {newTeamError && (
              <div className="mb-4 p-3 bg-danger/5 ring-1 ring-danger/15 rounded-lg text-xs text-danger flex items-start gap-2">
                <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                <span>{newTeamError}</span>
              </div>
            )}

            <form onSubmit={handleCreateTeam} className="space-y-4">
              <label className="block text-left">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                  Team Name
                </span>
                <input
                  type="text"
                  required
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="E.g. Technical Helpdesk"
                  className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
                />
              </label>

              <label className="block text-left">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                  Description
                </span>
                <textarea
                  value={newTeamDescription}
                  onChange={(e) => setNewTeamDescription(e.target.value)}
                  placeholder="E.g. Triages technical bugs, backend errors, and infrastructure cases."
                  rows={3}
                  className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all resize-none"
                />
              </label>

              <button
                type="submit"
                disabled={createTeamMutation.isPending}
                className="w-full bg-brand-primary text-brand-secondary py-2.5 rounded-lg text-xs font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 mt-2"
              >
                {createTeamMutation.isPending ? "Creating team…" : "Create Team"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
