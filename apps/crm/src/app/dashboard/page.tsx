import type { Metadata } from "next";
import { TopNav } from "@/components/app-shell/top-nav";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Dashboard — Resonate",
  description: "Campaign operations for Brewline specialty coffee.",
};

const STATS = [
  { label: "Customers", note: "Seeded in Phase 1" },
  { label: "Campaigns", note: "Seeded in Phase 1" },
  { label: "Messages sent", note: "Live in Phase 5" },
  { label: "Attributed revenue", note: "Live in Phase 5" },
] as const;

export default function DashboardPage() {
  return (
    <div className="min-h-svh bg-background">
      <TopNav />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="font-display text-3xl tracking-tight text-foreground">
          Overview
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Campaign operations for Brewline specialty coffee.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat) => (
            <Card key={stat.label}>
              <CardHeader>
                <CardDescription>{stat.label}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-medium tabular-nums text-foreground/40">
                  —
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {stat.note}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
