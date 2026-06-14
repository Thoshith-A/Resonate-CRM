import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { TopNav } from "@/components/app-shell/top-nav";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Dashboard · Resonate",
};

export default function DashboardPage() {
  return (
    <div className="min-h-svh bg-background">
      <TopNav />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Brewline campaign performance at a glance.
            </p>
          </div>
          <Link href="/campaigns/new" className={cn(buttonVariants({ size: "sm" }))}>
            <Plus className="size-4" /> New campaign
          </Link>
        </header>
        <DashboardView />
      </main>
    </div>
  );
}
