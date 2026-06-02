import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiBase } from "../utils/api";
import { Plus, X, ShieldAlert, ArrowUp, ArrowDown, Trash2, ArrowLeft } from "lucide-react";

type RoutingRule = {
  id: string;
  name: string;
  priorityOrder: number;
  criteriaField: "category" | "client" | "priority";
  criteriaValue: string;
  targetTeamId: string | null;
  targetAgentId: string | null;
  assignmentMode: "direct" | "round-robin";
  isActive: boolean;
};

type ClientAccount = {
  id: string;
  name: string;
};

type SupportTeam = {
  id: string;
  name: string;
};

type StaffMember = {
  id: string;
  firstName: string;
  lastName: string;
};

const API_BASE = getApiBase();

/**
 * Rules management component.
 * Allows Admins to establish sequential ticket-routing rules.
 * Matches incoming tickets on Workstream/Category, Client Account, or Priority,
 * and routes them using direct assignment or workload-balanced Round-Robin.
 */
export default function Rules() {
  const queryClient = useQueryClient();
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [isNewRuleModalOpen, setIsNewRuleModalOpen] = useState(false);

  // Form states for creating a rule
  const [name, setName] = useState("");
  const [criteriaField, setCriteriaField] = useState<"category" | "client" | "priority">("priority");
  const [criteriaValue, setCriteriaValue] = useState("");
  const [targetTeamId, setTargetTeamId] = useState("");
  const [targetAgentId, setTargetAgentId] = useState("");
  const [assignmentMode, setAssignmentMode] = useState<"direct" | "round-robin">("direct");
  const [createError, setCreateError] = useState<string | null>(null);

  // Form states for editing an existing rule
  const [editName, setEditName] = useState("");
  const [editCriteriaField, setEditCriteriaField] = useState<"category" | "client" | "priority">("priority");
  const [editCriteriaValue, setEditCriteriaValue] = useState("");
  const [editTargetTeamId, setEditTargetTeamId] = useState("");
  const [editTargetAgentId, setEditTargetAgentId] = useState("");
  const [editAssignmentMode, setEditAssignmentMode] = useState<"direct" | "round-robin">("direct");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);

  // =========================================================================
  // 1. Data Fetching Queries
  // =========================================================================

  // Fetch all assignment rules
  const { data: rulesList = [], isLoading: loadingRules } = useQuery<RoutingRule[]>({
    queryKey: ["routing_rules"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/rules`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch assignment rules");
      return res.json();
    },
  });

  // Fetch clients (to populate client condition dropdowns)
  const { data: clientsList = [] } = useQuery<ClientAccount[]>({
    queryKey: ["clients_list"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/clients`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch support teams (to populate targets dropdowns)
  const { data: teamsList = [] } = useQuery<SupportTeam[]>({
    queryKey: ["teams_list"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/teams`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch staff agents (to populate agent target dropdowns)
  const { data: staffList = [] } = useQuery<StaffMember[]>({
    queryKey: ["staff_list"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/teams/agents/available`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const selectedRule = rulesList.find((r) => r.id === selectedRuleId);

  // =========================================================================
  // 2. Mutation Hooks
  // =========================================================================

  /**
   * Mutation hook to create a new routing rule.
   */
  const createRuleMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`${API_BASE}/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create rule");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routing_rules"] });
      setName("");
      setCriteriaField("priority");
      setCriteriaValue("");
      setTargetTeamId("");
      setTargetAgentId("");
      setAssignmentMode("direct");
      setCreateError(null);
      setIsNewRuleModalOpen(false);
    },
    onError: (err: any) => {
      setCreateError(err.message);
    },
  });

  /**
   * Mutation hook to update details for a routing rule.
   */
  const updateRuleMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await fetch(`${API_BASE}/rules/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update rule");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routing_rules"] });
      setEditError(null);
      setSelectedRuleId(null);
    },
    onError: (err: any) => {
      setEditError(err.message);
    },
  });

  /**
   * Mutation hook to delete a routing rule.
   */
  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_BASE}/rules/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete rule");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routing_rules"] });
      setSelectedRuleId(null);
    },
  });

  /**
   * Mutation hook to reorder rules using an ordered list of IDs.
   */
  const reorderRulesMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const res = await fetch(`${API_BASE}/rules/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reorder rules");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routing_rules"] });
    },
  });

  // =========================================================================
  // 3. Handlers
  // =========================================================================

  /**
   * Triggers the Edit Form layout, populating it with selected rule fields.
   * 
   * @param rule The rule record to edit
   */
  const startEditing = (rule: RoutingRule) => {
    setEditName(rule.name);
    setEditCriteriaField(rule.criteriaField);
    setEditCriteriaValue(rule.criteriaValue);
    setEditTargetTeamId(rule.targetTeamId || "");
    setEditTargetAgentId(rule.targetAgentId || "");
    setEditAssignmentMode(rule.assignmentMode);
    setEditIsActive(rule.isActive);
    setEditError(null);
    setSelectedRuleId(rule.id);
  };

  /**
   * Submits the create rule form.
   */
  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    createRuleMutation.mutate({
      name,
      criteriaField,
      criteriaValue,
      targetTeamId: targetTeamId || null,
      targetAgentId: targetAgentId || null,
      assignmentMode,
    });
  };

  /**
   * Submits changes to the selected rule.
   */
  const handleUpdateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRuleId) return;
    updateRuleMutation.mutate({
      id: selectedRuleId,
      payload: {
        name: editName,
        criteriaField: editCriteriaField,
        criteriaValue: editCriteriaValue,
        targetTeamId: editTargetTeamId || null,
        targetAgentId: editTargetAgentId || null,
        assignmentMode: editAssignmentMode,
        isActive: editIsActive,
      },
    });
  };

  /**
   * Moves a rule up in the priority queue. Swaps positions and executes reorder mutation.
   * 
   * @param index Current index of the rule in the list
   */
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const reordered = [...rulesList];
    const temp = reordered[index];
    reordered[index] = reordered[index - 1];
    reordered[index - 1] = temp;
    reorderRulesMutation.mutate(reordered.map((r) => r.id));
  };

  /**
   * Moves a rule down in the priority queue. Swaps positions and executes reorder mutation.
   * 
   * @param index Current index of the rule in the list
   */
  const handleMoveDown = (index: number) => {
    if (index === rulesList.length - 1) return;
    const reordered = [...rulesList];
    const temp = reordered[index];
    reordered[index] = reordered[index + 1];
    reordered[index + 1] = temp;
    reorderRulesMutation.mutate(reordered.map((r) => r.id));
  };

  /**
   * Formats condition criteria values into human-readable strings.
   */
  const renderConditionText = (field: string, val: string) => {
    if (field === "priority") {
      return `Priority is '${val}'`;
    }
    if (field === "category") {
      return `Category is '${val}'`;
    }
    if (field === "client") {
      const clientObj = clientsList.find((c) => c.id === val);
      return `Client is '${clientObj ? clientObj.name : "Unknown client"}'`;
    }
    return "";
  };

  /**
   * Formats rule targets into human-readable strings.
   */
  const renderTargetText = (teamId: string | null, agentId: string | null, mode: string) => {
    const teamObj = teamsList.find((t) => t.id === teamId);
    const agentObj = staffList.find((s) => s.id === agentId);

    const modeText = mode === "round-robin" ? " (Round-Robin)" : "";

    if (teamObj && agentObj) {
      return `Assign to ${agentObj.firstName} ${agentObj.lastName} inside ${teamObj.name}${modeText}`;
    }
    if (teamObj) {
      return `Assign to ${teamObj.name}${modeText}`;
    }
    if (agentObj) {
      return `Assign to ${agentObj.firstName} ${agentObj.lastName}`;
    }
    return "No assignment target";
  };

  // =========================================================================
  // Render View (List View vs Edit detail view)
  // =========================================================================

  if (selectedRuleId && selectedRule) {
    return (
      <div className="w-full px-6 md:px-12 py-12 font-sans text-ink">
        {/* Detail Header */}
        <div className="mb-8 flex items-center justify-between">
          <button
            onClick={() => setSelectedRuleId(null)}
            className="flex items-center gap-2 text-xs font-semibold font-mono uppercase tracking-wider text-muted-foreground hover:text-ink transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to rules
          </button>

          <button
            type="button"
            onClick={() => {
              if (confirm("Delete this routing rule permanently?")) {
                deleteRuleMutation.mutate(selectedRule.id);
              }
            }}
            className="text-xs font-semibold text-danger flex items-center gap-1 hover:opacity-85 transition-opacity"
            disabled={deleteRuleMutation.isPending}
          >
            <Trash2 className="size-4" />
            Delete Rule
          </button>
        </div>

        {/* Rule details hero */}
        <div className="mb-10 p-6 border border-black/10 rounded-2xl bg-surface/5">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Priority Queue Rank: #{selectedRule.priorityOrder}
          </span>
          <h1 className="font-serif text-3xl mt-2">{selectedRule.name}</h1>
          <p className="text-xs text-muted-foreground mt-2 font-mono">
            Evaluated sequentially. If matched, the ticket stops routing.
          </p>
        </div>

        {/* Edit Form */}
        <div className="border border-black/10 rounded-2xl bg-canvas p-6 shadow-sm max-w-xl">
          <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-muted-foreground mb-6">
            Configure Rule Properties
          </h2>

          {editError && (
            <div className="mb-6 p-3 bg-danger/5 ring-1 ring-danger/15 rounded-lg text-xs text-danger flex items-start gap-2">
              <ShieldAlert className="size-4 shrink-0 mt-0.5" />
              <span>{editError}</span>
            </div>
          )}

          <form onSubmit={handleUpdateRule} className="space-y-4">
            <label className="block text-left">
              <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                Rule Name
              </span>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
              />
            </label>

            {/* Matching Criteria Block */}
            <div className="border border-black/10 rounded-xl p-4 bg-surface/5 space-y-4">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block">
                Rule Conditions (If...)
              </span>

              <div className="grid grid-cols-2 gap-4">
                <label className="block text-left">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                    Match Field
                  </span>
                  <select
                    value={editCriteriaField}
                    onChange={(e) => {
                      setEditCriteriaField(e.target.value as any);
                      setEditCriteriaValue("");
                    }}
                    className="w-full bg-canvas ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 transition-all"
                  >
                    <option value="priority">Priority</option>
                    <option value="category">Category / Workstream</option>
                    <option value="client">Client Account</option>
                  </select>
                </label>

                <label className="block text-left">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                    Criteria Value
                  </span>
                  {editCriteriaField === "priority" ? (
                    <select
                      value={editCriteriaValue}
                      onChange={(e) => setEditCriteriaValue(e.target.value)}
                      required
                      className="w-full bg-canvas ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 transition-all"
                    >
                      <option value="">Select Priority</option>
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  ) : editCriteriaField === "client" ? (
                    <select
                      value={editCriteriaValue}
                      onChange={(e) => setEditCriteriaValue(e.target.value)}
                      required
                      className="w-full bg-canvas ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 transition-all"
                    >
                      <option value="">Select Client Account</option>
                      {clientsList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      value={editCriteriaValue}
                      onChange={(e) => setEditCriteriaValue(e.target.value)}
                      placeholder="e.g. billing, infra"
                      className="w-full bg-canvas ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 transition-all"
                    />
                  )}
                </label>
              </div>
            </div>

            {/* Assignment Target Block */}
            <div className="border border-black/10 rounded-xl p-4 bg-surface/5 space-y-4">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block">
                Assignment Destination (Then...)
              </span>

              <div className="grid grid-cols-2 gap-4">
                <label className="block text-left">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                    Target Support Team
                  </span>
                  <select
                    value={editTargetTeamId}
                    onChange={(e) => setEditTargetTeamId(e.target.value)}
                    className="w-full bg-canvas ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 transition-all"
                  >
                    <option value="">No Team Assigned</option>
                    {teamsList.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-left">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                    Target Agent (Direct Only)
                  </span>
                  <select
                    value={editTargetAgentId}
                    onChange={(e) => setEditTargetAgentId(e.target.value)}
                    disabled={editAssignmentMode === "round-robin"}
                    className="w-full bg-canvas ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 transition-all disabled:opacity-50"
                  >
                    <option value="">No Agent Assigned</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.firstName} {s.lastName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block text-left">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                  Assignment Mode
                </span>
                <select
                  value={editAssignmentMode}
                  onChange={(e) => {
                    setEditAssignmentMode(e.target.value as any);
                    if (e.target.value === "round-robin") {
                      setEditTargetAgentId(""); // clear agent in round robin
                    }
                  }}
                  className="w-full bg-canvas ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 transition-all"
                >
                  <option value="direct">Direct (Static Assignment)</option>
                  <option value="round-robin">Round-Robin (Workload Load-Balanced)</option>
                </select>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 border border-black/10 rounded-xl bg-surface/5 mt-4">
              <div>
                <span className="text-xs font-semibold block">Active Rule Status</span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  Inactive rules are bypassed in the routing engine.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditIsActive(!editIsActive)}
                className={`relative w-10 h-6 rounded-full transition-colors flex items-center shrink-0 ${
                  editIsActive ? "bg-black" : "bg-black/10"
                }`}
              >
                <span
                  className={`size-5 rounded-full bg-canvas shadow-sm transition-transform absolute ${
                    editIsActive ? "right-0.5" : "left-0.5"
                  }`}
                />
              </button>
            </div>

            <button
              type="submit"
              disabled={updateRuleMutation.isPending}
              className="w-full bg-brand-primary text-brand-secondary py-2.5 rounded-lg text-xs font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 mt-4"
            >
              {updateRuleMutation.isPending ? "Saving rule settings…" : "Save Rule Settings"}
            </button>
          </form>
        </div>
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
            Ticket Assignment Rules
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-[65ch] leading-relaxed">
            Automate your triage operations. Create rules that scan incoming ticket properties and allocate cases to teams/agents sequentially.
          </p>
        </div>

        <button
          onClick={() => setIsNewRuleModalOpen(true)}
          className="bg-brand-primary text-brand-secondary py-3 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all shrink-0 shadow-sm"
        >
          <Plus className="size-4" />
          + New Rule
        </button>
      </div>

      {/* Rules list directory */}
      <div className="border border-black/10 rounded-2xl bg-canvas p-6 shadow-sm">
        <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-muted-foreground mb-6">
          Rule Evaluation Priority Queue
        </h2>

        {loadingRules ? (
          <div className="text-xs text-muted-foreground py-10 text-center">Loading routing rules…</div>
        ) : rulesList.length === 0 ? (
          <div className="text-xs text-muted-foreground py-12 text-center border border-dashed border-black/10 rounded-xl bg-surface/30">
            No automated rules configured yet. All tickets will default to the generic unassigned queue.
          </div>
        ) : (
          <div className="space-y-4">
            {rulesList.map((rule, idx) => (
              <div
                key={rule.id}
                className={`border border-black/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-black/20 ${
                  !rule.isActive ? "opacity-50 bg-black/[0.01]" : "bg-canvas"
                }`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  {/* Reordering Controls */}
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveUp(idx);
                      }}
                      disabled={idx === 0}
                      className="p-1 rounded hover:bg-black/5 disabled:opacity-20 transition-all"
                      title="Move Priority Up"
                    >
                      <ArrowUp className="size-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveDown(idx);
                      }}
                      disabled={idx === rulesList.length - 1}
                      className="p-1 rounded hover:bg-black/5 disabled:opacity-20 transition-all"
                      title="Move Priority Down"
                    >
                      <ArrowDown className="size-3.5" />
                    </button>
                  </div>

                  {/* Priority Badge */}
                  <div className="size-7 rounded-full bg-black/5 border border-black/5 flex items-center justify-center font-mono text-[10px] font-bold text-muted-foreground shrink-0">
                    #{rule.priorityOrder}
                  </div>

                  <div className="min-w-0">
                    <span
                      onClick={() => startEditing(rule)}
                      className="font-serif text-base font-semibold text-ink block hover:underline cursor-pointer"
                    >
                      {rule.name}
                    </span>
                    
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">
                        Condition:
                      </span>
                      <span className="text-xs text-ink font-semibold">
                        {renderConditionText(rule.criteriaField, rule.criteriaValue)}
                      </span>
                      <span className="text-muted-foreground/30 text-xs">•</span>
                      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">
                        Target:
                      </span>
                      <span className="text-xs text-ink font-semibold">
                        {renderTargetText(rule.targetTeamId, rule.targetAgentId, rule.assignmentMode)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 shrink-0">
                  <span
                    className={`text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${
                      rule.isActive ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                    }`}
                  >
                    {rule.isActive ? "Active" : "Inactive"}
                  </span>
                  
                  <button
                    onClick={() => startEditing(rule)}
                    className="text-xs font-semibold text-muted-foreground hover:text-ink transition-colors px-2 py-1 border border-black/10 rounded-lg"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Rule Modal */}
      {isNewRuleModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-canvas border border-black/10 rounded-2xl w-full max-w-md p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setIsNewRuleModalOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-ink transition-colors"
            >
              <X className="size-4" />
            </button>
            
            <h2 className="text-lg font-serif mb-2">New Assignment Rule</h2>
            <p className="text-xs text-muted-foreground mb-6">
              Establish a criteria trigger to automate ticket distribution.
            </p>

            {createError && (
              <div className="mb-4 p-3 bg-danger/5 ring-1 ring-danger/15 rounded-lg text-xs text-danger flex items-start gap-2">
                <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateRule} className="space-y-4">
              <label className="block text-left">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                  Rule Name
                </span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="E.g. VIP Triage Rule"
                  className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="block text-left">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                    Match Field
                  </span>
                  <select
                    value={criteriaField}
                    onChange={(e) => {
                      setCriteriaField(e.target.value as any);
                      setCriteriaValue("");
                    }}
                    className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 transition-all"
                  >
                    <option value="priority">Priority</option>
                    <option value="category">Category / Workstream</option>
                    <option value="client">Client Account</option>
                  </select>
                </label>

                <label className="block text-left">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                    Criteria Value
                  </span>
                  {criteriaField === "priority" ? (
                    <select
                      value={criteriaValue}
                      onChange={(e) => setCriteriaValue(e.target.value)}
                      required
                      className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 transition-all"
                    >
                      <option value="">Select Priority</option>
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  ) : criteriaField === "client" ? (
                    <select
                      value={criteriaValue}
                      onChange={(e) => setCriteriaValue(e.target.value)}
                      required
                      className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 transition-all"
                    >
                      <option value="">Select Client Account</option>
                      {clientsList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      value={criteriaValue}
                      onChange={(e) => setCriteriaValue(e.target.value)}
                      placeholder="e.g. billing, motion"
                      className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 transition-all"
                    />
                  )}
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="block text-left">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                    Target Team
                  </span>
                  <select
                    value={targetTeamId}
                    onChange={(e) => setTargetTeamId(e.target.value)}
                    className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 transition-all"
                  >
                    <option value="">Select Team</option>
                    {teamsList.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-left">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                    Target Agent (Direct Only)
                  </span>
                  <select
                    value={targetAgentId}
                    onChange={(e) => setTargetAgentId(e.target.value)}
                    disabled={assignmentMode === "round-robin"}
                    className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 transition-all disabled:opacity-50"
                  >
                    <option value="">Select Agent</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.firstName} {s.lastName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block text-left">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                  Assignment Mode
                </span>
                <select
                  value={assignmentMode}
                  onChange={(e) => {
                    setAssignmentMode(e.target.value as any);
                    if (e.target.value === "round-robin") {
                      setTargetAgentId(""); // clear agent in round robin
                    }
                  }}
                  className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 transition-all"
                >
                  <option value="direct">Direct (Static Assignment)</option>
                  <option value="round-robin">Round-Robin (Workload Load-Balanced)</option>
                </select>
              </label>

              <button
                type="submit"
                disabled={createRuleMutation.isPending}
                className="w-full bg-brand-primary text-brand-secondary py-2.5 rounded-lg text-xs font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 mt-2"
              >
                {createRuleMutation.isPending ? "Creating rule…" : "Create Rule"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
