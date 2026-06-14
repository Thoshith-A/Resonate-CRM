import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, parseJson } from "@/server/api";
import { campaignSummary } from "@/server/ai/campaignSummary";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BodySchema = z.object({ campaignId: z.string().min(1) });

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { campaignId } = await parseJson(request, BodySchema);
    const summary = await campaignSummary(campaignId);
    return NextResponse.json(summary);
  } catch (error) {
    return fail(error);
  }
}
