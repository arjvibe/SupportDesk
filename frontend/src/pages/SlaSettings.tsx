import { useState, useEffect } from "react";
import { Plus, X, ShieldAlert, Check } from "lucide-react";
import {
  useSlaPolicies,
  useSlaPolicyDetails,
  useCreateSlaPolicy,
  useUpdateSlaPolicy,
  useUpdateSlaTargets,
  useMakeDefaultSlaPolicy,
  SlaPolicyForm,
  SlaFormValues,
} from "@/features/tenant/sla";

export default function SLASettings() {
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);

  // Modal control states
  const [isNewPolicyModalOpen, setIsNewPolicyModalOpen] = useState(false);

  // Form states for creating a new SLA policy
  const [newPolicyName, setNewPolicyName] = useState("");
  const [newPolicyDescription, setNewPolicyDescription] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Queries
  const { data: policiesList = [], isLoading: loadingPolicies } = useSlaPolicies();
  const { data: activePolicy, isLoading: loadingDetails } = useSlaPolicyDetails(selectedPolicyId);

  // Mutations
  const createPolicyMutation = useCreateSlaPolicy();
  const updatePolicyMutation = useUpdateSlaPolicy();
  const updateTargetsMutation = useUpdateSlaTargets();
  const makeDefaultMutation = useMakeDefaultSlaPolicy();

  // Automatically select the default policy (or first policy) when list loads
  useEffect(() => {
    if (policiesList.length > 0 && !selectedPolicyId) {
      const defaultPolicy = policiesList.find((p) => p.isDefault) || policiesList[0];
      setSelectedPolicyId(defaultPolicy.id);
    }
  }, [policiesList, selectedPolicyId]);

  // Handlers
  const handleCreatePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    createPolicyMutation.mutate(
      {
        name: newPolicyName,
        description: newPolicyDescription,
      },
      {
        onSuccess: (data) => {
          setNewPolicyName("");
          setNewPolicyDescription("");
          setIsNewPolicyModalOpen(false);
          setSelectedPolicyId(data.id);
        },
        onError: (err: any) => {
          setCreateError(err.message || "Failed to create policy");
        },
      }
    );
  };

  const handleSavePolicySubmit = async (data: SlaFormValues) => {
    if (!selectedPolicyId) return;
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // 1. Save metadata & calendar
      await updatePolicyMutation.mutateAsync({
        id: selectedPolicyId,
        payload: {
          name: data.name,
          description: data.description || null,
          businessHoursStart: `${data.businessHoursStart}:00`,
          businessHoursEnd: `${data.businessHoursEnd}:00`,
          businessDays: data.businessDays,
        },
      });

      // 2. Save targets matrix
      await updateTargetsMutation.mutateAsync({
        id: selectedPolicyId,
        targets: data.targets as any,
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || "Failed to save policy settings");
    }
  };

  const handleMakeDefault = () => {
    if (!selectedPolicyId) return;
    setSaveError(null);
    setSaveSuccess(false);
    makeDefaultMutation.mutate(selectedPolicyId, {
      onSuccess: () => {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      },
      onError: (err: any) => {
        setSaveError(err.message || "Failed to set default policy");
      },
    });
  };

  return (
    <div className="w-full font-sans text-ink">
      {/* Title Header */}
      <div className="mb-10 flex items-start justify-between">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground select-none">
            Workspace Configuration
          </span>
          <h1 className="font-serif text-5xl leading-tight mt-1 text-balance">
            Service Level Agreements
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-[65ch] leading-relaxed select-none">
            Configure response/resolution target matrices and calendar active hours. Tickets will automatically assign deadline metrics based on these thresholds.
          </p>
        </div>

        <button
          onClick={() => setIsNewPolicyModalOpen(true)}
          className="bg-brand-primary text-brand-secondary py-3 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all shrink-0 shadow-sm cursor-pointer"
        >
          <Plus className="size-4" />
          + New Policy
        </button>
      </div>

      {loadingPolicies ? (
        <div className="text-xs text-muted-foreground py-10 text-center select-none">Loading SLA configurations…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Left Column: Policies Directory */}
          <div className="space-y-4">
            <h2 className="text-xs font-semibold font-mono uppercase tracking-wider text-muted-foreground mb-4 select-none">
              Active SLA Policies
            </h2>

            <div className="space-y-3">
              {policiesList.map((policy) => (
                <div
                  key={policy.id}
                  onClick={() => setSelectedPolicyId(policy.id)}
                  className={`border rounded-xl p-4 cursor-pointer transition-all duration-150 relative ${
                    selectedPolicyId === policy.id
                      ? "bg-canvas border-black/30 shadow-sm ring-1 ring-black/10"
                      : "bg-surface/5 border-black/10 hover:border-black/25"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2 select-none">
                    <h3 className="text-sm font-semibold text-ink leading-none">{policy.name}</h3>
                    {policy.isDefault && (
                      <span className="text-[8px] font-mono font-bold tracking-widest uppercase bg-brand-primary text-brand-secondary px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <Check className="size-2.5" /> Default
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {policy.description || "No description provided."}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right Columns: Policy Settings Editor */}
          <div className="lg:col-span-2">
            {loadingDetails ? (
              <div className="text-xs text-muted-foreground py-12 text-center border border-black/10 rounded-2xl bg-surface/5 select-none">
                Loading policy settings…
              </div>
            ) : !activePolicy ? (
              <div className="text-xs text-muted-foreground py-12 text-center border border-dashed border-black/10 rounded-2xl bg-surface/5 select-none">
                Select an SLA Policy from the directory to review and edit settings.
              </div>
            ) : (
              <SlaPolicyForm
                key={activePolicy.id} // forces reset on policy change
                policyDetails={activePolicy}
                onSubmit={handleSavePolicySubmit}
                isLoading={updatePolicyMutation.isPending || updateTargetsMutation.isPending}
                error={saveError}
                success={saveSuccess}
                onMakeDefault={handleMakeDefault}
                isMakingDefault={makeDefaultMutation.isPending}
              />
            )}
          </div>
        </div>
      )}

      {/* Create SLA Policy Modal */}
      {isNewPolicyModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-canvas border border-black/10 rounded-2xl w-full max-w-md p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setIsNewPolicyModalOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-ink transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
            
            <h2 className="text-lg font-serif mb-2 select-none">New SLA Policy</h2>
            <p className="text-xs text-muted-foreground mb-6 select-none">
              Create a custom response/resolution tier profile. Default targets will automatically initialize.
            </p>

            {createError && (
              <div className="mb-4 p-3 bg-danger/5 ring-1 ring-danger/15 rounded-lg text-xs text-danger flex items-start gap-2">
                <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreatePolicy} className="space-y-4">
              <label className="block text-left">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                  Policy Name
                </span>
                <input
                  type="text"
                  required
                  value={newPolicyName}
                  onChange={(e) => setNewPolicyName(e.target.value)}
                  placeholder="E.g. VIP Enterprise Policy"
                  className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
                />
              </label>

              <label className="block text-left">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                  Description
                </span>
                <textarea
                  value={newPolicyDescription}
                  onChange={(e) => setNewPolicyDescription(e.target.value)}
                  placeholder="E.g. Specific thresholds for clients with enterprise tier contracts."
                  rows={3}
                  className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all resize-none"
                />
              </label>

              <button
                type="submit"
                disabled={createPolicyMutation.isPending}
                className="w-full bg-brand-primary text-brand-secondary py-2.5 rounded-lg text-xs font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 mt-2 cursor-pointer"
              >
                {createPolicyMutation.isPending ? "Creating policy…" : "Create Policy"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
