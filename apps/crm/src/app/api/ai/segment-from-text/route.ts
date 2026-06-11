import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, parseJson } from "@/server/api";
import { segmentFromText } from "@/server/ai/segmentFromText";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BodySchema = z.object({ prompt: z.string().min(1).max(500) });

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { prompt } = await parseJson(request, BodySchema);
    const result = await segmentFromText(prompt);
    return NextResponse.json(result);
  } catch (error) {
    return fail(error);
  }
}
