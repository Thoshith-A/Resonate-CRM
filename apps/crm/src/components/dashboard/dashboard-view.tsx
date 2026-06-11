"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber, formatRupees } from "@/lib/format";
import type { Dashboard } from "@/server/stats/getDashboard";
import { statusBadgeVariant, statusLabel } from "@/components/campaigns/status";

type FetchState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; data: Dashboard };

const formatPct = (value: number): string => `${value.toFixed(1)}%`;

export function DashboardView() {
  const router = useRouter();
  const [state, setState] = useState<FetchState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    fetch("/api/dashboard", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Request failed (${res.status})`);
        }
        return (await res.json()) as Dashboard;
      })
      .then((data) => setState({ status: "loaded", data }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Failed to load dashboard.",
        });
      });
    return () => controller.abort();
  }, [reloadKey]);

  return (
    <div className="flex flex-col gap-8">
      <StatCards state={state} />
      <CampaignTable
        state={state}
        onRetry={() => setReloadKey((key) => key + 1)}
        onRowClick={(id) => router.push(`/campaigns/${id}`)}
      />
    </div>
  );
}

const STAT_DEFS = [
  { key: "customers", label: "Customers", kind: "number" },
  { key: "campaigns", label: "Campaigns", kind: "number" },
  { key: "messagesSent", label: "Messages sent", kind: "number" },
  { key: "attributedRevenue", label: "Attributed revenue", kind: "money" },
] as const;

function StatCards({ state }: { state: FetchState }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {STAT_DEFS.map((def) => {
        let value: string;
        if (state.status === "loaded") {
          const raw = state.data.stats[def.key];
          value = def.kind === "money" ? formatRupees(raw) : formatNumber(raw);
        } else {
          value = "";
        }
        return (
          <Card key={def.key}>
            <CardHeader>
              <CardDescription>{def.label}</CardDescription>
            </CardHeader>
            <CardContent>
              {state.status === "loading" ? (
                <Skeleton className="h-9 w-24" />
              ) : (
                <p className="text-3xl font-medium tabular-nums text-foreground">
                  {state.status === "loaded" ? value : "—"}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function CampaignTable({
  state,
  onRetry,
  onRowClick,
}: {
  state: FetchState;
  onRetry: () => void;
  onRowClick: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-display text-xl tracking-tight">Campaigns</h2>
      <div className="rounded-lg border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead className="text-right">Audience</TableHead>
              <TableHead className="text-right">Delivered %</TableHead>
              <TableHead className="text-right">Clicked %</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.status === "loading" ? (
              <LoadingRows />
            ) : state.status === "error" ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center">
                  <p className="text-sm text-muted-foreground">{state.message}</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
                    Retry
                  </Button>
                </TableCell>
              </TableRow>
            ) : state.data.campaigns.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  No campaigns yet.
                </TableCell>
              </TableRow>
            ) : (
              state.data.campaigns.map((campaign) => (
                <TableRow
                  key={campaign.id}
                  className="cursor-pointer"
                  onClick={() => onRowClick(campaign.id)}
                >
                  <TableCell className="font-medium">{campaign.name}</TableCell>
                  <TableCell className="text-muted-foreground">{campaign.channel}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(campaign.audienceSize)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPct(campaign.deliveredPct)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPct(campaign.clickedPct)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatRupees(campaign.revenue)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(campaign.status)}>
                      {statusLabel(campaign.status, campaign.channel)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function LoadingRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: 7 }).map((__, j) => (
            <TableCell key={j}>
              <Skeleton className="h-5 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
