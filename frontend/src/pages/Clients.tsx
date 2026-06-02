import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiBase } from "../utils/api";
import { Plus, ArrowRight, ArrowLeft, Search, X, ShieldAlert } from "lucide-react";

type ClientOwner = {
  id: string;
  firstName: string;
  lastName: string;
  initials: string;
};

type ClientAccount = {
  id: string;
  name: string;
  domain: string | null;
  clientTier: "trial" | "business" | "enterprise";
  createdAt: string;
  owner: ClientOwner | null;
  userCount: number;
  ticketCount: number;
};

type ClientContact = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  jobTitle: string | null;
  initials: string;
  isActive: boolean;
};

type StaffMember = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  initials: string;
};

const API_BASE = getApiBase();

export default function Clients() {
  const queryClient = useQueryClient();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTier, setFilterTier] = useState<"all" | "active" | "trial" | "enterprise">("all");

  // Modal Control States
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);

  // Form states for creating a Client
  const [newClientName, setNewClientName] = useState("");
  const [newClientDomain, setNewClientDomain] = useState("");
  const [newClientTier, setNewClientTier] = useState<"trial" | "business" | "enterprise">("trial");
  const [newClientOwnerId, setNewClientOwnerId] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);

  // Form states for adding a user to a Client
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userFirstName, setUserFirstName] = useState("");
  const [userLastName, setUserLastName] = useState("");
  const [userJobTitle, setUserJobTitle] = useState("");
  const [userError, setUserError] = useState<string | null>(null);

  // =========================================================================
  // 1. Fetch data
  // =========================================================================
  
  // Fetch clients scoped to active Org
  const { data: clientsList = [], isLoading: loadingClients } = useQuery<ClientAccount[]>({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/clients`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
  });

  // Fetch available Org staff (for account manager assignment)
  const { data: staffList = [] } = useQuery<StaffMember[]>({
    queryKey: ["staff"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/clients/staff/list`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch users for selected client
  const { data: clientUsers = [], isLoading: loadingUsers } = useQuery<ClientContact[]>({
    queryKey: ["clients", selectedClientId, "users"],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const res = await fetch(`${API_BASE}/clients/${selectedClientId}/users`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch client contacts");
      return res.json();
    },
    enabled: !!selectedClientId,
  });

  // =========================================================================
  // 2. Mutations
  // =========================================================================

  /**
   * Mutation hook to register a new client customer account in the host Organization.
   * On success, invalidates the active clients query to refresh the listings and closes the modal.
   */
  const createClientMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`${API_BASE}/clients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create client account");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setNewClientName("");
      setNewClientDomain("");
      setNewClientTier("trial");
      setNewClientOwnerId("");
      setClientError(null);
      setIsNewClientModalOpen(false);
    },
    onError: (err: any) => {
      setClientError(err.message);
    },
  });

  /**
   * Mutation hook to add a new client contact user under the active client account.
   * On success, invalidates both the selected client users list and the primary client list
   * (to recalculate aggregate user counts in the stats cards).
   */
  const createUserMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`${API_BASE}/clients/${selectedClientId}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create contact user");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients", selectedClientId, "users"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] }); // Invalidate list for counts
      setUserEmail("");
      setUserPassword("");
      setUserFirstName("");
      setUserLastName("");
      setUserJobTitle("");
      setUserError(null);
      setIsNewUserModalOpen(false);
    },
    onError: (err: any) => {
      setUserError(err.message);
    },
  });

  // =========================================================================
  // 3. Handlers
  // =========================================================================

  /**
   * Form submission handler to trigger the create client mutation.
   * Parses new client inputs and maps them into the payload.
   * 
   * @param e Form submit event
   */
  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    createClientMutation.mutate({
      name: newClientName,
      domain: newClientDomain || null,
      clientTier: newClientTier,
      ownerId: newClientOwnerId || null,
    });
  };

  /**
   * Form submission handler to trigger the add client user contact mutation.
   * Maps contact credentials and personal details.
   * 
   * @param e Form submit event
   */
  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    createUserMutation.mutate({
      email: userEmail,
      password: userPassword,
      firstName: userFirstName,
      lastName: userLastName,
      role: "client_user",
      jobTitle: userJobTitle || null,
    });
  };

  // =========================================================================
  // 4. Client Search & Filtering Logic
  // =========================================================================

  const filteredClients = clientsList.filter((client) => {
    // 1. Search Query filter (by name or domain)
    const matchesSearch =
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.domain && client.domain.toLowerCase().includes(searchQuery.toLowerCase()));

    // 2. Pill Category filter
    if (filterTier === "active") {
      return matchesSearch && client.clientTier !== "trial";
    }
    if (filterTier === "trial") {
      return matchesSearch && client.clientTier === "trial";
    }
    if (filterTier === "enterprise") {
      return matchesSearch && client.clientTier === "enterprise";
    }

    return matchesSearch;
  });

  // Compute overall statistics
  const totalAccounts = clientsList.length;
  const totalContacts = clientsList.reduce((acc, curr) => acc + curr.userCount, 0);
  const totalOpenTickets = clientsList.reduce((acc, curr) => acc + curr.ticketCount, 0);

  const selectedClient = clientsList.find((c) => c.id === selectedClientId);

  // =========================================================================
  // Render View (List View vs detail Drilldown View)
  // =========================================================================

  if (selectedClientId && selectedClient) {
    return (
      <div className="w-full px-6 md:px-12 py-12 font-sans text-ink">
        {/* Detail View Header */}
        <div className="mb-8 flex items-center justify-between">
          <button
            onClick={() => setSelectedClientId(null)}
            className="flex items-center gap-2 text-xs font-semibold font-mono uppercase tracking-wider text-muted-foreground hover:text-ink transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to clients
          </button>
          
          <button
            onClick={() => setIsNewUserModalOpen(true)}
            className="bg-brand-primary text-brand-secondary py-2 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all"
          >
            <Plus className="size-4" />
            Add User
          </button>
        </div>

        {/* Client General Info */}
        <div className="mb-10 p-6 border border-black/10 rounded-2xl bg-surface/5 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Client Account details
            </span>
            <h1 className="font-serif text-4xl mt-2">{selectedClient.name}</h1>
            <p className="text-sm text-muted-foreground mt-1 font-mono">
              {selectedClient.domain || "no custom domain"}
            </p>
          </div>

          <div className="flex flex-wrap gap-6 text-left">
            <div>
              <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block">
                Service Tier
              </span>
              <span className="text-xs font-bold uppercase tracking-wider font-mono bg-black text-canvas px-2.5 py-0.5 rounded-full inline-block mt-1">
                {selectedClient.clientTier}
              </span>
            </div>
            <div>
              <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block">
                Account Manager
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-block size-1.5 rounded-full bg-success" />
                <span className="text-xs font-medium">
                  {selectedClient.owner
                    ? `${selectedClient.owner.firstName} ${selectedClient.owner.lastName}`
                    : "Unassigned"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Users Directory */}
        <div className="border border-black/10 rounded-2xl bg-canvas p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-muted-foreground">
                Contacts Directory
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Users registered under this client who can submit support cases.
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/5">
              {clientUsers.length} active users
            </span>
          </div>

          {loadingUsers ? (
            <div className="text-xs text-muted-foreground py-6 text-center">Loading contact directory…</div>
          ) : clientUsers.length === 0 ? (
            <div className="text-xs text-muted-foreground py-10 text-center border border-dashed border-black/10 rounded-xl bg-surface/30">
              No users registered in this client account yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-black/5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    <th className="py-3 font-semibold">User</th>
                    <th className="py-3 font-semibold">Email</th>
                    <th className="py-3 font-semibold">Job Title</th>
                    <th className="py-3 font-semibold">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {clientUsers.map((usr) => (
                    <tr key={usr.id} className="hover:bg-black/[0.01]">
                      <td className="py-4 flex items-center gap-3">
                        <div className="size-8 rounded-full bg-surface outline outline-1 -outline-offset-1 outline-black/5 grid place-items-center font-mono text-[9px] font-semibold text-muted-foreground">
                          {usr.initials}
                        </div>
                        <span className="font-semibold text-ink">
                          {usr.firstName} {usr.lastName}
                        </span>
                      </td>
                      <td className="py-4 text-muted-foreground font-mono">{usr.email}</td>
                      <td className="py-4">
                        {usr.jobTitle ? (
                          <span className="px-1.5 py-0.5 rounded bg-black/[0.03] text-[10px]">
                            {usr.jobTitle}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/45 italic">—</span>
                        )}
                      </td>
                      <td className="py-4">
                        <span className="text-[9px] font-mono uppercase tracking-wider bg-black/5 text-muted-foreground px-1.5 py-0.5 rounded">
                          Client User
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add User Modal */}
        {isNewUserModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-canvas border border-black/10 rounded-2xl w-full max-w-md p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
              <button
                onClick={() => setIsNewUserModalOpen(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-ink transition-colors"
              >
                <X className="size-4" />
              </button>
              
              <h2 className="text-lg font-serif mb-2">Add Contact to {selectedClient.name}</h2>
              <p className="text-xs text-muted-foreground mb-6">
                Create user credentials so they can log into the client portal.
              </p>

              {userError && (
                <div className="mb-4 p-3 bg-danger/5 ring-1 ring-danger/15 rounded-lg text-xs text-danger flex items-start gap-2">
                  <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                  <span>{userError}</span>
                </div>
              )}

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <label className="block text-left">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                      First Name
                    </span>
                    <input
                      type="text"
                      required
                      value={userFirstName}
                      onChange={(e) => setUserFirstName(e.target.value)}
                      placeholder="Jane"
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
                      value={userLastName}
                      onChange={(e) => setUserLastName(e.target.value)}
                      placeholder="Smith"
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
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="jane.smith@company.com"
                    className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
                  />
                </label>

                <label className="block text-left">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                    Password
                  </span>
                  <input
                    type="password"
                    required
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
                  />
                </label>

                <label className="block text-left">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                    Job Title (Optional)
                  </span>
                  <input
                    type="text"
                    value={userJobTitle}
                    onChange={(e) => setUserJobTitle(e.target.value)}
                    placeholder="E.g. Procurement Lead"
                    className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
                  />
                </label>

                <button
                  type="submit"
                  disabled={createUserMutation.isPending}
                  className="w-full bg-brand-primary text-brand-secondary py-2.5 rounded-lg text-xs font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 mt-2"
                >
                  {createUserMutation.isPending ? "Creating contact…" : "Add Contact User"}
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
            Directory
          </span>
          <h1 className="font-serif text-5xl leading-tight mt-1 text-balance">
            Clients
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-[65ch] leading-relaxed">
            Companies whose teams can open tickets in your workspace. Drill in to manage their users and review history.
          </p>
        </div>

        <button
          onClick={() => setIsNewClientModalOpen(true)}
          className="bg-brand-primary text-brand-secondary py-3 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all shrink-0 shadow-sm"
        >
          <Plus className="size-4" />
          + New client
        </button>
      </div>

      {/* Analytics Counter Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 border border-black/10 rounded-2xl overflow-hidden bg-surface/5 mb-10 shadow-sm">
        <div className="p-6 text-left border-b md:border-b-0 md:border-r border-black/10">
          <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-2">
            Accounts
          </span>
          <span className="text-4xl font-serif font-medium">{totalAccounts}</span>
        </div>
        
        <div className="p-6 text-left border-b md:border-b-0 md:border-r border-black/10">
          <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-2">
            Contacts
          </span>
          <span className="text-4xl font-serif font-medium">{totalContacts}</span>
        </div>

        <div className="p-6 text-left">
          <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-2">
            Open Tickets
          </span>
          <span className="text-4xl font-serif font-medium">{totalOpenTickets}</span>
        </div>
      </div>

      {/* Filter and Search Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        {/* Category Filter Pills */}
        <div className="flex flex-wrap gap-2 text-xs font-medium">
          <button
            onClick={() => setFilterTier("all")}
            className={
              "px-3 py-1.5 rounded-full transition-colors " +
              (filterTier === "all" ? "bg-black text-canvas" : "bg-black/5 hover:bg-black/10 text-muted-foreground")
            }
          >
            All
          </button>
          <button
            onClick={() => setFilterTier("active")}
            className={
              "px-3 py-1.5 rounded-full transition-colors " +
              (filterTier === "active" ? "bg-black text-canvas" : "bg-black/5 hover:bg-black/10 text-muted-foreground")
            }
          >
            Active
          </button>
          <button
            onClick={() => setFilterTier("trial")}
            className={
              "px-3 py-1.5 rounded-full transition-colors " +
              (filterTier === "trial" ? "bg-black text-canvas" : "bg-black/5 hover:bg-black/10 text-muted-foreground")
            }
          >
            Trial
          </button>
          <button
            onClick={() => setFilterTier("enterprise")}
            className={
              "px-3 py-1.5 rounded-full transition-colors " +
              (filterTier === "enterprise" ? "bg-black text-canvas" : "bg-black/5 hover:bg-black/10 text-muted-foreground")
            }
          >
            Enterprise
          </button>
        </div>

        {/* Inline Search Bar */}
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground/60" />
          <input
            type="text"
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface ring-1 ring-black/10 rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
          />
        </div>
      </div>

      {/* Primary Data Grid Table */}
      <div className="border border-black/10 rounded-2xl bg-canvas p-6 shadow-sm">
        {loadingClients ? (
          <div className="text-xs text-muted-foreground py-10 text-center">Loading clients list…</div>
        ) : filteredClients.length === 0 ? (
          <div className="text-xs text-muted-foreground py-12 text-center">
            No client accounts match your search/filter parameters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-black/5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 font-semibold">Client</th>
                  <th className="py-3 font-semibold">Tier</th>
                  <th className="py-3 font-semibold text-center">Users</th>
                  <th className="py-3 font-semibold text-center">Tickets</th>
                  <th className="py-3 font-semibold">Owner</th>
                  <th className="py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {filteredClients.map((client) => {
                  const initials = client.name
                    .split(" ")
                    .map((n) => n.charAt(0))
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();

                  return (
                    <tr
                      key={client.id}
                      onClick={() => setSelectedClientId(client.id)}
                      className="hover:bg-black/[0.01] cursor-pointer transition-colors group"
                    >
                      <td className="py-4 flex items-center gap-3">
                        <div className="size-8 rounded-full bg-surface border border-black/5 grid place-items-center font-mono text-[9px] font-bold text-muted-foreground">
                          {initials}
                        </div>
                        <div>
                          <span className="font-semibold text-ink block hover:underline">
                            {client.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {client.domain || "no domain"}
                          </span>
                        </div>
                      </td>
                      <td className="py-4">
                        <span
                          className={
                            "text-[9px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold " +
                            (client.clientTier === "enterprise"
                              ? "bg-black text-canvas"
                              : client.clientTier === "business"
                              ? "bg-black/5 border border-black/10 text-ink"
                              : "bg-black/5 text-muted-foreground")
                          }
                        >
                          {client.clientTier}
                        </span>
                      </td>
                      <td className="py-4 text-center font-mono text-muted-foreground">
                        {client.userCount}
                      </td>
                      <td className="py-4 text-center font-mono text-muted-foreground">
                        {client.ticketCount}
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-1">
                          <span className="inline-block size-1.5 rounded-full bg-success mr-1.5" />
                          <span className="text-xs text-muted-foreground">
                            {client.owner
                              ? `${client.owner.firstName} ${client.owner.lastName}`
                              : "You"}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 text-right">
                        <button className="p-1 rounded-md hover:bg-black/5 text-muted-foreground group-hover:text-ink transition-all">
                          <ArrowRight className="size-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Client Modal */}
      {isNewClientModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-canvas border border-black/10 rounded-2xl w-full max-w-md p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setIsNewClientModalOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-ink transition-colors"
            >
              <X className="size-4" />
            </button>
            
            <h2 className="text-lg font-serif mb-2">New Client Account</h2>
            <p className="text-xs text-muted-foreground mb-6">
              Create a support client workspace profile.
            </p>

            {clientError && (
              <div className="mb-4 p-3 bg-danger/5 ring-1 ring-danger/15 rounded-lg text-xs text-danger flex items-start gap-2">
                <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                <span>{clientError}</span>
              </div>
            )}

            <form onSubmit={handleCreateClient} className="space-y-4">
              <label className="block text-left">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                  Company Name
                </span>
                <input
                  type="text"
                  required
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="E.g. Wayne Enterprises"
                  className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
                />
              </label>

              <label className="block text-left">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                  Email Domain (Optional)
                </span>
                <input
                  type="text"
                  value={newClientDomain}
                  onChange={(e) => setNewClientDomain(e.target.value)}
                  placeholder="E.g. wayne.com"
                  className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="block text-left">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                    Client Tier
                  </span>
                  <select
                    value={newClientTier}
                    onChange={(e) => setNewClientTier(e.target.value as any)}
                    className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
                  >
                    <option value="trial">Trial</option>
                    <option value="business">Business</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </label>

                <label className="block text-left">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                    Account Owner
                  </span>
                  <select
                    value={newClientOwnerId}
                    onChange={(e) => setNewClientOwnerId(e.target.value)}
                    className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
                  >
                    <option value="">Select Owner</option>
                    {staffList.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.firstName} {st.lastName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <button
                type="submit"
                disabled={createClientMutation.isPending}
                className="w-full bg-brand-primary text-brand-secondary py-2.5 rounded-lg text-xs font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 mt-2"
              >
                {createClientMutation.isPending ? "Creating account…" : "Create Account"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
