import * as React from "react";
import SiteNav from "../SiteNav";
import { AppErrorBoundary } from "../common/AppErrorBoundary";

interface AppShellProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  children: React.ReactNode;
}

export function AppShell({ currentPage, onPageChange, children }: AppShellProps) {
  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink font-sans">
      {/* Top navigation menu */}
      <SiteNav currentPage={currentPage} onPageChange={onPageChange} />

      {/* Dynamic content area with local error containment */}
      <main className="flex-1 overflow-auto relative">
        <AppErrorBoundary>
          {children}
        </AppErrorBoundary>
      </main>
    </div>
  );
}
