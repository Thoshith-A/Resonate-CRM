import { NextResponse } from "next/server";
import { fail } from "@/server/api";
import { getWindowStats } from "@/server/campaigns/getWindowStats";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const stats = await getWindowStats(id);
    return NextResponse.json(stats);
  } catch (error) {
    return fail(error);
  }
}
