import { Search } from "lucide-react";

type QueueTab = "all" | "mine" | "unassigned" | "priority";

interface TicketFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  activeTab: QueueTab;
  onTabChange: (tab: QueueTab) => void;
}

export function TicketFilters({
  search,
  onSearchChange,
  activeTab,
  onTabChange,
}: TicketFiltersProps) {
  return (
    <>
      {/* Search Bar */}
      <div className="p-4 border-b border-black/10">
        <div className="flex items-center bg-surface ring-1 ring-black/10 rounded-lg overflow-hidden focus-within:ring-black/20 transition-all">
          <Search className="size-4 text-muted-foreground ml-3 shrink-0" />
          <input
            type="text"
            placeholder="Search by code, subject..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-transparent px-3 py-2 text-xs focus:outline-none"
          />
        </div>
      </div>

      {/* Queue Filter Tabs */}
      <div className="grid grid-cols-4 border-b border-black/10 bg-surface/20 text-[10px] font-mono uppercase tracking-wider text-center">
        {(["all", "mine", "unassigned", "priority"] as QueueTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`py-2.5 font-bold transition-all ${
              activeTab === tab
                ? "border-b-2 border-ink text-ink bg-canvas"
                : "text-muted-foreground hover:text-ink cursor-pointer"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
    </>
  );
}
