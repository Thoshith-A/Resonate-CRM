import { NextResponse } from "next/server";
import { HealthResponseSchema } from "@resonate/shared";

export const dynamic = "force-dynamic";

export async function GET() {
  const body = HealthResponseSchema.parse({
    status: "ok",
    service: "crm",
    version: "0.1.0",
    time: new Date().toISOString(),
  });
  return NextResponse.json(body);
}
