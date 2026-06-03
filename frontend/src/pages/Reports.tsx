import { ReportsDashboard } from "@/features/tenant/reports";

export default function Reports() {
  return (
    <div className="w-full px-6 md:px-10 py-8 font-sans text-ink bg-canvas">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 mb-8">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Admin Analytics
          </span>
          <h1 className="font-serif text-5xl leading-tight mt-1">Reports</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-[70ch] leading-relaxed">
            Monitor ticket flow, SLA health, backlog pressure, agent performance, and customer satisfaction for this workspace.
          </p>
        </div>
      </div>

      <ReportsDashboard />
    </div>
  );
}
