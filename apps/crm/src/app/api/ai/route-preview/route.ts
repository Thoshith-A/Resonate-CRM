import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, parseJson } from "@/server/api";
import { previewRouting } from "@/server/campaigns/routeChannel";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BodySchema = z.object({
  segmentId: z.string().min(1),
  refresh: z.boolean().optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { segmentId, refresh } = await parseJson(request, BodySchema);
    const result = await previewRouting(segmentId, { refresh });
    return NextResponse.json(result);
  } catch (error) {
    return fail(error);
  }
}
