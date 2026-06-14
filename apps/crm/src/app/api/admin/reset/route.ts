import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ApiError, fail } from "@/server/api";
import { prisma } from "@/server/db";
import { getEnv } from "@/server/env";
import { reseedDatabase } from "@/server/admin/reseed";

export const dynamic = "force-dynamic";
// Regenerating ~8k customers + ~35k orders is a bulk job; give it headroom.
export const maxDuration = 60;

/** Constant-time compare so the guard doesn't leak the key via timing. */
function keyMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Reset & reseed the demo database (SPEC §10). Guarded by the `x-admin-key`
 * header matching ADMIN_KEY — single-tenant demo, so this is the one
 * privileged action and it must never be reachable without the key.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const env = getEnv();
    const provided = request.headers.get("x-admin-key") ?? "";
    if (!keyMatches(provided, env.ADMIN_KEY)) {
      throw new ApiError(401, "unauthorized", "Invalid or missing admin key.");
    }

    const result = await reseedDatabase(prisma);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return fail(error);
  }
}
