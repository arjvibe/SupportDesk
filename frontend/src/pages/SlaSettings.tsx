import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiBase } from "../utils/api";
import { Plus, X, ShieldAlert, Check, ShieldCheck } from "lucide-react";

type SlaTarget = {
  id: string;
  slaPolicyId: string;
  priority: "low" | "normal" | "high" | "urgent";
  responseTimeHours: number;
  resolutionTimeHours: number;
  escalateAfterHours: number;
};

type SlaPolicy = {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  businessHoursStart: string;
  businessHoursEnd: string;
  businessDays: string[];
};

type SlaPolicyDetails = SlaPolicy & {
  targets: SlaTarget[];
};

const API_BASE = getApiBase();

const DAYS = [
  { code: "1", label: "Mon" },
  { code: "2", label: "Tue" },
  { code: "3", label: "Wed" },
  { code: "4", label: "Thu" },
  { code: "5", label: "Fri" },
  { code: "6", label: "Sat" },
  { code: "7", label: "Sun" },
];

/**
 * SLASettings component.
 * Allows Admins to define SLA policies, set calendar working hours/days,
 * and customize response/resolution targets across priority tiers (low, normal, high, urgent).
 */
export default function SLASettings() {
  const queryClient = useQueryClient();
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);

  // Modal control states
  const [isNewPolicyModalOpen, setIsNewPolicyModalOpen] = useState(false);

  // Form states for creating a new SLA policy
  const [newPolicyName, setNewPolicyName] = useState("");
  const [newPolicyDescription, setNewPolicyDescription] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  // Editor states (bind to selected policy metadata & targets)
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [businessStart, setBusinessStart] = useState("09:00");
  const [businessEnd, setBusinessEnd] = useState("18:00");
  const [activeDays, setActiveDays] = useState<string[]>([]);
  const [targets, setTargets] = useState<SlaTarget[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // =========================================================================
  // 1. Data Fetching Queries
  // =========================================================================

  // Fetch all SLA Policies in the host Org
  const { data: policiesList = [], isLoading: loadingPolicies } = useQuery<SlaPolicy[]>({
    queryKey: ["sla_policies"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/sla`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch SLA policies");
      return res.json();
    },
  });

  // Automatically select the default policy (or first policy) when list loads
  useEffect(() => {
    if (policiesList.length > 0 && !selectedPolicyId) {
      const defaultPolicy = policiesList.find((p) => p.isDefault) || policiesList[0];
      setSelectedPolicyId(defaultPolicy.id);
    }
  }, [policiesList, selectedPolicyId]);

  // Fetch details of the selected SLA Policy (with its priority targets matrix)
  const { data: activePolicy, isLoading: loadingDetails } = useQuery<SlaPolicyDetails>({
    queryKey: ["sla_policies", selectedPolicyId],
    queryFn: async () => {
      if (!selectedPolicyId) throw new Error("No policy selected");
      const res = await fetch(`${API_BASE}/sla/${selectedPolicyId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch SLA policy details");
      return res.json();
    },
    enabled: !!selectedPolicyId,
  });

  // Populate editor form states when active policy data is fetched
  useEffect(() => {
    if (activePolicy) {
      setName(activePolicy.name);
      setDescription(activePolicy.description || "");
      
      // Format backend "HH:MM:SS" time values to "HH:MM" for HTML input tags
      const formatTime = (t: string) => (t && t.length >= 5 ? t.substring(0, 5) : t);
      setBusinessStart(formatTime(activePolicy.businessHoursStart));
      setBusinessEnd(formatTime(activePolicy.businessHoursEnd));
      
      setActiveDays(activePolicy.businessDays || []);
      setTargets(activePolicy.targets || []);
      setSaveError(null);
      setSaveSuccess(false);
    }
  }, [activePolicy]);

  // =========================================================================
  // 2. Mutation Hooks
  // =========================================================================

  /**
   * Mutation hook to create a new SLA policy record.
   * On success, refreshes the primary policies list and sets the new policy as selected.
   */
  const createPolicyMutation = useMutation({
    mutationFn: async (payload: { name: string; description: string }) => {
      const res = await fetch(`${API_BASE}/sla`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create SLA policy");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["sla_policies"] });
      setNewPolicyName("");
      setNewPolicyDescription("");
      setCreateError(null);
      setIsNewPolicyModalOpen(false);
      setSelectedPolicyId(data.id); // Autofocus new policy
    },
    onError: (err: any) => {
      setCreateError(err.message);
    },
  });

  /**
   * Mutation hook to save general policy changes (metadata, calendar business hours, days).
   */
  const updatePolicyMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await fetch(`${API_BASE}/sla/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update policy settings");
      return data;
    },
    onError: (err: any) => {
      setSaveError(err.message);
    },
  });

  /**
   * Mutation hook to bulk save the priority targets threshold matrix.
   */
  const updateTargetsMutation = useMutation({
    mutationFn: async ({ id, targets }: { id: string; targets: SlaTarget[] }) => {
      const res = await fetch(`${API_BASE}/sla/${id}/targets`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save SLA targets");
      return data;
    },
    onError: (err: any) => {
      setSaveError(err.message);
    },
  });

  /**
   * Mutation hook to promote the selected SLA policy as the organization default.
   */
  const makeDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_BASE}/sla/${id}/default`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to set default policy");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla_policies"] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (err: any) => {
      setSaveError(err.message);
    },
  });

  // =========================================================================
  // 3. Form Submission Handlers
  // =========================================================================

  /**
   * Handles creation submission for a new SLA policy.
   * 
   * @param e React form submission event
   */
  const handleCreatePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    createPolicyMutation.mutate({
      name: newPolicyName,
      description: newPolicyDescription,
    });
  };

  /**
   * Saves both the general metadata and target matrices in a combined handler.
   * Triggers validations (e.g. response hours cannot exceed resolution hours).
   * 
   * @param e React form submission event
   */
  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPolicyId) return;

    setSaveError(null);
    setSaveSuccess(false);

    // Validate targets before submission
    for (const target of targets) {
      if (target.responseTimeHours > target.resolutionTimeHours) {
        setSaveError(
          `Validation Error: Response target for ${target.priority} (${target.responseTimeHours}h) cannot exceed its Resolution target (${target.resolutionTimeHours}h).`
        );
        return;
      }
    }

    try {
      // 1. Save metadata & calendar
      await updatePolicyMutation.mutateAsync({
        id: selectedPolicyId,
        payload: {
          name,
          description: description || null,
          businessHoursStart: `${businessStart}:00`,
          businessHoursEnd: `${businessEnd}:00`,
          businessDays: activeDays,
        },
      });

      // 2. Save targets matrix
      await updateTargetsMutation.mutateAsync({
        id: selectedPolicyId,
        targets,
      });

      queryClient.invalidateQueries({ queryKey: ["sla_policies", selectedPolicyId] });
      queryClient.invalidateQueries({ queryKey: ["sla_policies"] }); // refresh defaults indicator
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      // Errors are caught and handled by mutation onError handlers
    }
  };

  /**
   * Toggles checkboxes for active business days inside state.
   * 
   * @param code String code representing day of week ("1" = Monday, "7" = Sunday)
   */
  const handleDayToggle = (code: string) => {
    if (activeDays.includes(code)) {
      setActiveDays(activeDays.filter((d) => d !== code));
    } else {
      setActiveDays([...activeDays, code].sort());
    }
  };

  /**
   * Handles numeric field updates inside the specific SLA target array record.
   * 
   * @param index Target array position index
   * @param field Target field property key
   * @param val Numeric target value
   */
  const handleTargetFieldChange = (index: number, field: keyof SlaTarget, val: number) => {
    const updated = [...targets];
    updated[index] = {
      ...updated[index],
      [field]: Math.max(0, val),
    };
    setTargets(updated);
  };

  return (
    <div className="w-full px-6 md:px-12 py-12 font-sans text-ink">
      {/* Title Header */}
      <div className="mb-10 flex items-start justify-between">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Workspace Configuration
          </span>
          <h1 className="font-serif text-5xl leading-tight mt-1 text-balance">
            Service Level Agreements
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-[65ch] leading-relaxed">
            Configure response/resolution target matrices and calendar active hours. Tickets will automatically assign deadline metrics based on these thresholds.
          </p>
        </div>

        <button
          onClick={() => setIsNewPolicyModalOpen(true)}
          className="bg-brand-primary text-brand-secondary py-3 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all shrink-0 shadow-sm"
        >
          <Plus className="size-4" />
          + New Policy
        </button>
      </div>

      {loadingPolicies ? (
        <div className="text-xs text-muted-foreground py-10 text-center">Loading SLA configurations…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Left Column: Policies Directory */}
          <div className="space-y-4">
            <h2 className="text-xs font-semibold font-mono uppercase tracking-wider text-muted-foreground mb-4">
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
                  <div className="flex justify-between items-start mb-2">
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
              <div className="text-xs text-muted-foreground py-12 text-center border border-black/10 rounded-2xl bg-surface/5">
                Loading policy settings…
              </div>
            ) : !activePolicy ? (
              <div className="text-xs text-muted-foreground py-12 text-center border border-dashed border-black/10 rounded-2xl bg-surface/5">
                Select an SLA Policy from the directory to review and edit settings.
              </div>
            ) : (
              <form onSubmit={handleSavePolicy} className="space-y-6">
                <div className="border border-black/10 rounded-2xl bg-canvas p-6 shadow-sm">
                  {/* Editor Header Status */}
                  <div className="flex justify-between items-center mb-6 pb-4 border-b border-black/5">
                    <div>
                      <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-muted-foreground">
                        Policy Configuration Editor
                      </h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Set working calendars and priority deadline multipliers.
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {!activePolicy.isDefault && (
                        <button
                          type="button"
                          onClick={() => makeDefaultMutation.mutate(activePolicy.id)}
                          className="bg-transparent hover:bg-black/5 text-ink border border-black/10 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all"
                          disabled={makeDefaultMutation.isPending}
                        >
                          Make Org Default
                        </button>
                      )}
                      
                      <button
                        type="submit"
                        className="bg-brand-primary text-brand-secondary rounded-lg px-4 py-1.5 text-xs font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm"
                      >
                        Save Policy Settings
                      </button>
                    </div>
                  </div>

                  {saveError && (
                    <div className="mb-6 p-3 bg-danger/5 ring-1 ring-danger/15 rounded-lg text-xs text-danger flex items-start gap-2">
                      <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                      <span>{saveError}</span>
                    </div>
                  )}

                  {saveSuccess && (
                    <div className="mb-6 p-3 bg-success/5 ring-1 ring-success/15 rounded-lg text-xs text-success flex items-start gap-2">
                      <ShieldCheck className="size-4 shrink-0 mt-0.5" />
                      <span>SLA policy settings successfully saved!</span>
                    </div>
                  )}

                  <div className="space-y-6">
                    {/* General details */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-1">
                        <span className="text-xs font-semibold block">SLA Identity</span>
                        <span className="text-[10px] text-muted-foreground block mt-0.5">
                          Name and purpose explanation.
                        </span>
                      </div>

                      <div className="md:col-span-2 space-y-4">
                        <label className="block text-left">
                          <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                            Policy Name
                          </span>
                          <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
                          />
                        </label>

                        <label className="block text-left">
                          <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                            Description
                          </span>
                          <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                            className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all resize-none"
                          />
                        </label>
                      </div>
                    </div>

                    <hr className="border-black/5" />

                    {/* Business Hours Calendar */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-1">
                        <span className="text-xs font-semibold block">Business Hours Calendar</span>
                        <span className="text-[10px] text-muted-foreground block mt-0.5">
                          Defines days and hours when SLA response and resolution timers are active.
                        </span>
                      </div>

                      <div className="md:col-span-2 space-y-4">
                        {/* Day Selector checkboxes */}
                        <div>
                          <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-2">
                            Working Days
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {DAYS.map((d) => {
                              const isActive = activeDays.includes(d.code);
                              return (
                                <button
                                  type="button"
                                  key={d.code}
                                  onClick={() => handleDayToggle(d.code)}
                                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                    isActive
                                      ? "bg-black text-canvas"
                                      : "bg-black/5 hover:bg-black/10 text-muted-foreground"
                                  }`}
                                >
                                  {d.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Working Hours start/end picker */}
                        <div className="grid grid-cols-2 gap-4">
                          <label className="block text-left">
                            <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                              Working Hours Start
                            </span>
                            <input
                              type="time"
                              required
                              value={businessStart}
                              onChange={(e) => setBusinessStart(e.target.value)}
                              className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all font-mono"
                            />
                          </label>

                          <label className="block text-left">
                            <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                              Working Hours End
                            </span>
                            <input
                              type="time"
                              required
                              value={businessEnd}
                              onChange={(e) => setBusinessEnd(e.target.value)}
                              className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all font-mono"
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    <hr className="border-black/5" />

                    {/* Targets Threshold Matrix */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-1">
                        <span className="text-xs font-semibold block">SLA Target Thresholds</span>
                        <span className="text-[10px] text-muted-foreground block mt-0.5">
                          Set target intervals (in hours) for First Response, Resolution, and warning offset.
                        </span>
                      </div>

                      <div className="md:col-span-2 space-y-4">
                        {targets.map((target, idx) => (
                          <div
                            key={target.id}
                            className="border border-black/10 rounded-xl p-4 bg-surface/5 grid grid-cols-1 sm:grid-cols-4 gap-4 items-center"
                          >
                            <div className="sm:col-span-1">
                              <span className="text-xs font-bold uppercase tracking-wider font-mono block">
                                {target.priority}
                              </span>
                            </div>

                            <div className="grid grid-cols-3 sm:col-span-3 gap-2">
                              <label className="block">
                                <span className="text-[8px] font-mono uppercase tracking-widest text-muted-foreground block mb-0.5">
                                  Response (h)
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  required
                                  value={target.responseTimeHours}
                                  onChange={(e) => handleTargetFieldChange(idx, "responseTimeHours", Number(e.target.value))}
                                  className="w-full bg-canvas ring-1 ring-black/10 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-black/20 transition-all font-mono"
                                />
                              </label>

                              <label className="block">
                                <span className="text-[8px] font-mono uppercase tracking-widest text-muted-foreground block mb-0.5">
                                  Resolve (h)
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  required
                                  value={target.resolutionTimeHours}
                                  onChange={(e) => handleTargetFieldChange(idx, "resolutionTimeHours", Number(e.target.value))}
                                  className="w-full bg-canvas ring-1 ring-black/10 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-black/20 transition-all font-mono"
                                />
                              </label>

                              <label className="block">
                                <span className="text-[8px] font-mono uppercase tracking-widest text-muted-foreground block mb-0.5">
                                  Escalate (h)
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  value={target.escalateAfterHours}
                                  onChange={(e) => handleTargetFieldChange(idx, "escalateAfterHours", Number(e.target.value))}
                                  className="w-full bg-canvas ring-1 ring-black/10 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-black/20 transition-all font-mono"
                                />
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </form>
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
              className="absolute top-4 right-4 text-muted-foreground hover:text-ink transition-colors"
            >
              <X className="size-4" />
            </button>
            
            <h2 className="text-lg font-serif mb-2">New SLA Policy</h2>
            <p className="text-xs text-muted-foreground mb-6">
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
                className="w-full bg-brand-primary text-brand-secondary py-2.5 rounded-lg text-xs font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 mt-2"
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
