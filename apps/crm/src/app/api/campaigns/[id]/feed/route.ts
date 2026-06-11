import { NextResponse } from "next/server";
import { fail } from "@/server/api";
import { getCampaignFeed } from "@/server/campaigns/getCampaignFeed";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const limitParam = Number.parseInt(new URL(request.url).searchParams.get("limit") ?? "40", 10);
    const feed = await getCampaignFeed(id, Number.isFinite(limitParam) ? limitParam : 40);
    return NextResponse.json({ feed });
  } catch (error) {
    return fail(error);
  }
}
