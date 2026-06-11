import type { Metadata } from "next";
import { TopNav } from "@/components/app-shell/top-nav";
import { CampaignInsights } from "@/components/campaigns/campaign-insights";

export const metadata: Metadata = {
  title: "Campaign · Resonate",
};

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="min-h-svh bg-background">
      <TopNav />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <CampaignInsights id={id} />
      </main>
    </div>
  );
}
