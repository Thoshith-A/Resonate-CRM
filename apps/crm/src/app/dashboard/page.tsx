import type { Metadata } from "next";
import { TopNav } from "@/components/app-shell/top-nav";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export const metadata: Metadata = {
  title: "Dashboard · Resonate",
};

export default function DashboardPage() {
  return (
    <div className="min-h-svh bg-background">
      <TopNav />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8">
          <h1 className="font-display text-3xl tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Brewline campaign performance at a glance.
          </p>
        </header>
        <DashboardView />
      </main>
    </div>
  );
}
