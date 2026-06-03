import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/features/tenant/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { getActiveSubdomain, resolveAssetUrl } from "@/utils/api";
import { apiClient } from "@/api/client";


type TopbarProps = {
  onPageChange: (page: string) => void;
};

export function Topbar({ onPageChange }: TopbarProps) {
  const { user, org, logout } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch in-app notifications
  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ["user_notifications"],
    queryFn: async () => {
      return apiClient.get<any[]>("/notifications");
    },
    enabled: !!user && getActiveSubdomain() !== "superadmin",
    refetchInterval: 10000, // Poll every 10 seconds for real-time feel
  });

  // Mark single notification as read mutation
  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiClient.put<any>(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_notifications"] });
    },
  });

  // Mark all as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      return apiClient.put<any>("/notifications/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_notifications"] });
    },
  });

  if (!user) return null;

  const isSuperAdmin = getActiveSubdomain() === "superadmin";
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleNotificationClick = (item: any) => {
    if (!item.isRead) {
      markReadMutation.mutate(item.id);
    }
    setIsOpen(false);

    if (item.ticketId) {
      // 1. Update URL search query param
      const url = new URL(window.location.href);
      url.searchParams.set("ticket", item.ticketId);
      window.history.pushState({}, "", url.pathname + url.search + url.hash);

      // 2. Switch page context
      onPageChange(user.role === "client_user" ? "portal" : "inbox");

      // 3. Dispatch popstate to notify Inbox / ClientPortal page of path update
      window.dispatchEvent(new Event("popstate"));
    }
  };

  return (
    <header className="h-14 border-b border-black/10 flex items-center justify-between px-6 bg-canvas/90 backdrop-blur-md sticky top-0 z-40 font-sans">
      <div className="flex items-center gap-4">
        {/* Mobile menu logo fallback or space */}
        <span className="font-serif italic text-xl tracking-tight text-ink md:hidden">
          {isSuperAdmin ? (
            "Aura Platform"
          ) : org?.logoUrl ? (
            <img src={resolveAssetUrl(org.logoUrl)} alt={org.name} className="h-6 max-w-[100px] object-contain" />
          ) : (
            org?.name || "Aura"
          )}
        </span>
      </div>

      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-2 mr-2">
          <div className="size-1.5 rounded-full bg-success" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            {isSuperAdmin ? "platform admin" : `${user.role} workspace`}
          </span>
        </div>

        {/* Bell dropdown integration */}
        {!isSuperAdmin && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-full hover:bg-black/5 text-muted-foreground hover:text-ink transition-colors relative cursor-pointer"
              title="Notifications"
            >
              <Bell className="size-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-2 w-2 rounded-full bg-danger ring-1 ring-canvas" />
              )}
            </button>

            {isOpen && (
              <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-hidden rounded-xl border border-black/10 bg-canvas/95 backdrop-blur-md shadow-lg z-50 flex flex-col font-sans">
                <div className="flex items-center justify-between px-4 py-3 border-b border-black/5 bg-black/[0.02]">
                  <span className="font-semibold text-xs text-ink uppercase tracking-wider">
                    Notifications
                  </span>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllReadMutation.mutate()}
                      className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-ink transition-colors cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-black/5">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-xs">
                      No notifications
                    </div>
                  ) : (
                    notifications.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleNotificationClick(item)}
                        className={`w-full p-3.5 text-left hover:bg-black/[0.02] cursor-pointer transition-all flex gap-3 ${
                          !item.isRead ? "bg-black/[0.01]" : ""
                        }`}
                      >
                        <div className="mt-1 flex flex-col items-center">
                          {!item.isRead ? (
                            <div className="size-2 rounded-full bg-danger" />
                          ) : (
                            <div className="size-2" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold text-ink leading-tight truncate ${!item.isRead ? "font-bold" : ""}`}>
                            {item.title}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal line-clamp-2">
                            {item.message}
                          </p>
                          <span className="text-[9px] text-muted-foreground font-mono mt-1 block">
                            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="size-8 rounded-full bg-surface outline outline-1 -outline-offset-1 outline-black/5 grid place-items-center font-mono text-[10px] font-medium text-muted-foreground">
            {user.initials}
          </div>
          <button
            onClick={() => logout()}
            className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-ink border border-black/10 rounded-md px-2 py-1 transition-colors cursor-pointer"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
