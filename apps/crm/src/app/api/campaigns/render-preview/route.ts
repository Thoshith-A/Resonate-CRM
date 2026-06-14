import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, parseJson } from "@/server/api";
import { renderPreview } from "@/server/campaigns/renderPreview";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  segmentId: z.string().min(1),
  template: z.string().max(2000),
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { segmentId, template } = await parseJson(request, BodySchema);
    const result = await renderPreview(segmentId, template);
    return NextResponse.json(result);
  } catch (error) {
    return fail(error);
  }
}
