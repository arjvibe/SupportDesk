import { useState } from "react";
import { Plus, X, ShieldAlert, ArrowUp, ArrowDown, Trash2, ArrowLeft } from "lucide-react";
import { useClientsList } from "@/features/tenant/clients";
import { useTeamsList, useAvailableAgents } from "@/features/tenant/teams";
import {
  useRulesList,
  useCreateRule,
  useUpdateRule,
  useDeleteRule,
  useReorderRules,
  RuleForm,
} from "@/features/tenant/rules";

export default function Rules() {
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [isNewRuleModalOpen, setIsNewRuleModalOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  // Queries
  const { data: rulesList = [], isLoading: loadingRules } = useRulesList();
  const { data: clientsList = [] } = useClientsList();
  const { data: teamsList = [] } = useTeamsList();
  const { data: staffList = [] } = useAvailableAgents();

  // Mutations
  const createRuleMutation = useCreateRule();
  const updateRuleMutation = useUpdateRule();
  const deleteRuleMutation = useDeleteRule();
  const reorderRulesMutation = useReorderRules();

  const selectedRule = rulesList.find((r) => r.id === selectedRuleId);

  // Handlers
  const handleCreateRuleSubmit = (payload: any) => {
    setCreateError(null);
    createRuleMutation.mutate(payload, {
      onSuccess: () => {
        setIsNewRuleModalOpen(false);
      },
      onError: (err: any) => {
        setCreateError(err.message || "Failed to create rule");
      },
    });
  };

  const handleUpdateRuleSubmit = (payload: any) => {
    if (!selectedRuleId) return;
    setEditError(null);
    updateRuleMutation.mutate(
      {
        id: selectedRuleId,
        payload,
      },
      {
        onSuccess: () => {
          setSelectedRuleId(null);
        },
        onError: (err: any) => {
          setEditError(err.message || "Failed to update rule settings");
        },
      }
    );
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const reordered = [...rulesList];
    const temp = reordered[index];
    reordered[index] = reordered[index - 1];
    reordered[index - 1] = temp;
    reorderRulesMutation.mutate(reordered.map((r) => r.id));
  };

  const handleMoveDown = (index: number) => {
    if (index === rulesList.length - 1) return;
    const reordered = [...rulesList];
    const temp = reordered[index];
    reordered[index] = reordered[index + 1];
    reordered[index + 1] = temp;
    reorderRulesMutation.mutate(reordered.map((r) => r.id));
  };

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

  if (selectedRuleId && selectedRule) {
    return (
      <div className="w-full font-sans text-ink">
        {/* Detail Header */}
        <div className="mb-8 flex items-center justify-between">
          <button
            onClick={() => setSelectedRuleId(null)}
            className="flex items-center gap-2 text-xs font-semibold font-mono uppercase tracking-wider text-muted-foreground hover:text-ink transition-colors cursor-pointer text-left"
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
            className="text-xs font-semibold text-danger flex items-center gap-1 hover:opacity-85 transition-opacity cursor-pointer"
            disabled={deleteRuleMutation.isPending}
          >
            <Trash2 className="size-4" />
            Delete Rule
          </button>
        </div>

        {/* Rule details hero */}
        <div className="mb-10 p-6 border border-black/10 rounded-2xl bg-surface/5 select-none">
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
          <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-muted-foreground mb-6 select-none">
            Configure Rule Properties
          </h2>

          {editError && (
            <div className="mb-6 p-3 bg-danger/5 ring-1 ring-danger/15 rounded-lg text-xs text-danger flex items-start gap-2">
              <ShieldAlert className="size-4 shrink-0 mt-0.5" />
              <span>{editError}</span>
            </div>
          )}

          <RuleForm
            isEdit={true}
            initialValues={selectedRule}
            clientsList={clientsList}
            teamsList={teamsList}
            staffList={staffList}
            onSubmit={handleUpdateRuleSubmit}
            isLoading={updateRuleMutation.isPending}
            onCancel={() => setSelectedRuleId(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full font-sans text-ink">
      {/* Title Header */}
      <div className="mb-10 flex items-start justify-between">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground select-none">
            Workspace Configuration
          </span>
          <h1 className="font-serif text-5xl leading-tight mt-1 text-balance">
            Ticket Assignment Rules
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-[65ch] leading-relaxed select-none">
            Automate your triage operations. Create rules that scan incoming ticket properties and allocate cases to teams/agents sequentially.
          </p>
        </div>

        <button
          onClick={() => setIsNewRuleModalOpen(true)}
          className="bg-brand-primary text-brand-secondary py-3 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all shrink-0 shadow-sm cursor-pointer"
        >
          <Plus className="size-4" />
          + New Rule
        </button>
      </div>

      {/* Rules list directory */}
      <div className="border border-black/10 rounded-2xl bg-canvas p-6 shadow-sm">
        <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-muted-foreground mb-6 select-none">
          Rule Evaluation Priority Queue
        </h2>

        {loadingRules ? (
          <div className="text-xs text-muted-foreground py-10 text-center select-none">Loading routing rules…</div>
        ) : rulesList.length === 0 ? (
          <div className="text-xs text-muted-foreground py-12 text-center border border-dashed border-black/10 rounded-xl bg-surface/30 select-none">
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
                  <div className="flex flex-col gap-1 shrink-0 select-none">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveUp(idx);
                      }}
                      disabled={idx === 0}
                      className="p-1 rounded hover:bg-black/5 disabled:opacity-20 transition-all cursor-pointer"
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
                      className="p-1 rounded hover:bg-black/5 disabled:opacity-20 transition-all cursor-pointer"
                      title="Move Priority Down"
                    >
                      <ArrowDown className="size-3.5" />
                    </button>
                  </div>

                  {/* Priority Badge */}
                  <div className="size-7 rounded-full bg-black/5 border border-black/5 flex items-center justify-center font-mono text-[10px] font-bold text-muted-foreground shrink-0 select-none">
                    #{rule.priorityOrder}
                  </div>

                  <div className="min-w-0">
                    <span
                      onClick={() => setSelectedRuleId(rule.id)}
                      className="font-serif text-base font-semibold text-ink block hover:underline cursor-pointer"
                    >
                      {rule.name}
                    </span>
                    
                    <div className="flex flex-wrap items-center gap-2 mt-1 select-none">
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

                <div className="flex items-center justify-end gap-3 shrink-0 select-none">
                  <span
                    className={`text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${
                      rule.isActive ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                    }`}
                  >
                    {rule.isActive ? "Active" : "Inactive"}
                  </span>
                  
                  <button
                    onClick={() => setSelectedRuleId(rule.id)}
                    className="text-xs font-semibold text-muted-foreground hover:text-ink transition-colors px-2 py-1 border border-black/10 rounded-lg cursor-pointer"
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
              className="absolute top-4 right-4 text-muted-foreground hover:text-ink transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
            
            <h2 className="text-lg font-serif mb-2 select-none">New Assignment Rule</h2>
            <p className="text-xs text-muted-foreground mb-6 select-none">
              Establish a criteria trigger to automate ticket distribution.
            </p>

            {createError && (
              <div className="mb-4 p-3 bg-danger/5 ring-1 ring-danger/15 rounded-lg text-xs text-danger flex items-start gap-2">
                <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                <span>{createError}</span>
              </div>
            )}

            <RuleForm
              clientsList={clientsList}
              teamsList={teamsList}
              staffList={staffList}
              onSubmit={handleCreateRuleSubmit}
              isLoading={createRuleMutation.isPending}
              onCancel={() => setIsNewRuleModalOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
