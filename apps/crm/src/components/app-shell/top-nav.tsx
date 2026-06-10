import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Wordmark } from "@/components/landing/wordmark";

export function TopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Link href="/" aria-label="Resonate — back to landing">
            <Wordmark />
          </Link>
          <span aria-hidden className="h-4 w-px bg-border" />
          <span className="text-sm text-muted-foreground">Dashboard</span>
        </div>
        <Badge variant="outline" className="font-mono text-muted-foreground">
          Phase 0
        </Badge>
      </div>
    </header>
  );
}
