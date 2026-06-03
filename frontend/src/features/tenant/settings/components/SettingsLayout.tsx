import { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { SettingsSidebar, TabType, SettingsMenuItem } from "./SettingsSidebar";

interface SettingsLayoutProps {
  activeTab: TabType;
  onTabSelect: (tab: TabType) => void;
  menuItems: SettingsMenuItem[];
  children: ReactNode;
}

export function SettingsLayout({ activeTab, onTabSelect, menuItems, children }: SettingsLayoutProps) {
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
                onClick={() => onTabSelect(item.id)}
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

  return (
    <div className="flex h-[calc(100vh-3.5rem)] text-ink bg-canvas overflow-hidden w-full">
      {/* Sub-nav settings left sidebar menu */}
      <SettingsSidebar
        activeTab={activeTab}
        onTabSelect={onTabSelect}
        menuItems={menuItems}
      />

      {/* Settings pane content container */}
      <div className="flex-1 overflow-y-auto bg-canvas relative">
        <div className="px-6 md:px-12 pt-6 pb-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 select-none">
          <span>Settings</span>
          <span>/</span>
          <span className="text-ink font-semibold">
            {menuItems.find((m) => m.id === activeTab)?.label}
          </span>
        </div>

        <div className="px-6 md:px-12 pb-12 pt-2">
          {children}
        </div>
      </div>
    </div>
  );
}
