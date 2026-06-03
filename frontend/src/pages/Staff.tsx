import { useState } from "react";
import { Plus, ArrowLeft, X, ShieldAlert, Search } from "lucide-react";
import {
  useStaffDirectory,
  useCreateStaff,
  useUpdateStaff,
  StaffForm,
  RoleGuard,
} from "@/features/tenant/users";

export default function Staff() {
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal control state
  const [isNewStaffModalOpen, setIsNewStaffModalOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  // Queries
  const { data: staffList = [], isLoading: loadingStaff } = useStaffDirectory();

  // Mutations
  const createStaffMutation = useCreateStaff();
  const updateStaffMutation = useUpdateStaff();

  const selectedStaff = staffList.find((s) => s.id === selectedStaffId);

  // Handlers
  const handleCreateStaffSubmit = (data: any) => {
    setCreateError(null);
    createStaffMutation.mutate(data, {
      onSuccess: () => {
        setIsNewStaffModalOpen(false);
      },
      onError: (err: any) => {
        setCreateError(err.message || "Failed to create staff member");
      },
    });
  };

  const handleUpdateStaffSubmit = (data: any) => {
    if (!selectedStaffId) return;
    setEditError(null);
    updateStaffMutation.mutate(
      {
        id: selectedStaffId,
        payload: data,
      },
      {
        onSuccess: () => {
          setSelectedStaffId(null);
        },
        onError: (err: any) => {
          setEditError(err.message || "Failed to update staff member details");
        },
      }
    );
  };

  // Searching & Stats
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

  if (selectedStaffId && selectedStaff) {
    return (
      <div className="w-full font-sans text-ink">
        {/* Detail Header */}
        <div className="mb-8">
          <button
            onClick={() => setSelectedStaffId(null)}
            className="flex items-center gap-2 text-xs font-semibold font-mono uppercase tracking-wider text-muted-foreground hover:text-ink transition-colors cursor-pointer text-left"
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
              <div className="size-12 rounded-full bg-black/10 grid place-items-center font-mono text-base font-semibold select-none">
                {selectedStaff.initials}
              </div>
              <div>
                <h1 className="font-serif text-3xl">{selectedStaff.firstName} {selectedStaff.lastName}</h1>
                <p className="text-xs text-muted-foreground font-mono mt-1 select-all">
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
              <span className="text-xs font-bold uppercase tracking-wider font-mono bg-brand-primary text-brand-secondary px-2.5 py-0.5 rounded-full inline-block mt-1 select-none">
                {selectedStaff.role}
              </span>
            </div>
            <div>
              <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block">
                Team Memberships
              </span>
              <span className="text-xs font-semibold block mt-2 select-none">
                Assigned to {selectedStaff.teamCount} support groups
              </span>
            </div>
          </div>
        </div>

        {/* Edit Form Card */}
        <div className="border border-black/10 rounded-2xl bg-canvas p-6 shadow-sm max-w-xl">
          <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-muted-foreground mb-6 select-none">
            Edit Staff Profile & Access Controls
          </h2>

          {editError && (
            <div className="mb-6 p-3 bg-danger/5 ring-1 ring-danger/15 rounded-lg text-xs text-danger flex items-start gap-2">
              <ShieldAlert className="size-4 shrink-0 mt-0.5" />
              <span>{editError}</span>
            </div>
          )}

          <StaffForm
            isEdit={true}
            initialValues={selectedStaff}
            onSubmit={handleUpdateStaffSubmit}
            isLoading={updateStaffMutation.isPending}
            onCancel={() => setSelectedStaffId(null)}
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
            Directory
          </span>
          <h1 className="font-serif text-5xl leading-tight mt-1 text-balance">
            Staff Directory
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-[65ch] leading-relaxed">
            Manage internal agents and administrators within this workspace. Edit roles, adjust job titles, and toggle account activation.
          </p>
        </div>

        <RoleGuard allowedRoles={["admin"]}>
          <button
            onClick={() => setIsNewStaffModalOpen(true)}
            className="bg-brand-primary text-brand-secondary py-3 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all shrink-0 shadow-sm cursor-pointer"
          >
            <Plus className="size-4" />
            + New Staff
          </button>
        </RoleGuard>
      </div>

      {/* Analytics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 border border-black/10 rounded-2xl overflow-hidden bg-surface/5 mb-10 shadow-sm select-none">
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
          <div className="text-xs text-muted-foreground py-10 text-center select-none">
            Loading staff directory…
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="text-xs text-muted-foreground py-12 text-center border border-dashed border-black/10 rounded-xl bg-surface/30 select-none">
            No staff records found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-black/5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground select-none">
                  <th className="py-3 font-semibold">Staff Member</th>
                  <th className="py-3 font-semibold">Email</th>
                  <th className="py-3 font-semibold">Job Title</th>
                  <th className="py-3 font-semibold">Role</th>
                  <th className="py-3 font-semibold">Status</th>
                  <th className="py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {filteredStaff.map((staff) => (
                  <tr key={staff.id} className="hover:bg-black/[0.01]">
                    <td className="py-4 flex items-center gap-3">
                      <div className="size-8 rounded-full bg-surface border border-black/5 grid place-items-center font-mono text-[9px] font-semibold text-muted-foreground relative select-none">
                        {staff.initials}
                      </div>
                      <div>
                        <span className="font-semibold text-ink block">
                          {staff.firstName} {staff.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 text-muted-foreground font-mono select-all">
                      {staff.email}
                    </td>
                    <td className="py-4 select-none">
                      {staff.jobTitle ? (
                        <span className="px-1.5 py-0.5 rounded bg-black/[0.03] text-[10px]">
                          {staff.jobTitle}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/45 italic">—</span>
                      )}
                    </td>
                    <td className="py-4 select-none">
                      <span className="text-[9px] font-mono uppercase tracking-wider bg-black/5 text-muted-foreground px-1.5 py-0.5 rounded">
                        {staff.role}
                      </span>
                    </td>
                    <td className="py-4 select-none">
                      <span
                        className={`text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          staff.isActive
                            ? "bg-success/10 text-success"
                            : "bg-danger/10 text-danger"
                        }`}
                      >
                        {staff.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      <RoleGuard allowedRoles={["admin"]}>
                        <button
                          onClick={() => setSelectedStaffId(staff.id)}
                          className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-ink cursor-pointer border border-black/10 rounded px-2.5 py-1 hover:border-black/35 transition-all"
                        >
                          Manage
                        </button>
                      </RoleGuard>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Register Staff Dialog */}
      {isNewStaffModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-canvas border border-black/10 rounded-2xl w-full max-w-md p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setIsNewStaffModalOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-ink transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>

            <h2 className="text-lg font-serif mb-2 select-none">Register New Staff</h2>
            <p className="text-xs text-muted-foreground mb-6 select-none">
              Add a new agent or administrator to support operations.
            </p>

            {createError && (
              <div className="mb-4 p-3 bg-danger/5 ring-1 ring-danger/15 rounded-lg text-xs text-danger flex items-start gap-2">
                <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                <span>{createError}</span>
              </div>
            )}

            <StaffForm
              isEdit={false}
              onSubmit={handleCreateStaffSubmit}
              isLoading={createStaffMutation.isPending}
              onCancel={() => setIsNewStaffModalOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
