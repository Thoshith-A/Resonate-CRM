"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { FeedItem } from "@/server/campaigns/getCampaignFeed";
import { StatusDot, statusBadgeVariant, statusLabel } from "./status";

type FetchState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; feed: FeedItem[] };

type FeedResponse = { feed: FeedItem[] };

const POLL_MS = 3000;
const FEED_LIMIT = 40;

/** Compact relative time from an ISO string: "now", "12s", "5m", "3h", "2d". */
function relativeTime(iso: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (seconds < 5) {
    return "now";
  }
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.floor(hours / 24)}d ago`;
}

export function DeliveryFeed({ campaignId, channel }: { campaignId: string; channel: string }) {
  const [state, setState] = useState<FetchState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // Track the previous status per row id so we can briefly highlight changes.
  const prevStatusRef = useRef<Map<string, string>>(new Map());
  const [changed, setChanged] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const load = () => {
      fetch(`/api/campaigns/${campaignId}/feed?limit=${FEED_LIMIT}`, {
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) {
            throw new Error(`Request failed (${res.status})`);
          }
          return (await res.json()) as FeedResponse;
        })
        .then((data) => {
          if (cancelled) {
            return;
          }
          const prev = prevStatusRef.current;
          const next = new Map<string, string>();
          const flipped = new Set<string>();
          for (const row of data.feed) {
            next.set(row.id, row.status);
            const before = prev.get(row.id);
            if (before !== undefined && before !== row.status) {
              flipped.add(row.id);
            }
          }
          prevStatusRef.current = next;
          setChanged(flipped);
          setNow(Date.now());
          setState({ status: "loaded", feed: data.feed });
        })
        .catch((error: unknown) => {
          if (cancelled || controller.signal.aborted) {
            return;
          }
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Failed to load feed.",
          });
        });
    };

    load();
    const interval = window.setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [campaignId, reloadKey]);

  if (state.status === "loading") {
    return (
      <ul className="flex flex-col">
        {Array.from({ length: 8 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 border-b border-border/40 py-2.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="ml-auto h-4 w-16" />
          </li>
        ))}
      </ul>
    );
  }

  if (state.status === "error") {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-muted-foreground">{state.message}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => setReloadKey((key) => key + 1)}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (state.feed.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No messages yet.</p>;
  }

  return (
    <ul className="flex flex-col">
      {state.feed.map((row) => (
        <li
          key={row.id}
          className={`flex items-center gap-3 border-b border-border/40 py-2.5 transition-colors duration-700 last:border-b-0 ${
            changed.has(row.id) ? "bg-primary/5" : "bg-transparent"
          }`}
        >
          <StatusDot status={row.status} />
          <span className="truncate text-sm font-medium">{row.customerName}</span>
          <Badge variant={statusBadgeVariant(row.status)} className="shrink-0">
            {statusLabel(row.status, row.channel || channel)}
          </Badge>
          {row.failureReason ? (
            <span className="truncate text-xs text-destructive">
              {row.failureReason.replace(/_/g, " ")}
            </span>
          ) : null}
          <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
            {relativeTime(row.updatedAt, now)}
          </span>
        </li>
      ))}
    </ul>
  );
}
