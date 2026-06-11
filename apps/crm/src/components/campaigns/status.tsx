import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

/** Per-channel, human-readable status label. READ → "Opened" on EMAIL. */
export function statusLabel(status: string, channel: string): string {
  if (status === "READ") {
    return channel === "EMAIL" ? "Opened" : "Read";
  }
  return status.charAt(0) + status.slice(1).toLowerCase();
}

/** Badge variant intent per status (CLICKED is the copper "win"). */
export function statusBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case "CLICKED":
      return "default";
    case "FAILED":
      return "destructive";
    case "READ":
      return "secondary";
    default:
      return "outline";
  }
}

const DOT_CLASS: Record<string, string> = {
  QUEUED: "bg-muted-foreground/50",
  SENT: "bg-foreground/70",
  DELIVERED: "bg-foreground/40",
  READ: "bg-secondary-foreground/60",
  CLICKED: "bg-primary",
  FAILED: "bg-destructive",
};

/** A small colored status dot matching the badge intent. */
export function StatusDot({ status, className }: { status: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        DOT_CLASS[status] ?? "bg-muted-foreground/50",
        className,
      )}
    />
  );
}
