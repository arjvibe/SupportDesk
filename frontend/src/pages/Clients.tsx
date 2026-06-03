import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, ArrowLeft, ShieldAlert } from "lucide-react";
import {
  useClientsList,
  useStaffList,
  useClientUsers,
  useCreateClient,
  useCreateClientUser,
  ClientAccount,
  ClientContact,
} from "@/features/tenant/clients";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { DataTableColumnHeader } from "@/components/data-table/DataTableColumnHeader";
import { ClientForm, ClientFormValues } from "@/features/tenant/clients/components/ClientForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormError } from "@/components/ui/form";

// Schema for adding contact users
const contactUserSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().min(1, "Email is required").email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  jobTitle: z.string(),
});

type ContactUserFormValues = z.infer<typeof contactUserSchema>;

export default function Clients() {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // Search & Filter State
  const [filterTier, setFilterTier] = useState<"all" | "active" | "trial" | "enterprise">("all");

  // Modal Control States
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);

  // =========================================================================
  // 1. Fetch data & mutations using Custom Hooks
  // =========================================================================
  const { data: clientsList = [], isLoading: loadingClients } = useClientsList();
  const { data: staffList = [] } = useStaffList();
  const { data: clientUsers = [], isLoading: loadingUsers } = useClientUsers(selectedClientId);

  const createClientMutation = useCreateClient();
  const createClientUserMutation = useCreateClientUser(selectedClientId);

  // =========================================================================
  // 2. Forms Setup
  // =========================================================================
  const contactForm = useForm<ContactUserFormValues>({
    resolver: zodResolver(contactUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      jobTitle: "",
    },
  });

  // =========================================================================
  // 3. Handlers
  // =========================================================================
  const handleCreateClient = async (values: ClientFormValues) => {
    try {
      await createClientMutation.mutateAsync({
        name: values.name,
        domain: values.domain || null,
        clientTier: values.clientTier,
        ownerId: values.ownerId || null,
      });
      setIsNewClientModalOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateUser = async (values: ContactUserFormValues) => {
    try {
      await createClientUserMutation.mutateAsync({
        email: values.email,
        password: values.password,
        firstName: values.firstName,
        lastName: values.lastName,
        role: "client_user",
        jobTitle: values.jobTitle || null,
      });
      contactForm.reset();
      setIsNewUserModalOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Filter clients by category tab
  const filteredClients = clientsList.filter((client) => {
    if (filterTier === "active") {
      return client.clientTier !== "trial";
    }
    if (filterTier === "trial") {
      return client.clientTier === "trial";
    }
    if (filterTier === "enterprise") {
      return client.clientTier === "enterprise";
    }
    return true;
  });

  // Aggregates for counters
  const totalAccounts = clientsList.length;
  const totalContacts = clientsList.reduce((acc, curr) => acc + curr.userCount, 0);
  const totalOpenTickets = clientsList.reduce((acc, curr) => acc + curr.ticketCount, 0);

  const selectedClient = clientsList.find((c) => c.id === selectedClientId);

  // =========================================================================
  // Columns Definition
  // =========================================================================
  const clientColumns: ColumnDef<ClientAccount>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Client" />,
      cell: ({ row }) => {
        const client = row.original;
        const initials = client.name
          .split(" ")
          .map((n) => n.charAt(0))
          .slice(0, 2)
          .join("")
          .toUpperCase();

        return (
          <div className="flex items-center gap-3">
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
          </div>
        );
      },
    },
    {
      accessorKey: "clientTier",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Tier" />,
      cell: ({ row }) => {
        const tier = row.getValue("clientTier") as string;
        return (
          <Badge
            variant={
              tier === "enterprise"
                ? "default"
                : tier === "business"
                ? "outline"
                : "secondary"
            }
          >
            {tier}
          </Badge>
        );
      },
    },
    {
      accessorKey: "userCount",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Users" className="justify-center" />,
      cell: ({ row }) => <div className="text-center font-mono text-muted-foreground">{row.getValue("userCount")}</div>,
    },
    {
      accessorKey: "ticketCount",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Tickets" className="justify-center" />,
      cell: ({ row }) => <div className="text-center font-mono text-muted-foreground">{row.getValue("ticketCount")}</div>,
    },
    {
      accessorKey: "owner",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Owner" />,
      cell: ({ row }) => {
        const owner = row.original.owner;
        return (
          <div className="flex items-center gap-1.5">
            <span className="inline-block size-1.5 rounded-full bg-success" />
            <span className="text-xs text-muted-foreground">
              {owner ? `${owner.firstName} ${owner.lastName}` : "You"}
            </span>
          </div>
        );
      },
    },
  ];

  const contactColumns: ColumnDef<ClientContact>[] = [
    {
      accessorKey: "firstName",
      header: ({ column }) => <DataTableColumnHeader column={column} title="User" />,
      cell: ({ row }) => {
        const usr = row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-full bg-surface outline outline-1 -outline-offset-1 outline-black/5 grid place-items-center font-mono text-[9px] font-semibold text-muted-foreground">
              {usr.initials}
            </div>
            <span className="font-semibold text-ink">
              {usr.firstName} {usr.lastName}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "email",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
      cell: ({ row }) => <span className="font-mono text-muted-foreground">{row.getValue("email")}</span>,
    },
    {
      accessorKey: "jobTitle",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Job Title" />,
      cell: ({ row }) => {
        const job = row.getValue("jobTitle") as string;
        return job ? (
          <span className="px-1.5 py-0.5 rounded bg-black/[0.03] text-[10px]">
            {job}
          </span>
        ) : (
          <span className="text-muted-foreground/45 italic">—</span>
        );
      },
    },
    {
      accessorKey: "role",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
      cell: () => <Badge variant="secondary">Client User</Badge>,
    },
  ];

  // =========================================================================
  // Render Views
  // =========================================================================

  if (selectedClientId && selectedClient) {
    return (
      <div className="w-full font-sans text-ink">
        {/* Detail View Header */}
        <div className="mb-8 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedClientId(null)}
            className="flex items-center gap-2 font-mono uppercase tracking-wider text-muted-foreground hover:text-ink transition-colors cursor-pointer"
          >
            <ArrowLeft className="size-4" />
            Back to clients
          </Button>

          <Button
            onClick={() => setIsNewUserModalOpen(true)}
            className="flex items-center gap-1.5"
            size="sm"
          >
            <Plus className="size-4" />
            Add User
          </Button>
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
              <Badge variant="default" className="mt-1">
                {selectedClient.clientTier}
              </Badge>
            </div>
            <div>
              <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block">
                Account Manager
              </span>
              <div className="flex items-center gap-2 mt-2">
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
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/5 text-muted-foreground">
              {clientUsers.length} active users
            </span>
          </div>

          <DataTable
            columns={contactColumns}
            data={clientUsers}
            isLoading={loadingUsers}
          />
        </div>

        {/* Add User Modal */}
        <Dialog open={isNewUserModalOpen} onOpenChange={setIsNewUserModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Contact to {selectedClient.name}</DialogTitle>
              <DialogDescription>
                Create user credentials so they can log into the client portal.
              </DialogDescription>
            </DialogHeader>

            {createClientUserMutation.error && (
              <div className="p-3 bg-danger/5 ring-1 ring-danger/15 rounded-lg text-xs text-danger flex items-start gap-2">
                <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                <span>{createClientUserMutation.error.message}</span>
              </div>
            )}

            <Form {...contactForm}>
              <form onSubmit={contactForm.handleSubmit(handleCreateUser)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={contactForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Jane" {...field} />
                        </FormControl>
                        <FormError />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={contactForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Smith" {...field} />
                        </FormControl>
                        <FormError />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={contactForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="jane.smith@company.com" {...field} />
                      </FormControl>
                      <FormError />
                    </FormItem>
                  )}
                />

                <FormField
                  control={contactForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormError />
                    </FormItem>
                  )}
                />

                <FormField
                  control={contactForm.control}
                  name="jobTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Title (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="E.g. Procurement Lead" {...field} />
                      </FormControl>
                      <FormError />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full mt-2" isLoading={createClientUserMutation.isPending}>
                  Add Contact User
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Tier filtering buttons for data table toolbar integration
  const filterElements = (
    <div className="flex flex-wrap gap-2 text-xs font-semibold">
      <button
        onClick={() => setFilterTier("all")}
        className={
          "px-3 py-1.5 rounded-full transition-colors cursor-pointer " +
          (filterTier === "all" ? "bg-black text-canvas" : "bg-black/5 hover:bg-black/10 text-muted-foreground")
        }
      >
        All
      </button>
      <button
        onClick={() => setFilterTier("active")}
        className={
          "px-3 py-1.5 rounded-full transition-colors cursor-pointer " +
          (filterTier === "active" ? "bg-black text-canvas" : "bg-black/5 hover:bg-black/10 text-muted-foreground")
        }
      >
        Active
      </button>
      <button
        onClick={() => setFilterTier("trial")}
        className={
          "px-3 py-1.5 rounded-full transition-colors cursor-pointer " +
          (filterTier === "trial" ? "bg-black text-canvas" : "bg-black/5 hover:bg-black/10 text-muted-foreground")
        }
      >
        Trial
      </button>
      <button
        onClick={() => setFilterTier("enterprise")}
        className={
          "px-3 py-1.5 rounded-full transition-colors cursor-pointer " +
          (filterTier === "enterprise" ? "bg-black text-canvas" : "bg-black/5 hover:bg-black/10 text-muted-foreground")
        }
      >
        Enterprise
      </button>
    </div>
  );

  return (
    <div className="w-full font-sans text-ink">
      {/* Title Header */}
      <PageHeader
        title="Clients"
        subtitle="Companies whose teams can open tickets in your workspace. Drill in to manage their users and review history."
        actions={
          <Button onClick={() => setIsNewClientModalOpen(true)} className="gap-1.5">
            <Plus className="size-4" />
            New Client
          </Button>
        }
      />

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

      {/* Main clients directory data table */}
      <DataTable
        columns={clientColumns}
        data={filteredClients}
        isLoading={loadingClients}
        searchColumn="name"
        searchPlaceholder="Search clients..."
        filterElements={filterElements}
        onRowClick={(client) => setSelectedClientId(client.id)}
      />

      {/* Create Client Modal */}
      <Dialog open={isNewClientModalOpen} onOpenChange={setIsNewClientModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Client Account</DialogTitle>
            <DialogDescription>
              Create a support client workspace profile.
            </DialogDescription>
          </DialogHeader>

          {createClientMutation.error && (
            <div className="p-3 bg-danger/5 ring-1 ring-danger/15 rounded-lg text-xs text-danger flex items-start gap-2">
              <ShieldAlert className="size-4 shrink-0 mt-0.5" />
              <span>{createClientMutation.error.message}</span>
            </div>
          )}

          <ClientForm
            onSubmit={handleCreateClient}
            isPending={createClientMutation.isPending}
            staffList={staffList}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
