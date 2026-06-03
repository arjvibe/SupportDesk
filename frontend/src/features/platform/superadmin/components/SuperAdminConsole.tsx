import { useState } from "react";
import {
  Building,
  Users,
  Ticket,
  Plus,
  Search,
  Settings,
  ShieldAlert,
  Check,
  ArrowLeft,
  Edit,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import {
  useOrganizations,
  useCreateOrganization,
  useUpdateOrganization,
} from "../hooks/useSuperAdmin";
import { ScopedNotificationSettings } from "./ScopedNotificationSettings";
import { Organization } from "../types";

export function SuperAdminConsole() {
  const [searchTerm, setSearchTerm] = useState("");
  
  // UI views state
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedOrgName, setSelectedOrgName] = useState<string>("");
  
  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);

  // Form states - Create Organization
  const [newName, setNewName] = useState("");
  const [newSubdomain, setNewSubdomain] = useState("");
  const [newTier, setNewTier] = useState("trial");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState(false);

  // Form states - Edit Organization
  const [editName, setEditName] = useState("");
  const [editSubdomain, setEditSubdomain] = useState("");
  const [editTier, setEditTier] = useState("trial");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);

  // Queries
  const { data: orgsList = [], isLoading: loadingOrgs } = useOrganizations();

  // Mutations
  const createOrgMutation = useCreateOrganization();
  const editOrgMutation = useUpdateOrganization();

  // Filter organizations by search term
  const filteredOrgs = orgsList.filter(
    (org) =>
      org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      org.subdomain.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Platform stats computed from active listings
  const totalOrgs = orgsList.length;
  const activeOrgs = orgsList.filter((o) => o.isActive).length;
  const suspendedOrgs = totalOrgs - activeOrgs;
  const totalUsers = orgsList.reduce((sum, o) => sum + o.userCount, 0);
  const totalTickets = orgsList.reduce((sum, o) => sum + o.ticketCount, 0);

  const handleCreateOrgSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    createOrgMutation.mutate({
      name: newName,
      subdomain: newSubdomain,
      subscriptionTier: newTier,
      adminEmail: adminEmail || undefined,
      adminPassword: adminPassword || undefined,
      adminFirstName: adminFirstName || undefined,
      adminLastName: adminLastName || undefined,
    }, {
      onSuccess: () => {
        setNewName("");
        setNewSubdomain("");
        setNewTier("trial");
        setAdminEmail("");
        setAdminPassword("");
        setAdminFirstName("");
        setAdminLastName("");
        setCreateError(null);
        setCreateSuccess(true);
        setTimeout(() => {
          setCreateSuccess(false);
          setIsCreateModalOpen(false);
        }, 2000);
      },
      onError: (err: any) => {
        setCreateError(err.message || "Failed to create organization");
      }
    });
  };

  const handleEditOrgSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrg) return;
    setEditError(null);
    editOrgMutation.mutate({
      id: editingOrg.id,
      payload: {
        name: editName,
        subdomain: editSubdomain,
        subscriptionTier: editTier,
        isActive: editIsActive,
      },
    }, {
      onSuccess: () => {
        setEditError(null);
        setIsEditModalOpen(false);
        setEditingOrg(null);
      },
      onError: (err: any) => {
        setEditError(err.message || "Failed to update organization");
      }
    });
  };

  const openEditModal = (org: Organization) => {
    setEditingOrg(org);
    setEditName(org.name);
    setEditSubdomain(org.subdomain);
    setEditTier(org.subscriptionTier);
    setEditIsActive(org.isActive);
    setIsEditModalOpen(true);
  };

  if (selectedOrgId) {
    return (
      <div className="w-full px-6 md:px-12 py-12 font-sans text-ink max-w-6xl mx-auto">
        <button
          onClick={() => {
            setSelectedOrgId(null);
            setSelectedOrgName("");
          }}
          className="mb-6 flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-ink transition-colors cursor-pointer"
        >
          <ArrowLeft className="size-3.5" />
          Back to Workspaces
        </button>

        <div className="mb-8 flex flex-col xl:flex-row xl:items-end justify-between gap-6">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Platform Configuration Scopes
            </span>
            <h1 className="font-serif text-3xl leading-tight mt-1 text-balance">
              Notification Settings for {selectedOrgName}
            </h1>
            <p className="text-xs text-muted-foreground mt-2 max-w-[65ch] leading-relaxed">
              Configure SMTP hosts, webhook hooks, WhatsApp Meta settings on behalf of this workspace.
            </p>
          </div>
        </div>

        <ScopedNotificationSettings orgId={selectedOrgId} />
      </div>
    );
  }

  return (
    <div className="w-full px-6 md:px-12 py-12 font-sans text-ink max-w-6xl mx-auto">
      
      {/* Title Header */}
      <div className="mb-10 flex flex-col md:flex-row md:items-start md:justify-between gap-6">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Global Administration Hub
          </span>
          <h1 className="font-serif text-5xl leading-tight mt-1 text-balance">
            Aura Tenant Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-[65ch] leading-relaxed">
            Review active multi-tenant workspaces, manage subscriptions, enable or suspend domains, and modify credentials.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-ink text-canvas py-3 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all shrink-0 shadow-sm cursor-pointer"
        >
          <Plus className="size-4" />
          Create Organization
        </button>
      </div>

      {/* Stats Board */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-10">
        <div className="border border-black/10 rounded-2xl p-5 bg-surface/5 text-left">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Total Orgs</span>
            <Building className="size-4 text-muted-foreground" />
          </div>
          <span className="text-3xl font-serif font-bold">{totalOrgs}</span>
        </div>

        <div className="border border-black/10 rounded-2xl p-5 bg-surface/5 text-left">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Active</span>
            <Check className="size-4 text-success" />
          </div>
          <span className="text-3xl font-serif font-bold text-success">{activeOrgs}</span>
        </div>

        <div className="border border-black/10 rounded-2xl p-5 bg-surface/5 text-left">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Suspended</span>
            <ShieldAlert className="size-4 text-danger" />
          </div>
          <span className="text-3xl font-serif font-bold text-danger">{suspendedOrgs}</span>
        </div>

        <div className="border border-black/10 rounded-2xl p-5 bg-surface/5 text-left">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Total Users</span>
            <Users className="size-4 text-muted-foreground" />
          </div>
          <span className="text-3xl font-serif font-bold">{totalUsers}</span>
        </div>

        <div className="border border-black/10 rounded-2xl p-5 bg-surface/5 text-left col-span-2 md:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Total Tickets</span>
            <Ticket className="size-4 text-muted-foreground" />
          </div>
          <span className="text-3xl font-serif font-bold">{totalTickets}</span>
        </div>
      </div>

      {/* Search & Actions Bar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex-1 max-w-sm relative">
          <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search workspaces by name or subdomain…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface/10 ring-1 ring-black/10 rounded-lg pl-9 pr-4 py-2.5 text-xs focus:outline-none focus:ring-black/20 transition-all"
          />
        </div>
      </div>

      {/* Organizations Directory Table */}
      {loadingOrgs ? (
        <div className="text-xs text-muted-foreground py-12 text-center font-mono">
          Loading platform workspaces…
        </div>
      ) : (
        <div className="border border-black/10 rounded-2xl overflow-hidden bg-canvas shadow-sm">
          <table className="w-full text-left border-collapse font-sans text-xs">
            <thead>
              <tr className="border-b border-black/10 bg-black/[0.02]">
                <th className="p-4 font-mono font-bold uppercase tracking-wider text-muted-foreground text-[10px]">Workspace Name</th>
                <th className="p-4 font-mono font-bold uppercase tracking-wider text-muted-foreground text-[10px]">Subdomain</th>
                <th className="p-4 font-mono font-bold uppercase tracking-wider text-muted-foreground text-[10px]">Subscription Tier</th>
                <th className="p-4 font-mono font-bold uppercase tracking-wider text-muted-foreground text-[10px] text-center">Users</th>
                <th className="p-4 font-mono font-bold uppercase tracking-wider text-muted-foreground text-[10px] text-center">Tickets</th>
                <th className="p-4 font-mono font-bold uppercase tracking-wider text-muted-foreground text-[10px] text-center">Status</th>
                <th className="p-4 font-mono font-bold uppercase tracking-wider text-muted-foreground text-[10px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 bg-canvas">
              {filteredOrgs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No workspaces found.
                  </td>
                </tr>
              ) : (
                filteredOrgs.map((org) => (
                  <tr key={org.id} className="hover:bg-black/[0.01] transition-colors">
                    <td className="p-4 font-semibold text-ink">{org.name}</td>
                    <td className="p-4 font-mono text-muted-foreground">{org.subdomain}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono uppercase font-bold ${
                        org.subscriptionTier === "enterprise"
                          ? "bg-black text-canvas"
                          : org.subscriptionTier === "business"
                          ? "bg-black/10 text-ink"
                          : "bg-black/5 text-muted-foreground"
                      }`}>
                        {org.subscriptionTier}
                      </span>
                    </td>
                    <td className="p-4 text-center font-mono">{org.userCount}</td>
                    <td className="p-4 text-center font-mono">{org.ticketCount}</td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => {
                          if (org.subdomain === "superadmin") return; // Safeguard superadmin
                          editOrgMutation.mutate({ id: org.id, payload: { isActive: !org.isActive } });
                        }}
                        disabled={org.subdomain === "superadmin"}
                        className={`inline-flex items-center gap-1.5 focus:outline-none transition-all ${
                          org.subdomain === "superadmin" ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:opacity-80"
                        }`}
                      >
                        {org.isActive ? (
                          <span className="inline-flex items-center gap-1 text-success text-[10px] font-semibold">
                            <ToggleRight className="size-4 shrink-0 text-success" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-danger text-[10px] font-semibold">
                            <ToggleLeft className="size-4 shrink-0 text-muted-foreground" /> Suspended
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => openEditModal(org)}
                        className="p-1.5 border border-black/10 rounded hover:bg-black/5 hover:border-black/20 text-muted-foreground hover:text-ink transition-all cursor-pointer inline-flex items-center gap-1 text-[11px]"
                        title="Edit Workspace Details"
                      >
                        <Edit className="size-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setSelectedOrgId(org.id);
                          setSelectedOrgName(org.name);
                        }}
                        className="p-1.5 border border-black/10 rounded hover:bg-black/5 hover:border-black/20 text-muted-foreground hover:text-ink transition-all cursor-pointer inline-flex items-center gap-1 text-[11px]"
                        title="Configure Outbound Channels"
                      >
                        <Settings className="size-3.5" />
                        Notifications
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE WORKSPACE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-canvas border border-black/10 rounded-2xl w-full max-w-lg p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto text-left">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-ink transition-colors cursor-pointer text-xs uppercase tracking-wider font-mono font-semibold"
            >
              Close
            </button>
            <h2 className="text-xl font-serif mb-2">Create New Tenant Workspace</h2>
            <p className="text-xs text-muted-foreground mb-6">
              Initializes database tables, standard SLA targets, notification queue entries, and the workspace owner user.
            </p>

            {createError && (
              <div className="mb-4 p-3 bg-danger/5 ring-1 ring-danger/15 rounded-lg text-xs text-danger flex items-start gap-2">
                <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                <span>{createError}</span>
              </div>
            )}

            {createSuccess && (
              <div className="mb-4 p-3 bg-success/5 ring-1 ring-success/15 rounded-lg text-xs text-success flex items-start gap-2">
                <ShieldCheck className="size-4 shrink-0 mt-0.5" />
                <span>Workspace initialized successfully! Closing dialog…</span>
              </div>
            )}

            <form onSubmit={handleCreateOrgSubmit} className="space-y-5">
              {/* Org Details */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground pb-1 border-b border-black/5">Workspace Information</h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-left">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">Company Name</span>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Heliotrope Tech"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
                    />
                  </label>
                  <label className="block text-left">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">Subdomain Name</span>
                    <div className="flex items-center bg-surface ring-1 ring-black/10 rounded-md overflow-hidden focus-within:ring-black/20 transition-all">
                      <input
                        type="text"
                        required
                        placeholder="e.g. heliotrope"
                        value={newSubdomain}
                        onChange={(e) => setNewSubdomain(e.target.value)}
                        className="flex-1 bg-transparent px-3 py-2 text-xs focus:outline-none font-mono"
                      />
                      <span className="bg-black/5 px-2.5 py-2 text-[10px] text-muted-foreground font-mono border-l border-black/10">.localhost</span>
                    </div>
                  </label>
                </div>

                <label className="block text-left">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">SaaS Subscription Tier</span>
                  <select
                    value={newTier}
                    onChange={(e) => setNewTier(e.target.value)}
                    className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
                  >
                    <option value="trial">Trial (Basic limits)</option>
                    <option value="business">Business (Standard features)</option>
                    <option value="enterprise">Enterprise (Fully scalable SLAs)</option>
                  </select>
                </label>
              </div>

              {/* Admin Owner details */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground pb-1 border-b border-black/5">Initial Administrator Owner</h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-left">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">First Name</span>
                    <input
                      type="text"
                      placeholder="e.g. Jane"
                      value={adminFirstName}
                      onChange={(e) => setAdminFirstName(e.target.value)}
                      className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
                    />
                  </label>
                  <label className="block text-left">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">Last Name</span>
                    <input
                      type="text"
                      placeholder="e.g. Doe"
                      value={adminLastName}
                      onChange={(e) => setAdminLastName(e.target.value)}
                      className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-left">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">Admin Email Address</span>
                    <input
                      type="email"
                      placeholder="e.g. admin@heliotrope.com"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
                    />
                  </label>
                  <label className="block text-left">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">Sign-in Password</span>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
                    />
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={createOrgMutation.isPending}
                className="w-full bg-ink text-canvas py-2.5 rounded-lg text-xs font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 mt-2 cursor-pointer"
              >
                {createOrgMutation.isPending ? "Initializing Workspace…" : "Create & Initialize Workspace"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT WORKSPACE MODAL */}
      {isEditModalOpen && editingOrg && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-canvas border border-black/10 rounded-2xl w-full max-w-md p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150 text-left">
            <button
              onClick={() => {
                setIsEditModalOpen(false);
                setEditingOrg(null);
              }}
              className="absolute top-4 right-4 text-muted-foreground hover:text-ink transition-colors cursor-pointer text-xs uppercase tracking-wider font-mono font-semibold"
            >
              Close
            </button>
            <h2 className="text-xl font-serif mb-2">Edit Workspace Details</h2>
            <p className="text-xs text-muted-foreground mb-6">
              Modify subscription mappings and active suspend states.
            </p>

            {editError && (
              <div className="mb-4 p-3 bg-danger/5 ring-1 ring-danger/15 rounded-lg text-xs text-danger flex items-start gap-2">
                <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleEditOrgSubmit} className="space-y-4">
              <label className="block text-left">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">Company Name</span>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
                />
              </label>

              <label className="block text-left">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">Subdomain Name</span>
                <input
                  type="text"
                  required
                  value={editSubdomain}
                  onChange={(e) => setEditSubdomain(e.target.value)}
                  className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all font-mono"
                  disabled={editingOrg.subdomain === "superadmin"} // Disable changing superadmin subdomain
                />
              </label>

              <label className="block text-left">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">SaaS Subscription Tier</span>
                <select
                  value={editTier}
                  onChange={(e) => setEditTier(e.target.value)}
                  className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
                  disabled={editingOrg.subdomain === "superadmin"}
                >
                  <option value="trial">Trial</option>
                  <option value="business">Business</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </label>

              <div className="flex items-center justify-between p-3 border border-black/5 rounded-lg bg-surface/5">
                <div>
                  <span className="text-xs font-semibold block text-left">Workspace Active Status</span>
                  <span className="text-[10px] text-muted-foreground block text-left">Suspended organizations block user logins immediately.</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (editingOrg.subdomain === "superadmin") return;
                    setEditIsActive(!editIsActive);
                  }}
                  disabled={editingOrg.subdomain === "superadmin"}
                  className={`focus:outline-none transition-all ${
                    editingOrg.subdomain === "superadmin" ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:opacity-80"
                  }`}
                >
                  {editIsActive ? (
                    <ToggleRight className="size-6 text-success" />
                  ) : (
                    <ToggleLeft className="size-6 text-muted-foreground" />
                  )}
                </button>
              </div>

              <button
                type="submit"
                disabled={editOrgMutation.isPending}
                className="w-full bg-ink text-canvas py-2.5 rounded-lg text-xs font-semibold hover:opacity-90 active:scale-95 transition-all mt-2 cursor-pointer"
              >
                {editOrgMutation.isPending ? "Saving Changes…" : "Save Workspace Details"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
