import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useAuth } from "./hooks/useAuth";
import SiteNav from "./components/SiteNav";
import Login from "./pages/Login";
import Inbox from "./pages/Inbox";
import ClientPortal from "./pages/ClientPortal";
import Teams from "./pages/Teams";
import Settings from "./pages/Settings";
import SuperAdmin from "./pages/SuperAdmin";
import Reports from "./pages/Reports";
import { getActiveSubdomain, getApiBase } from "./utils/api";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

function WorkspaceSelector() {
  const [subdomain, setSubdomain] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = subdomain.trim().toLowerCase();
    if (!clean) {
      setError("Please enter a workspace name");
      return;
    }
    if (!/^[a-z0-9-]+$/.test(clean)) {
      setError("Workspace name can only contain letters, numbers, and hyphens");
      return;
    }

    const { protocol, host } = window.location;
    window.location.href = `${protocol}//${clean}.${host}`;
  };

  const currentHost = window.location.hostname;
  const suffix = currentHost === "localhost" ? ".localhost" : `.${currentHost}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas text-ink font-sans px-4">
      <div className="max-w-md w-full border border-black/10 rounded-2xl bg-surface/10 p-8 md:p-10 shadow-sm text-center">
        <span className="font-serif italic text-4xl tracking-tight block mb-3 text-ink">
          Aura
        </span>
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono mb-8">
          Support Desk Gateway
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="text-left">
            <label className="block">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-2">
                Your Workspace Name
              </span>
              <div className="flex items-center bg-surface ring-1 ring-black/10 rounded-lg overflow-hidden focus-within:ring-black/20 transition-all">
                <input
                  type="text"
                  required
                  placeholder="e.g. aura, acme"
                  value={subdomain}
                  onChange={(e) => {
                    setSubdomain(e.target.value);
                    setError(null);
                  }}
                  className="flex-1 bg-transparent px-3 py-2.5 text-sm focus:outline-none"
                />
                <span className="bg-black/5 px-3 py-2.5 text-xs text-muted-foreground font-mono border-l border-black/10">
                  {suffix}
                </span>
              </div>
            </label>
            {error && (
              <span className="text-[10px] text-danger font-medium mt-1.5 block">
                {error}
              </span>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-ink text-canvas py-2.5 rounded-lg text-xs font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
          >
            Access Workspace
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-black/5 text-[11px] text-muted-foreground leading-relaxed font-sans">
          Enter <code className="font-mono bg-black/5 px-1 py-0.5 rounded text-ink">superadmin</code>, <code className="font-mono bg-black/5 px-1 py-0.5 rounded text-ink">aura</code> or <code className="font-mono bg-black/5 px-1 py-0.5 rounded text-ink">acme</code> to access the workspaces.
        </div>
      </div>
    </div>
  );
}

function MainContent() {
  const activeSubdomain = getActiveSubdomain();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState<string>("inbox");

  // Fetch workspace details (public branding name, colors)
  const { data: workspaceData } = useQuery<any>({
    queryKey: ["public_workspace", activeSubdomain],
    queryFn: async () => {
      if (!activeSubdomain) return null;
      const res = await fetch(`${getApiBase()}/auth/workspace`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!activeSubdomain,
  });

  const org = workspaceData?.org || null;

  // Apply workspace branding colors dynamically
  useEffect(() => {
    if (org) {
      document.documentElement.style.setProperty("--brand-primary", org.primaryColor || "#000000");
      document.documentElement.style.setProperty("--brand-secondary", org.secondaryColor || "#ffffff");
    } else {
      document.documentElement.style.setProperty("--brand-primary", "#000000");
      document.documentElement.style.setProperty("--brand-secondary", "#ffffff");
    }
  }, [org]);

  // Auth Redirect Logic
  useEffect(() => {
    if (isAuthenticated && user) {
      if (activeSubdomain === "superadmin") {
        setCurrentPage("superadmin");
      } else if (user.role === "client_user") {
        setCurrentPage("portal"); // Force clients to Portal
      } else {
        setCurrentPage((prev) => (["inbox", "settings", "teams", "reports"].includes(prev) ? prev : "inbox"));
      }
    }
  }, [isAuthenticated, user, activeSubdomain]);

  // If no subdomain is specified, force them to input a workspace subdomain first
  if (!activeSubdomain) {
    return <WorkspaceSelector />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-canvas text-ink">
        <span className="font-serif italic text-2xl tracking-tight animate-pulse mb-3">
          Aura
        </span>
        <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
          Resolving session…
        </span>
      </div>
    );
  }

  // 1. Force Login page if not logged in
  if (!isAuthenticated || !user) {
    return <Login />;
  }

  // 2. Render Page Content
  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink">
      <SiteNav currentPage={currentPage} onPageChange={setCurrentPage} />
      <main className="flex-1 overflow-auto">
        {currentPage === "inbox" && (user.role === "admin" || user.role === "agent") && <Inbox />}
        {currentPage === "settings" && user.role === "admin" && <Settings />}
        {currentPage === "reports" && user.role === "admin" && <Reports />}
        {currentPage === "superadmin" && user.role === "admin" && <SuperAdmin />}
        {currentPage === "portal" && user.role === "client_user" && <ClientPortal />}
        {currentPage === "teams" && (user.role === "admin" || user.role === "agent") && <Teams />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MainContent />
    </QueryClientProvider>
  );
}
