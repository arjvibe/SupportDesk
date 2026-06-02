import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiBase } from "../utils/api";
import { Plus, ArrowLeft, ArrowRight, X, ShieldAlert, Search } from "lucide-react";

type StaffMember = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "admin" | "agent";
  jobTitle: string | null;
  initials: string;
  isActive: boolean;
  createdAt: string;
  teamCount: number;
};

const API_BASE = getApiBase();

/**
 * Staff management component.
 * Lists all internal staff users (Admins & Agents) belonging to the organization.
 * Allows Org Admins to register new staff, update profile details, adjust roles,
 * and soft-deactivate/reactivate staff members to preserve historical ticket mappings.
 */
export default function Staff() {
  const queryClient = useQueryClient();
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal control state
  const [isNewStaffModalOpen, setIsNewStaffModalOpen] = useState(false);

  // Form states for creating a new staff member
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "agent">("agent");
  const [jobTitle, setJobTitle] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  // Form states for editing an existing staff member
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "agent">("agent");
  const [editJobTitle, setEditJobTitle] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);

  // =========================================================================
  // 1. Data Fetching Queries
  // =========================================================================

  // Fetch staff list (only accessible to Org admins)
  const { data: staffList = [], isLoading: loadingStaff } = useQuery<StaffMember[]>({
    queryKey: ["staff_directory"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/staff`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch staff members directory");
      return res.json();
    },
  });

  const selectedStaff = staffList.find((s) => s.id === selectedStaffId);

  // =========================================================================
  // 2. Mutation Hooks
  // =========================================================================

  /**
   * Mutation hook to register a new staff member (admin or agent) in the Org.
   * On success, invalidates the staff query key and resets creation form fields.
   */
  const createStaffMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`${API_BASE}/staff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create staff member");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff_directory"] });
      // Invalidate available agents lists used by teams tab
      queryClient.invalidateQueries({ queryKey: ["available_agents"] });
      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
      setRole("agent");
      setJobTitle("");
      setCreateError(null);
      setIsNewStaffModalOpen(false);
    },
    onError: (err: any) => {
      setCreateError(err.message);
    },
  });

  /**
   * Mutation hook to update details and active status for a staff member.
   * On success, refreshes the directory and closes the editor panel.
   */
  const updateStaffMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await fetch(`${API_BASE}/staff/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update staff member details");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff_directory"] });
      queryClient.invalidateQueries({ queryKey: ["available_agents"] });
      setEditError(null);
      setSelectedStaffId(null);
    },
    onError: (err: any) => {
      setEditError(err.message);
    },
  });

  // =========================================================================
  // 3. Handlers
  // =========================================================================

  /**
   * Initiates edit form state from the selected staff member details.
   * 
   * @param staff The staff member record to populate in the editor
   */
  const startEditing = (staff: StaffMember) => {
    setEditFirstName(staff.firstName);
    setEditLastName(staff.lastName);
    setEditEmail(staff.email);
    setEditRole(staff.role);
    setEditJobTitle(staff.jobTitle || "");
    setEditIsActive(staff.isActive);
    setEditError(null);
    setSelectedStaffId(staff.id);
  };

  /**
   * Submits the create staff form to the backend mutation.
   * 
   * @param e React form submission event
   */
  const handleCreateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    createStaffMutation.mutate({
      firstName,
      lastName,
      email,
      password,
      role,
      jobTitle: jobTitle || null,
    });
  };

  /**
   * Submits the update staff form to the backend mutation.
   * 
   * @param e React form submission event
   */
  const handleUpdateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId) return;
    updateStaffMutation.mutate({
      id: selectedStaffId,
      payload: {
        firstName: editFirstName,
        lastName: editLastName,
        email: editEmail,
        role: editRole,
        jobTitle: editJobTitle || null,
        isActive: editIsActive,
      },
    });
  };

  // =========================================================================
  // 4. Searching & Statistics
  // =========================================================================

  const filteredStaff = staffList.filter((st) => {
    const query = searchQuery.toLowerCase();
    return (
      st.firstName.toLowerCase().includes(query) ||
      st.lastName.toLowerCase().includes(query) ||
      st.email.toLowerCase().includes(query) ||
      (st.jobTitle && st.jobTitle.toLowerCase().includes(query))
    );
  });

  const totalStaff = staffList.length;
  const totalAdmins = staffList.filter((s) => s.role === "admin").length;
  const totalAgents = staffList.filter((s) => s.role === "agent").length;

  // =========================================================================
  // Render View (List Directory vs Edit Detail View)
  // =========================================================================

  if (selectedStaffId && selectedStaff) {
    return (
      <div className="w-full px-6 md:px-12 py-12 font-sans text-ink">
        {/* Detail Header */}
        <div className="mb-8">
          <button
            onClick={() => setSelectedStaffId(null)}
            className="flex items-center gap-2 text-xs font-semibold font-mono uppercase tracking-wider text-muted-foreground hover:text-ink transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to directory
          </button>
        </div>

        {/* Staff Hero Display */}
        <div className="mb-10 p-6 border border-black/10 rounded-2xl bg-surface/5 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Staff Member details
            </span>
            <div className="flex items-center gap-4 mt-2">
              <div className="size-12 rounded-full bg-black/10 grid place-items-center font-mono text-base font-semibold">
                {selectedStaff.initials}
              </div>
              <div>
                <h1 className="font-serif text-3xl">{selectedStaff.firstName} {selectedStaff.lastName}</h1>
                <p className="text-xs text-muted-foreground font-mono mt-1">
                  {selectedStaff.email}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-6 text-left">
            <div>
              <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block">
                System Role
              </span>
              <span className="text-xs font-bold uppercase tracking-wider font-mono bg-brand-primary text-brand-secondary px-2.5 py-0.5 rounded-full inline-block mt-1">
                {selectedStaff.role}
              </span>
            </div>
            <div>
              <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block">
                Team Memberships
              </span>
              <span className="text-xs font-semibold block mt-2">
                Assigned to {selectedStaff.teamCount} support groups
              </span>
            </div>
          </div>
        </div>

        {/* Edit Form Card */}
        <div className="border border-black/10 rounded-2xl bg-canvas p-6 shadow-sm max-w-xl">
          <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-muted-foreground mb-6">
            Edit Staff Profile & Access Controls
          </h2>

          {editError && (
            <div className="mb-6 p-3 bg-danger/5 ring-1 ring-danger/15 rounded-lg text-xs text-danger flex items-start gap-2">
              <ShieldAlert className="size-4 shrink-0 mt-0.5" />
              <span>{editError}</span>
            </div>
          )}

          <form onSubmit={handleUpdateStaff} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-left">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                  First Name
                </span>
                <input
                  type="text"
                  required
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
                />
              </label>
              <label className="block text-left">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                  Last Name
                </span>
                <input
                  type="text"
                  required
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
                />
              </label>
            </div>

            <label className="block text-left">
              <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                Email Address
              </span>
              <input
                type="email"
                required
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
              />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="block text-left">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                  System Role
                </span>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as any)}
                  className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
                >
                  <option value="agent">Agent</option>
                  <option value="admin">Administrator</option>
                </select>
              </label>

              <label className="block text-left">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                  Job Title
                </span>
                <input
                  type="text"
                  value={editJobTitle}
                  onChange={(e) => setEditJobTitle(e.target.value)}
                  placeholder="Senior Consultant"
                  className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
                />
              </label>
            </div>

            <div className="flex items-center justify-between p-4 border border-black/10 rounded-xl bg-surface/5 mt-4">
              <div>
                <span className="text-xs font-semibold block">Active Status</span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  Deactivated staff cannot sign in or receive automatic ticket dispatches.
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
              disabled={updateStaffMutation.isPending}
              className="w-full bg-brand-primary text-brand-secondary py-2.5 rounded-lg text-xs font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 mt-4"
            >
              {updateStaffMutation.isPending ? "Saving changes…" : "Save Changes"}
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
            Directory
          </span>
          <h1 className="font-serif text-5xl leading-tight mt-1 text-balance">
            Staff Directory
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-[65ch] leading-relaxed">
            Manage internal agents and administrators within this workspace. Edit roles, adjust job titles, and toggle account activation.
          </p>
        </div>

        <button
          onClick={() => setIsNewStaffModalOpen(true)}
          className="bg-brand-primary text-brand-secondary py-3 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all shrink-0 shadow-sm"
        >
          <Plus className="size-4" />
          + New Staff
        </button>
      </div>

      {/* Analytics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 border border-black/10 rounded-2xl overflow-hidden bg-surface/5 mb-10 shadow-sm">
        <div className="p-6 text-left border-b md:border-b-0 md:border-r border-black/10">
          <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-2">
            Total Staff
          </span>
          <span className="text-4xl font-serif font-medium">{totalStaff}</span>
        </div>
        
        <div className="p-6 text-left border-b md:border-b-0 md:border-r border-black/10">
          <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-2">
            Administrators
          </span>
          <span className="text-4xl font-serif font-medium">{totalAdmins}</span>
        </div>

        <div className="p-6 text-left">
          <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-2">
            Support Agents
          </span>
          <span className="text-4xl font-serif font-medium">{totalAgents}</span>
        </div>
      </div>

      {/* Filter and Search Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground/60" />
          <input
            type="text"
            placeholder="Search staff members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface ring-1 ring-black/10 rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
          />
        </div>
      </div>

      {/* Staff Data Table */}
      <div className="border border-black/10 rounded-2xl bg-canvas p-6 shadow-sm">
        {loadingStaff ? (
          <div className="text-xs text-muted-foreground py-10 text-center">Loading staff records…</div>
        ) : filteredStaff.length === 0 ? (
          <div className="text-xs text-muted-foreground py-12 text-center">
            No staff members found matching your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-black/5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 font-semibold">User</th>
                  <th className="py-3 font-semibold">Email</th>
                  <th className="py-3 font-semibold">Role</th>
                  <th className="py-3 font-semibold">Job Title</th>
                  <th className="py-3 font-semibold text-center">Teams Count</th>
                  <th className="py-3 font-semibold text-center">Status</th>
                  <th className="py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {filteredStaff.map((staff) => (
                  <tr
                    key={staff.id}
                    onClick={() => startEditing(staff)}
                    className="hover:bg-black/[0.01] cursor-pointer transition-colors group"
                  >
                    <td className="py-4 flex items-center gap-3">
                      <div className="size-8 rounded-full bg-surface border border-black/5 grid place-items-center font-mono text-[9px] font-bold text-muted-foreground">
                        {staff.initials}
                      </div>
                      <span className="font-semibold text-ink hover:underline">
                        {staff.firstName} {staff.lastName}
                      </span>
                    </td>
                    <td className="py-4 text-muted-foreground font-mono">{staff.email}</td>
                    <td className="py-4">
                      <span
                        className={`text-[9px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold ${
                          staff.role === "admin"
                            ? "bg-brand-primary text-brand-secondary"
                            : "bg-black/5 border border-black/10 text-ink"
                        }`}
                      >
                        {staff.role}
                      </span>
                    </td>
                    <td className="py-4">
                      {staff.jobTitle ? (
                        <span className="px-1.5 py-0.5 rounded bg-black/[0.03] text-[10px]">
                          {staff.jobTitle}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/45 italic">—</span>
                      )}
                    </td>
                    <td className="py-4 text-center font-mono text-muted-foreground">
                      {staff.teamCount}
                    </td>
                    <td className="py-4 text-center">
                      <span
                        className={`inline-block size-2 rounded-full ${
                          staff.isActive ? "bg-success" : "bg-danger"
                        }`}
                        title={staff.isActive ? "Active Account" : "Inactive Account"}
                      />
                    </td>
                    <td className="py-4 text-right">
                      <button className="p-1 rounded-md hover:bg-black/5 text-muted-foreground group-hover:text-ink transition-all">
                        <ArrowRight className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Staff Modal */}
      {isNewStaffModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-canvas border border-black/10 rounded-2xl w-full max-w-md p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setIsNewStaffModalOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-ink transition-colors"
            >
              <X className="size-4" />
            </button>
            
            <h2 className="text-lg font-serif mb-2">New Staff Member</h2>
            <p className="text-xs text-muted-foreground mb-6">
              Create credentials for a new agent or administrator in your support desk.
            </p>

            {createError && (
              <div className="mb-4 p-3 bg-danger/5 ring-1 ring-danger/15 rounded-lg text-xs text-danger flex items-start gap-2">
                <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateStaff} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <label className="block text-left">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                    First Name
                  </span>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="E.g. David"
                    className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
                  />
                </label>
                <label className="block text-left">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                    Last Name
                  </span>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="E.g. Miller"
                    className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
                  />
                </label>
              </div>

              <label className="block text-left">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                  Email Address
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="david.miller@company.com"
                  className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
                />
              </label>

              <label className="block text-left">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                  Temporary Password
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="block text-left">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                    System Role
                  </span>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
                  >
                    <option value="agent">Agent</option>
                    <option value="admin">Administrator</option>
                  </select>
                </label>

                <label className="block text-left">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                    Job Title
                  </span>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="E.g. Support Specialist"
                    className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={createStaffMutation.isPending}
                className="w-full bg-brand-primary text-brand-secondary py-2.5 rounded-lg text-xs font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 mt-2"
              >
                {createStaffMutation.isPending ? "Creating account…" : "Register Staff User"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
