"use client";

import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { motion, MotionConfig } from "motion/react";
import { ChartLine, MessageSquareText, Send, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Wordmark } from "./wordmark";

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

type Step = {
  number: string;
  title: string;
  body: string;
  icon: ComponentType<{ className?: string }>;
};

const STEPS: readonly Step[] = [
  {
    number: "01",
    title: "Audience",
    body: "Plain English → typed segment rules, live count.",
    icon: Users,
  },
  {
    number: "02",
    title: "Message",
    body: "Three on-brand variants with merge fields.",
    icon: MessageSquareText,
  },
  {
    number: "03",
    title: "Send",
    body: "Batched dispatch over signed HTTP to a real delivery pipeline.",
    icon: Send,
  },
  {
    number: "04",
    title: "Learn",
    body: "Funnel, failures, attributed revenue — explained in plain English.",
    icon: ChartLine,
  },
];

const ARCHITECTURE_CHIPS = [
  "HMAC-signed",
  "idempotent by design",
  "forward-only state machine",
] as const;

type RevealProps = {
  children: ReactNode;
  delay?: number;
  className?: string;
};

function Reveal({ children, delay = 0, className }: RevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 0.7, ease: EASE_OUT, delay }}
    >
      {children}
    </motion.div>
  );
}

export function LandingSections() {
  return (
    <MotionConfig reducedMotion="user">
      <section id="loop" className="mx-auto max-w-6xl scroll-mt-12 px-6 py-28 md:py-36">
        <Reveal>
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-copper">
            The loop
          </p>
          <h2 className="mt-4 font-display text-4xl tracking-tight text-foreground md:text-5xl">
            One loop, end to end.
          </h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-foreground/60">
            Audience to message to send to learn — the whole campaign cycle in
            a single pass, with nothing hand-waved.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <Reveal key={step.number} delay={index * 0.08} className="h-full">
              <Card className="h-full bg-card/60">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-copper/10 text-copper ring-1 ring-copper/20">
                      <step.icon className="size-4" />
                    </span>
                    <span className="font-mono text-xs text-copper/70">
                      {step.number}
                    </span>
                  </div>
                  <CardTitle className="mt-3 text-foreground">
                    {step.title}
                  </CardTitle>
                  <CardDescription className="leading-relaxed">
                    {step.body}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-28 md:pb-36">
        <Reveal>
          <Card className="bg-card/40 py-10">
            <CardContent className="flex flex-col gap-8 px-8 md:flex-row md:items-center md:justify-between md:px-10">
              <div className="max-w-xl">
                <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-copper/80">
                  Under the hood
                </p>
                <p className="mt-4 text-lg leading-relaxed text-foreground/80 md:text-xl">
                  Two services. Signed webhooks. An idempotent receipt ledger.
                  Out-of-order events welcome.
                </p>
              </div>
              <div className="flex max-w-xs flex-wrap gap-2">
                {ARCHITECTURE_CHIPS.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-copper/20 bg-copper/5 px-3 py-1 font-mono text-xs text-copper/90"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </Reveal>
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-12 md:flex-row md:items-center">
          <Link href="/" aria-label="Resonate — home">
            <Wordmark />
          </Link>
          <p className="text-sm text-foreground/45">
            Built as a take-home — demo brand: Brewline specialty coffee.
          </p>
          <Link
            href="/dashboard"
            className="text-sm text-copper transition-colors hover:text-copper-bright"
          >
            Open dashboard →
          </Link>
        </div>
      </footer>
    </MotionConfig>
  );
}
