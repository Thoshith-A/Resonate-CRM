"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { motion, MotionConfig, useReducedMotion } from "motion/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Wordmark } from "./wordmark";

const ResonanceScene = dynamic(() => import("./scene/resonance-scene"), {
  ssr: false,
});

const HEADLINE_WORDS = ["Campaigns", "that", "resonate."] as const;
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

function supportsWebgl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") ?? canvas.getContext("webgl")
    );
  } catch {
    return false;
  }
}

export function Hero() {
  const reducedMotion = useReducedMotion();
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [revealFallback, setRevealFallback] = useState(false);

  useEffect(() => {
    setWebgl(supportsWebgl());
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setRevealFallback(true), 2400);
    return () => window.clearTimeout(id);
  }, []);

  const handleSceneReady = useCallback(() => setSceneReady(true), []);

  const posterOnly = webgl === false || reducedMotion === true;
  const mountCanvas = webgl === true && reducedMotion !== true;
  const revealed = sceneReady || posterOnly || revealFallback;

  const scrollToLoop = useCallback(() => {
    document.getElementById("loop")?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  }, [reducedMotion]);

  return (
    <MotionConfig reducedMotion="user">
      <section className="relative h-svh w-full overflow-hidden bg-[#070708]">
        {/* Static poster — always present beneath the canvas, never a blank frame. */}
        <div aria-hidden className="poster-glow absolute inset-0" />

        {mountCanvas ? (
          <div
            aria-hidden
            className={cn(
              "absolute inset-0 transition-opacity duration-1000",
              sceneReady ? "opacity-100" : "opacity-0"
            )}
          >
            <ResonanceScene onReady={handleSceneReady} />
          </div>
        ) : null}

        {/* Legibility scrim over the lower half. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[55svh] bg-gradient-to-t from-[#070708]/95 via-[#070708]/40 to-transparent"
        />

        <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-5 md:px-10">
          <Link href="/" aria-label="Resonate — home">
            <Wordmark />
          </Link>
          <Link
            href="/dashboard"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "text-foreground/75 hover:text-foreground"
            )}
          >
            Open dashboard
          </Link>
        </header>

        <div className="absolute inset-x-0 bottom-0 z-10 px-6 pb-24 md:px-10 lg:px-16 lg:pb-28">
          <div className="max-w-3xl">
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={revealed ? { opacity: 1, y: 0 } : undefined}
              transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.05 }}
              className="font-mono text-[11px] uppercase tracking-[0.32em] text-copper"
            >
              AI campaign copilot for D2C brands
            </motion.p>

            <h1 className="mt-5 font-display text-[clamp(3rem,8.5vw,6.5rem)] leading-[0.98] tracking-tight text-foreground">
              {HEADLINE_WORDS.map((word, index) => (
                <motion.span
                  key={word}
                  className={cn(
                    "inline-block will-change-transform",
                    index < HEADLINE_WORDS.length - 1 && "mr-[0.24em]",
                    word === "resonate." && "italic text-copper"
                  )}
                  initial={{ opacity: 0, y: 28, filter: "blur(14px)" }}
                  animate={
                    revealed
                      ? { opacity: 1, y: 0, filter: "blur(0px)" }
                      : undefined
                  }
                  transition={{
                    duration: 0.9,
                    ease: EASE_OUT,
                    delay: 0.15 + index * 0.12,
                  }}
                >
                  {word}
                </motion.span>
              ))}
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={revealed ? { opacity: 1, y: 0 } : undefined}
              transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.55 }}
              className="mt-6 max-w-xl text-base leading-relaxed text-foreground/65 md:text-lg"
            >
              Describe your audience in plain English. AI drafts the message. A
              live delivery pipeline shows you what happened — and what it
              earned.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={revealed ? { opacity: 1, y: 0 } : undefined}
              transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.7 }}
              className="mt-9 flex flex-wrap items-center gap-3"
            >
              <Link
                href="/dashboard"
                className={cn(buttonVariants({ size: "lg" }), "px-5")}
              >
                Open dashboard
              </Link>
              <Button
                variant="ghost"
                size="lg"
                className="px-5 text-foreground/75 hover:text-foreground"
                onClick={scrollToLoop}
              >
                How it works
              </Button>
            </motion.div>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2.5">
          <span className="text-[10px] uppercase tracking-[0.3em] text-foreground/35">
            Scroll
          </span>
          <span className="scroll-cue-line block h-10 w-px bg-gradient-to-b from-copper/80 to-transparent" />
        </div>
      </section>
    </MotionConfig>
  );
}
