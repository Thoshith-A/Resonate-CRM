import type { Metadata } from "next";
import { TopNav } from "@/components/app-shell/top-nav";
import { NewCampaignFlow } from "@/components/campaigns/new-campaign-flow";

export const metadata: Metadata = {
  title: "New campaign · Resonate",
};

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string }>;
}) {
  const { segment } = await searchParams;

  return (
    <div className="min-h-svh bg-background">
      <TopNav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <header className="mb-8">
          <h1 className="font-display text-3xl tracking-tight">New campaign</h1>
          <p className="mt-1 text-sm text-muted-foreground">Audience → message → send.</p>
        </header>
        <NewCampaignFlow initialSegmentId={segment ?? null} />
      </main>
    </div>
  );
}
