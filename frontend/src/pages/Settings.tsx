import { useState, useEffect } from "react";
import { Clock, GitBranch, Bell, Users, Building, ChevronRight, ArrowLeft, Palette, Mail } from "lucide-react";
import SlaSettings from "./SlaSettings";
import Rules from "./Rules";
import NotificationSettings from "./NotificationSettings";
import Staff from "./Staff";
import Clients from "./Clients";
import BrandingSettings from "./BrandingSettings";
import EmailChannelSettings from "./EmailChannelSettings";

type TabType = "overview" | "sla" | "rules" | "notifications" | "email" | "branding" | "staff" | "clients";

export default function Settings() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // Sync active settings sub-panel with URL query parameters for back/forward navigation support
  useEffect(() => {
    const handleSync = () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab") as TabType;
      if (tab && ["sla", "rules", "notifications", "email", "branding", "staff", "clients"].includes(tab)) {
        setActiveTab(tab);
      } else {
        setActiveTab("overview");
      }
    };
    handleSync();
    window.addEventListener("popstate", handleSync);
    return () => window.removeEventListener("popstate", handleSync);
  }, []);

  const selectTab = (tab: TabType) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab === "overview") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", tab);
    }
    window.history.pushState({}, "", url.pathname + url.search + url.hash);
  };

  const menuItems = [
    { id: "sla" as const, label: "SLA Policies", description: "Define response/resolution targets, calendar working hours and days.", icon: Clock },
    { id: "rules" as const, label: "Routing Rules", description: "Configure automated triaging rules and team round-robin workloads.", icon: GitBranch },
    { id: "notifications" as const, label: "Notifications", description: "Manage SMTP configurations, Slack webhooks, WhatsApp and In-App alerts.", icon: Bell },
    { id: "email" as const, label: "Email Channel", description: "Configure inbound email-to-ticket routing, sender policy, and test ingestion.", icon: Mail },
    { id: "branding" as const, label: "Workspace Branding", description: "Customize workspace logo, primary brand colors, and theme styling.", icon: Palette },
    { id: "staff" as const, label: "Staff Directory", description: "Register agents, manage team memberships, and assign roles.", icon: Users },
    { id: "clients" as const, label: "Client Accounts", description: "Manage customer companies, domains, and service tiers.", icon: Building },
  ];

  if (activeTab === "overview") {
    return (
      <div className="w-full px-6 md:px-12 py-12 font-sans text-ink max-w-6xl mx-auto">
        <div className="mb-10 text-left">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Admin Console
          </span>
          <h1 className="font-serif text-5xl leading-tight mt-1 text-balance">
            Workspace Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-[65ch] leading-relaxed">
            Manage your SupportDesk configurations. Customize SLA response targets, ticket auto-routing rules, notification channels, and active directories.
          </p>
        </div>

        {/* Grid of high-fidelity modern settings tiles */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => selectTab(item.id)}
                className="border border-black/10 rounded-2xl p-6 bg-surface/5 hover:bg-canvas hover:shadow-lg hover:border-black/20 hover:scale-[1.01] text-left transition-all group flex flex-col justify-between h-44 cursor-pointer"
              >
                <div className="w-full">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2.5 bg-black/[0.03] rounded-xl border border-black/5 text-ink group-hover:bg-black group-hover:text-canvas transition-colors">
                      <Icon className="size-5" />
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                  </div>
                  <h3 className="text-sm font-semibold text-ink mb-1">
                    {item.label}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {item.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const ActiveComponent = {
    sla: SlaSettings,
    rules: Rules,
    notifications: NotificationSettings,
    email: EmailChannelSettings,
    branding: BrandingSettings,
    staff: Staff,
    clients: Clients,
  }[activeTab];

  return (
    <div className="flex h-[calc(100vh-3.5rem)] text-ink bg-canvas overflow-hidden">
      
      {/* Sub-nav settings left sidebar menu */}
      <div className="w-64 border-r border-black/10 flex flex-col shrink-0 bg-surface/10 font-sans">
        
        {/* Back Link to overview grid */}
        <button
          onClick={() => selectTab("overview")}
          className="p-4 border-b border-black/10 flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-ink transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Settings Overview
        </button>

        {/* Quick-links list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => selectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all text-left ${
                  isActive
                    ? "bg-black text-canvas shadow-sm"
                    : "text-muted-foreground hover:bg-black/5 hover:text-ink"
                }`}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Settings pane content container */}
      <div className="flex-1 overflow-y-auto bg-canvas relative">
        <div className="px-6 md:px-12 pt-6 pb-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <span>Settings</span>
          <span>/</span>
          <span className="text-ink font-semibold">
            {menuItems.find((m) => m.id === activeTab)?.label}
          </span>
        </div>

        <div className="px-6 md:px-12 pb-12 pt-2">
          {ActiveComponent && <ActiveComponent />}
        </div>
      </div>
    </div>
  );
}
