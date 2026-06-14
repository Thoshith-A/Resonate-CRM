import { NextResponse } from "next/server";
import { fail, parseJson } from "@/server/api";
import { DraftMessagesInputSchema, draftMessages } from "@/server/ai/draftMessages";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const input = await parseJson(request, DraftMessagesInputSchema);
    const result = await draftMessages(input);
    return NextResponse.json(result);
  } catch (error) {
    return fail(error);
  }
}
