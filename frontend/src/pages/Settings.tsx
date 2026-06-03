import { useState, useEffect } from "react";
import { Clock, GitBranch, Bell, Users, Building, Palette, Mail } from "lucide-react";
import SlaSettings from "./SlaSettings";
import Rules from "./Rules";
import NotificationSettings from "./NotificationSettings";
import Staff from "./Staff";
import Clients from "./Clients";
import BrandingSettings from "./BrandingSettings";
import EmailChannelSettings from "./EmailChannelSettings";
import { SettingsLayout, TabType, SettingsMenuItem } from "@/features/tenant/settings";

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

  const menuItems: SettingsMenuItem[] = [
    { id: "sla", label: "SLA Policies", description: "Define response/resolution targets, calendar working hours and days.", icon: Clock },
    { id: "rules", label: "Routing Rules", description: "Configure automated triaging rules and team round-robin workloads.", icon: GitBranch },
    { id: "notifications", label: "Notifications", description: "Manage SMTP configurations, Slack webhooks, WhatsApp and In-App alerts.", icon: Bell },
    { id: "email", label: "Email Channel", description: "Configure inbound email-to-ticket routing, sender policy, and test ingestion.", icon: Mail },
    { id: "branding", label: "Workspace Branding", description: "Customize workspace logo, primary brand colors, and theme styling.", icon: Palette },
    { id: "staff", label: "Staff Directory", description: "Register agents, manage team memberships, and assign roles.", icon: Users },
    { id: "clients", label: "Client Accounts", description: "Manage customer companies, domains, and service tiers.", icon: Building },
  ];

  const ActiveComponent = {
    sla: SlaSettings,
    rules: Rules,
    notifications: NotificationSettings,
    email: EmailChannelSettings,
    branding: BrandingSettings,
    staff: Staff,
    clients: Clients,
    overview: () => null,
  }[activeTab];

  return (
    <SettingsLayout
      activeTab={activeTab}
      onTabSelect={selectTab}
      menuItems={menuItems}
    >
      {ActiveComponent && <ActiveComponent />}
    </SettingsLayout>
  );
}
