import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiBase } from "../utils/api";
import { 
  Building, Users, Ticket, Plus, Search, Settings, ShieldAlert, Check, 
  ArrowLeft, Edit, ShieldCheck, Mail, Slack, ToggleLeft, ToggleRight
} from "lucide-react";

const API_BASE = getApiBase();

type Organization = {
  id: string;
  name: string;
  subdomain: string;
  subscriptionTier: string;
  isActive: boolean;
  userCount: number;
  ticketCount: number;
  createdAt: string;
  updatedAt: string;
};

export default function SuperAdmin() {
  const queryClient = useQueryClient();
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

  // =========================================================================
  // 1. Data Fetching Queries
  // =========================================================================

  // Fetch all organizations in the platform
  const { data: orgsList = [], isLoading: loadingOrgs } = useQuery<Organization[]>({
    queryKey: ["superadmin_organizations"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/superadmin/organizations`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch organizations");
      return res.json();
    },
  });

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

  // =========================================================================
  // 2. Mutations
  // =========================================================================

  // Create Organization mutation
  const createOrgMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`${API_BASE}/superadmin/organizations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create organization");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin_organizations"] });
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
      setCreateError(err.message);
    },
  });

  // Edit Organization mutation
  const editOrgMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await fetch(`${API_BASE}/superadmin/organizations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update organization");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin_organizations"] });
      setEditError(null);
      setIsEditModalOpen(false);
      setEditingOrg(null);
    },
    onError: (err: any) => {
      setEditError(err.message);
    },
  });

  // Toggle Organization status direct
  const toggleOrgStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`${API_BASE}/superadmin/organizations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to toggle organization status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin_organizations"] });
    },
  });

  // =========================================================================
  // 3. Form Submission Handlers
  // =========================================================================

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

        <div className="mb-8">
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

        <ScopedNotificationSettings orgId={selectedOrgId} />
      </div>
    );
  }

  return (
    <div className="w-full px-6 md:px-12 py-12 font-sans text-ink max-w-6xl mx-auto">
      
      {/* Title Header */}
      <div className="mb-10 flex items-start justify-between">
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
        <div className="border border-black/10 rounded-2xl overflow-hidden bg-canvas">
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
            <tbody className="divide-y divide-black/5">
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
                          toggleOrgStatusMutation.mutate({ id: org.id, isActive: !org.isActive });
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
          <div className="bg-canvas border border-black/10 rounded-2xl w-full max-w-lg p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-ink transition-colors cursor-pointer"
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
          <div className="bg-canvas border border-black/10 rounded-2xl w-full max-w-md p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => {
                setIsEditModalOpen(false);
                setEditingOrg(null);
              }}
              className="absolute top-4 right-4 text-muted-foreground hover:text-ink transition-colors cursor-pointer"
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
                  <span className="text-xs font-semibold block">Workspace Active Status</span>
                  <span className="text-[10px] text-muted-foreground block">Suspended organizations block user logins immediately.</span>
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

