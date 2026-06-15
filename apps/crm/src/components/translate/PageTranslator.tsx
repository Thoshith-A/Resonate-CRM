"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { LANGUAGES, findLanguage, type Language } from "@/lib/languages";
import {
  getCurrentLang,
  injectGoogleTranslate,
  translatePage,
} from "@/lib/googleTranslate";
import { cn } from "@/lib/utils";

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18" />
    </svg>
  );
}

/**
 * Page Translator — a nav button (left of Xeno Guide / Copilot) that opens a
 * searchable 55-language picker. Translation is driven by the free Google
 * Translate widget via the `googtrans` cookie (see lib/googleTranslate.ts).
 */
export default function PageTranslator() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeLang, setActiveLang] = useState("en");
  const searchRef = useRef<HTMLInputElement>(null);

  // Inject the widget once and reflect the currently-active language.
  useEffect(() => {
    injectGoogleTranslate();
    setActiveLang(getCurrentLang());
  }, []);

  // Focus the search box when the panel opens.
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => searchRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [open]);

  // English is always pinned to the top, regardless of the search query.
  const results = useMemo<Language[]>(() => {
    const q = query.trim().toLowerCase();
    const matches = (l: Language) =>
      l.name.toLowerCase().includes(q) ||
      l.native.toLowerCase().includes(q) ||
      l.code.toLowerCase().includes(q);
    const rest = LANGUAGES.filter((l) => l.code !== "en" && (q === "" || matches(l)));
    const english = findLanguage("en");
    return english ? [english, ...rest] : rest;
  }, [query]);

  const activeFlag = activeLang !== "en" ? findLanguage(activeLang)?.flag : null;

  const choose = (code: string) => {
    setOpen(false);
    translatePage(code); // sets cookie + reloads
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="sm"
        className="relative text-muted-foreground"
        onClick={() => setOpen(true)}
        title="Translate page"
        aria-label="Translate page"
      >
        <GlobeIcon className="size-4" />
        {activeFlag ? (
          <span className="absolute -right-0.5 -bottom-0.5 text-[10px] leading-none">
            {activeFlag}
          </span>
        ) : null}
      </Button>

      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-sm">
        <SheetHeader className="border-b border-border/60 p-4">
          <SheetTitle className="flex items-center gap-2">
            <GlobeIcon className="size-4 text-[#a78bfa]" />
            Translate page
          </SheetTitle>
          <SheetDescription>
            Translate the whole app into any of 55 languages.
          </SheetDescription>
        </SheetHeader>

        <div className="p-3">
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search languages…"
            className="w-full rounded-lg border border-white/10 bg-[#1a1d2e] px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-[#a78bfa]/50"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {results.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              No languages match “{query.trim()}”.
            </p>
          ) : (
            results.map((lang) => {
              const active = lang.code === activeLang;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => choose(lang.code)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md border-l-2 border-transparent px-2 py-2 text-left text-sm transition-colors hover:bg-white/5",
                    active && "border-[#a78bfa] bg-[#a78bfa]/10",
                  )}
                >
                  <span className="text-base leading-none">{lang.flag}</span>
                  <span className="text-foreground">{lang.name}</span>
                  <span className="text-muted-foreground">[{lang.native}]</span>
                  {active ? (
                    <span className="ml-auto text-xs text-[#a78bfa]">Active</span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
