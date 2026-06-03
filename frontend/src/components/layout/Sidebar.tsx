import { useAuth } from "@/features/tenant/auth";
import { getActiveSubdomain, resolveAssetUrl } from "@/utils/api";
import { Inbox, Users, BarChart3, Settings, ShieldCheck, Home } from "lucide-react";
import { cn } from "@/lib/utils";

type SidebarProps = {
  currentPage: string;
  onPageChange: (page: string) => void;
};

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const { user, org } = useAuth();

  if (!user) return null;

  const isSuperAdmin = getActiveSubdomain() === "superadmin";
  const isAdmin = user.role === "admin";
  const isAgent = user.role === "agent";

  const menuItems: { page: string; label: string; icon: any; roles: string[] }[] = [];

  if (isSuperAdmin) {
    menuItems.push({
      page: "superadmin",
      label: "Platform Admin",
      icon: ShieldCheck,
      roles: ["admin"],
    });
  } else {
    if (isAdmin || isAgent) {
      menuItems.push(
        { page: "inbox", label: "Inboxes", icon: Inbox, roles: ["admin", "agent"] },
        { page: "teams", label: "Teams", icon: Users, roles: ["admin", "agent"] }
      );
    }
    if (isAdmin) {
      menuItems.push(
        { page: "reports", label: "Reports", icon: BarChart3, roles: ["admin"] },
        { page: "settings", label: "Settings", icon: Settings, roles: ["admin"] }
      );
    }
    if (user.role === "client_user") {
      menuItems.push({
        page: "portal",
        label: "Client Portal",
        icon: Home,
        roles: ["client_user"],
      });
    }
  }

  return (
    <aside className="w-64 border-r border-black/10 bg-surface/30 flex flex-col font-sans shrink-0 hidden md:flex">
      {/* Sidebar Header branding */}
      <div className="h-14 flex items-center px-6 border-b border-black/10 bg-canvas/40 backdrop-blur-md">
        <button
          onClick={() => onPageChange(isSuperAdmin ? "superadmin" : user.role === "client_user" ? "portal" : "inbox")}
          className="font-serif italic text-2xl tracking-tight text-ink hover:opacity-85 transition-opacity cursor-pointer flex items-center"
        >
          {isSuperAdmin ? (
            "Aura Platform"
          ) : org?.logoUrl ? (
            <img src={resolveAssetUrl(org.logoUrl)} alt={org.name} className="h-8 max-w-[160px] object-contain" />
          ) : (
            org?.name || "Aura"
          )}
        </button>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {isSuperAdmin && (
          <div className="px-3 mb-4">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block">
              Console
            </span>
          </div>
        )}
        
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.page;

          return (
            <button
              key={item.page}
              onClick={() => onPageChange(item.page)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer text-left",
                isActive
                  ? "bg-brand-primary text-brand-secondary shadow-sm"
                  : "text-muted-foreground hover:bg-black/5 hover:text-ink"
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer details */}
      <div className="p-4 border-t border-black/5 bg-black/[0.01] text-[10px] text-muted-foreground font-mono text-center">
        v1.0.0 &bull; SupportDesk
      </div>
    </aside>
  );
}
