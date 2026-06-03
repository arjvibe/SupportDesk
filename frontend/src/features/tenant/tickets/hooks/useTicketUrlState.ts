import { useState, useEffect } from "react";

export function useTicketUrlState() {
  const [selectedTicketId, setSelectedTicketIdState] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("ticket");
  });

  useEffect(() => {
    const handleSync = () => {
      const params = new URLSearchParams(window.location.search);
      setSelectedTicketIdState(params.get("ticket"));
    };

    window.addEventListener("popstate", handleSync);
    return () => window.removeEventListener("popstate", handleSync);
  }, []);

  const setSelectedTicketId = (id: string | null) => {
    setSelectedTicketIdState(id);
    const url = new URL(window.location.href);
    if (id) {
      url.searchParams.set("ticket", id);
    } else {
      url.searchParams.delete("ticket");
    }
    window.history.pushState({}, "", url.pathname + url.search + url.hash);
  };

  return [selectedTicketId, setSelectedTicketId] as const;
}
