import { ArrowLeft, LucideIcon } from "lucide-react";

export type TabType = "overview" | "sla" | "rules" | "notifications" | "email" | "branding" | "staff" | "clients";

export interface SettingsMenuItem {
  id: TabType;
  label: string;
  description: string;
  icon: LucideIcon;
}

interface SettingsSidebarProps {
  activeTab: TabType;
  onTabSelect: (tab: TabType) => void;
  menuItems: SettingsMenuItem[];
}

export function SettingsSidebar({ activeTab, onTabSelect, menuItems }: SettingsSidebarProps) {
  return (
    <div className="w-64 border-r border-black/10 flex flex-col shrink-0 bg-surface/10 font-sans h-full">
      {/* Back Link to overview grid */}
      <button
        onClick={() => onTabSelect("overview")}
        className="p-4 border-b border-black/10 flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-ink transition-colors cursor-pointer text-left"
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
              onClick={() => onTabSelect(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all text-left cursor-pointer ${
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
  );
}
