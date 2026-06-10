import { cn } from "@/lib/utils";

type WordmarkProps = {
  className?: string;
};

export function Wordmark({ className }: WordmarkProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className="size-6 shrink-0 text-copper"
      >
        <circle cx="11" cy="16" r="2.4" fill="currentColor" />
        <path
          d="M16.5 9.5 A 8.6 8.6 0 0 1 16.5 22.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.85"
        />
        <path
          d="M21 5.8 A 14.4 14.4 0 0 1 21 26.2"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M25.4 2.4 A 19.8 19.8 0 0 1 25.4 29.6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.3"
        />
      </svg>
      <span className="font-display text-xl leading-none tracking-tight text-foreground">
        Resonate
      </span>
    </span>
  );
}
