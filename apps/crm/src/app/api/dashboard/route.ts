import { NextResponse } from "next/server";
import { fail } from "@/server/api";
import { getDashboard } from "@/server/stats/getDashboard";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const dashboard = await getDashboard();
    return NextResponse.json(dashboard);
  } catch (error) {
    return fail(error);
  }
}