// Scoped Notification Settings Sub-Component
function ScopedNotificationSettings({ orgId }: { orgId: string }) {
  const queryClient = useQueryClient();

  // Notification settings states
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpFromEmail, setSmtpFromEmail] = useState("");

  const [slackEnabled, setSlackEnabled] = useState(true);
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");

  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [whatsappApiToken, setWhatsappApiToken] = useState("");
  const [whatsappPhoneId, setWhatsappPhoneId] = useState("");

  const [inAppEnabled, setInAppEnabled] = useState(true);

  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Fetch settings for this specific Org
  const { data: notificationSettings = [], isLoading } = useQuery<any[]>({
    queryKey: ["superadmin_org_notifications", orgId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/superadmin/organizations/${orgId}/notifications`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Sync state when DB values fetch
  useEffect(() => {
    if (notificationSettings.length > 0) {
      const email = notificationSettings.find((s) => s.channel === "email");
      if (email) {
        setEmailEnabled(email.enabled);
        setSmtpHost(email.config?.host || "");
        setSmtpPort(String(email.config?.port || "587"));
        setSmtpUser(email.config?.user || "");
        setSmtpPassword(email.config?.password || "");
        setSmtpSecure(!!email.config?.secure);
        setSmtpFromEmail(email.config?.fromEmail || "");
      }

      const slack = notificationSettings.find((s) => s.channel === "slack");
      if (slack) {
        setSlackEnabled(slack.enabled);
        setSlackWebhookUrl(slack.config?.webhookUrl || "");
      }

      const whatsapp = notificationSettings.find((s) => s.channel === "whatsapp");
      if (whatsapp) {
        setWhatsappEnabled(whatsapp.enabled);
        setWhatsappApiToken(whatsapp.config?.apiToken || "");
        setWhatsappPhoneId(whatsapp.config?.phoneId || "");
      }

      const inApp = notificationSettings.find((s) => s.channel === "in_app");
      if (inApp) {
        setInAppEnabled(inApp.enabled);
      }
    }
  }, [notificationSettings]);

  // Mutation to update notification channel configurations
  const updateSettingsMutation = useMutation({
    mutationFn: async (payload: { channel: string; enabled: boolean; config: any }) => {
      const res = await fetch(`${API_BASE}/superadmin/organizations/${orgId}/notifications`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update channel settings");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin_org_notifications", orgId] });
    },
  });

  if (isLoading) {
    return (
      <div className="text-xs text-muted-foreground py-10 text-center font-mono">
        Retrieving organization settings…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {saveSuccess && (
        <div className="p-3 bg-success/5 ring-1 ring-success/15 rounded-lg text-xs text-success flex items-start gap-2">
          <ShieldCheck className="size-4 shrink-0 mt-0.5" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {saveError && (
        <div className="p-3 bg-danger/5 ring-1 ring-danger/15 rounded-lg text-xs text-danger flex items-start gap-2">
          <ShieldAlert className="size-4 shrink-0 mt-0.5" />
          <span>{saveError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* SMTP Configuration */}
        <div className="border border-black/10 rounded-xl p-5 bg-surface/5 flex flex-col justify-between text-left">
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-black/5">
              <span className="text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Mail className="size-4 text-muted-foreground" />
                Email Settings (SMTP)
              </span>
              <button
                type="button"
                onClick={() => {
                  const newEnabled = !emailEnabled;
                  setEmailEnabled(newEnabled);
                  updateSettingsMutation.mutate({
                    channel: "email",
                    enabled: newEnabled,
                    config: {
                      host: smtpHost,
                      port: Number(smtpPort),
                      user: smtpUser,
                      password: smtpPassword,
                      secure: smtpSecure,
                      fromEmail: smtpFromEmail
                    }
                  });
                }}
                className="focus:outline-none transition-all cursor-pointer"
              >
                {emailEnabled ? (
                  <ToggleRight className="size-5 text-success" />
                ) : (
                  <ToggleLeft className="size-5 text-muted-foreground" />
                )}
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <label className="col-span-2 block">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-0.5">SMTP Host</span>
                  <input
                    type="text"
                    placeholder="smtp.mailtrap.io"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    className="w-full bg-canvas ring-1 ring-black/10 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-black/20 transition-all font-mono"
                  />
                </label>
                <label className="col-span-1 block">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-0.5">SMTP Port</span>
                  <input
                    type="text"
                    placeholder="587"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    className="w-full bg-canvas ring-1 ring-black/10 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-black/20 transition-all font-mono"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-0.5">SMTP User</span>
                  <input
                    type="text"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    className="w-full bg-canvas ring-1 ring-black/10 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-black/20 transition-all font-mono"
                  />
                </label>
                <label className="block">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-0.5">SMTP Password</span>
                  <input
                    type="password"
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                    className="w-full bg-canvas ring-1 ring-black/10 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-black/20 transition-all font-mono"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="block text-left">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-0.5">From Email</span>
                  <input
                    type="email"
                    placeholder="support@company.com"
                    value={smtpFromEmail}
                    onChange={(e) => setSmtpFromEmail(e.target.value)}
                    className="w-40 bg-canvas ring-1 ring-black/10 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-black/20 transition-all font-mono"
                  />
                </label>
                <label className="flex items-center gap-2 mt-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smtpSecure}
                    onChange={(e) => setSmtpSecure(e.target.checked)}
                    className="rounded border-black/10 text-ink focus:ring-black"
                  />
                  <span className="text-[9px] text-muted-foreground uppercase font-mono tracking-wider">Use SSL/TLS</span>
                </label>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              updateSettingsMutation.mutate({
                channel: "email",
                enabled: emailEnabled,
                config: {
                  host: smtpHost,
                  port: Number(smtpPort),
                  user: smtpUser,
                  password: smtpPassword,
                  secure: smtpSecure,
                  fromEmail: smtpFromEmail
                }
              }, {
                onSuccess: () => {
                  setSaveSuccess("SMTP Credentials updated successfully.");
                  setTimeout(() => setSaveSuccess(null), 3000);
                },
                onError: (err: any) => {
                  setSaveError(err.message || "Failed to update SMTP settings.");
                  setTimeout(() => setSaveError(null), 3000);
                }
              });
            }}
            className="mt-4 w-full bg-ink text-canvas py-2 rounded text-xs font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            Save SMTP Credentials
          </button>
        </div>

        {/* Slack Configuration */}
        <div className="border border-black/10 rounded-xl p-5 bg-surface/5 flex flex-col justify-between text-left">
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-black/5">
              <span className="text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Slack className="size-4 text-muted-foreground" />
                Slack Channel Webhook
              </span>
              <button
                type="button"
                onClick={() => {
                  const newEnabled = !slackEnabled;
                  setSlackEnabled(newEnabled);
                  updateSettingsMutation.mutate({
                    channel: "slack",
                    enabled: newEnabled,
                    config: { webhookUrl: slackWebhookUrl }
                  });
                }}
                className="focus:outline-none transition-all cursor-pointer"
              >
                {slackEnabled ? (
                  <ToggleRight className="size-5 text-success" />
                ) : (
                  <ToggleLeft className="size-5 text-muted-foreground" />
                )}
              </button>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-0.5">Webhook URL</span>
                <input
                  type="url"
                  placeholder="https://hooks.slack.com/services/..."
                  value={slackWebhookUrl}
                  onChange={(e) => setSlackWebhookUrl(e.target.value)}
                  className="w-full bg-canvas ring-1 ring-black/10 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-black/20 transition-all font-mono"
                />
              </label>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              updateSettingsMutation.mutate({
                channel: "slack",
                enabled: slackEnabled,
                config: { webhookUrl: slackWebhookUrl }
              }, {
                onSuccess: () => {
                  setSaveSuccess("Slack Webhook configuration saved.");
                  setTimeout(() => setSaveSuccess(null), 3000);
                },
                onError: (err: any) => {
                  setSaveError(err.message || "Failed to save Slack Webhook.");
                  setTimeout(() => setSaveError(null), 3000);
                }
              });
            }}
            className="mt-4 w-full bg-ink text-canvas py-2 rounded text-xs font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            Save Slack Webhook
          </button>
        </div>

        {/* WhatsApp Config */}
        <div className="border border-black/10 rounded-xl p-5 bg-surface/5 flex flex-col justify-between text-left">
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-black/5">
              <span className="text-xs font-bold uppercase tracking-wider font-mono">
                WhatsApp API Gateway
              </span>
              <button
                type="button"
                onClick={() => {
                  const newEnabled = !whatsappEnabled;
                  setWhatsappEnabled(newEnabled);
                  updateSettingsMutation.mutate({
                    channel: "whatsapp",
                    enabled: newEnabled,
                    config: { apiToken: whatsappApiToken, phoneId: whatsappPhoneId }
                  });
                }}
                className="focus:outline-none transition-all cursor-pointer"
              >
                {whatsappEnabled ? (
                  <ToggleRight className="size-5 text-success" />
                ) : (
                  <ToggleLeft className="size-5 text-muted-foreground" />
                )}
              </button>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-0.5">Meta API Token</span>
                <input
                  type="password"
                  placeholder="Meta system user access token"
                  value={whatsappApiToken}
                  onChange={(e) => setWhatsappApiToken(e.target.value)}
                  className="w-full bg-canvas ring-1 ring-black/10 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-black/20 transition-all font-mono"
                />
              </label>
              <label className="block">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-0.5">Phone Number ID</span>
                <input
                  type="text"
                  placeholder="Meta phone id"
                  value={whatsappPhoneId}
                  onChange={(e) => setWhatsappPhoneId(e.target.value)}
                  className="w-full bg-canvas ring-1 ring-black/10 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-black/20 transition-all font-mono"
                />
              </label>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              updateSettingsMutation.mutate({
                channel: "whatsapp",
                enabled: whatsappEnabled,
                config: { apiToken: whatsappApiToken, phoneId: whatsappPhoneId }
              }, {
                onSuccess: () => {
                  setSaveSuccess("WhatsApp Meta credentials updated.");
                  setTimeout(() => setSaveSuccess(null), 3000);
                },
                onError: (err: any) => {
                  setSaveError(err.message || "Failed to update WhatsApp settings.");
                  setTimeout(() => setSaveError(null), 3000);
                }
              });
            }}
            className="mt-4 w-full bg-ink text-canvas py-2 rounded text-xs font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            Save WhatsApp Credentials
          </button>
        </div>

        {/* In-App Native Config */}
        <div className="border border-black/10 rounded-xl p-5 bg-surface/5 flex flex-col justify-between text-left">
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-black/5">
              <span className="text-xs font-bold uppercase tracking-wider font-mono">
                In-App Native Feed
              </span>
              <button
                type="button"
                onClick={() => {
                  const newEnabled = !inAppEnabled;
                  setInAppEnabled(newEnabled);
                  updateSettingsMutation.mutate({
                    channel: "in_app",
                    enabled: newEnabled,
                    config: {}
                  });
                }}
                className="focus:outline-none transition-all cursor-pointer"
              >
                {inAppEnabled ? (
                  <ToggleRight className="size-5 text-success" />
                ) : (
                  <ToggleLeft className="size-5 text-muted-foreground" />
                )}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Enables staff and clients to receive dynamic alerts inside the system navigation header bell timeline drawer. Runs natively.
            </p>
          </div>
          <div className="mt-8 text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-center">
            System Native Channel
          </div>
        </div>
      </div>
    </div>
  );
}
