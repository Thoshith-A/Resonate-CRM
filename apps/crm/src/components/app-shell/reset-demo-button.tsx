"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

type Status = "idle" | "running" | "done" | "error";

/**
 * Reset & reseed the demo data (SPEC §10). The admin key is prompted for at
 * click time rather than embedded — the server endpoint is the real guard.
 */
export function ResetDemoButton() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");

  async function handleReset() {
    if (status === "running") return;
    const key = window.prompt("Admin key to reset & reseed the demo data:");
    if (!key) return;

    setStatus("running");
    setMessage("");
    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "x-admin-key": key },
      });
      const body = (await res.json()) as
        | { ok: true; customers: number; orders: number }
        | { error?: { message?: string } };
      if (!res.ok || !("ok" in body)) {
        const detail = "error" in body ? body.error?.message : undefined;
        throw new Error(detail ?? `Reset failed (${res.status})`);
      }
      setStatus("done");
      setMessage(`Reseeded ${body.customers.toLocaleString("en-IN")} customers`);
      router.refresh();
      window.setTimeout(() => setStatus("idle"), 4000);
    } catch (error: unknown) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Reset failed.");
      window.setTimeout(() => setStatus("idle"), 5000);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {status !== "idle" && message ? (
        <span
          className={
            status === "error" ? "text-xs text-destructive" : "text-xs text-muted-foreground"
          }
        >
          {message}
        </span>
      ) : null}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleReset}
        disabled={status === "running"}
        className="text-muted-foreground"
        title="Reset & reseed demo data"
      >
        {status === "running" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : status === "done" ? (
          <Check className="size-4 text-copper" />
        ) : status === "error" ? (
          <TriangleAlert className="size-4 text-destructive" />
        ) : (
          <RotateCcw className="size-4" />
        )}
        Reset demo
      </Button>
    </div>
  );
}
