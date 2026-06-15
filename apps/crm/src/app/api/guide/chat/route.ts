import { NextResponse } from "next/server";
import { z } from "zod";
import { runXenoGuide } from "@/server/ai/xenoGuide";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Up to 20 turns of history for multi-turn context (SPEC).
const BodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(20),
});

const GENERIC_ERROR = "Something went wrong. Please try again.";

/**
 * POST /api/guide/chat — body { messages }, response { reply }. Never surfaces
 * raw errors to the UI: validation failures and model/key errors both resolve
 * to a friendly reply with a 200 so the chat stays usable.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const raw: unknown = await request.json();
    const { messages } = BodySchema.parse(raw);
    const reply = await runXenoGuide(messages);
    return NextResponse.json({ reply });
  } catch (error) {
    console.error("xeno-guide chat error", error);
    return NextResponse.json({ reply: GENERIC_ERROR });
  }
}
