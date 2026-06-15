"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { GuideMarkdown } from "@/components/guide/guide-markdown";
import { LANGUAGES, findLanguage, type Language } from "@/lib/languages";
import { getCurrentLang } from "@/lib/googleTranslate";
import {
  isSpeechRecognitionSupported,
  startSpeechRecognition,
} from "@/lib/speechRecognition";
import { cancelSpeech, speak } from "@/lib/speechSynthesis";
import { cn } from "@/lib/utils";

// ── Endpoint contract: POST /api/guide/chat → { reply } ────────────────────
type Role = "user" | "assistant";
type ChatMessage = { role: Role; content: string; error?: boolean };

const HISTORY_KEY = "xeno-guide-history";
const VOICE_LANG_KEY = "xeno-guide-voice-lang";
const AUTOSPEAK_KEY = "xeno-guide-autospeak";
const MAX_HISTORY = 20;

// Suggested prompts, localized for the 6 most common Indian languages; every
// other voice language falls back to English (per spec — no API call for this).
const SUGGESTED_PROMPTS: Record<string, string[]> = {
  en: [
    "How do I create a segment?",
    "What is Smart Windows?",
    "Show me campaign analytics",
    "How does AI channel routing work?",
  ],
  hi: [
    "सेगमेंट कैसे बनाएं?",
    "Smart Windows क्या है?",
    "कैंपेन एनालिटिक्स दिखाएं",
    "AI चैनल रूटिंग कैसे काम करती है?",
  ],
  mr: [
    "सेगमेंट कसा तयार करायचा?",
    "Smart Windows म्हणजे काय?",
    "कॅम्पेन विश्लेषण दाखवा",
    "AI चॅनेल रूटिंग कसे कार्य करते?",
  ],
  ta: [
    "பிரிவை எவ்வாறு உருவாக்குவது?",
    "Smart Windows என்றால் என்ன?",
    "பிரச்சார பகுப்பாய்வு காட்டு",
    "AI சேனல் ரூட்டிங் எப்படி வேலை செய்கிறது?",
  ],
  te: [
    "సెగ్మెంట్ ఎలా సృష్టించాలి?",
    "Smart Windows అంటే ఏమిటి?",
    "క్యాంపెయిన్ విశ్లేషణలు చూపించు",
    "AI ఛానల్ రూటింగ్ ఎలా పనిచేస్తుంది?",
  ],
  kn: [
    "ಸೆಗ್ಮೆಂಟ್ ಹೇಗೆ ರಚಿಸುವುದು?",
    "Smart Windows ಎಂದರೇನು?",
    "ಕ್ಯಾಂಪೇನ್ ವಿಶ್ಲೇಷಣೆ ತೋರಿಸು",
    "AI ಚಾನಲ್ ರೂಟಿಂಗ್ ಹೇಗೆ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ?",
  ],
  ml: [
    "സെഗ്മെന്റ് എങ്ങനെ സൃഷ്ടിക്കാം?",
    "Smart Windows എന്താണ്?",
    "കാമ്പെയ്ൻ അനലിറ്റിക്സ് കാണിക്കൂ",
    "AI ചാനൽ റൂട്ടിങ് എങ്ങനെ പ്രവർത്തിക്കുന്നു?",
  ],
};

// Web Speech wants BCP-47 locales; map the languages we have good coverage for.
const SPEECH_LOCALES: Record<string, string> = {
  en: "en-US",
  hi: "hi-IN",
  mr: "mr-IN",
  ta: "ta-IN",
  te: "te-IN",
  kn: "kn-IN",
  ml: "ml-IN",
  bn: "bn-IN",
  gu: "gu-IN",
  pa: "pa-IN",
  ur: "ur-PK",
  zh: "zh-CN",
  "zh-TW": "zh-TW",
  ja: "ja-JP",
  ko: "ko-KR",
  ar: "ar-SA",
  ru: "ru-RU",
  de: "de-DE",
  fr: "fr-FR",
  es: "es-ES",
  pt: "pt-BR",
  it: "it-IT",
};

// Voice languages whose script is non-Latin. Used to decide whether a
// Latin-script answer (i.e. an English reply to an English question) should be
// spoken as English even though a non-Latin voice language is selected.
const NON_LATIN_VOICE = new Set<string>([
  "hi", "mr", "ta", "te", "kn", "ml", "bn", "gu", "pa", "ur", "zh", "zh-TW",
  "ja", "ko", "ar", "fa", "ru", "uk", "be", "bg", "sr", "el", "he", "th", "am",
]);

/** Strip markdown + the English <details> block so TTS reads only the answer. */
function plainTextForSpeech(markdown: string): string {
  return markdown
    .replace(/<details>[\s\S]*?<\/details>/gi, " ") // drop the English translation
    .replace(/<\/?[a-z][^>]*>/gi, " ") // any stray tags
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[\s>#*-]+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Choose the TTS locale: the selected voice language, unless a non-Latin voice
 *  language is set but the text is clearly Latin (an English answer). */
function pickSpeechLocale(text: string, voiceLang: string): string {
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  const latin = text.match(/[A-Za-z]/g)?.length ?? 0;
  const nonLatinRatio = letters > 0 ? 1 - latin / letters : 0;
  if (NON_LATIN_VOICE.has(voiceLang) && nonLatinRatio < 0.3) return "en-US";
  return SPEECH_LOCALES[voiceLang] ?? voiceLang;
}

/**
 * Client-only chat persistence. The last 20 turns are mirrored to localStorage
 * so the conversation survives reloads and navigation. This is purely a UX
 * convenience: the history is only ever sent to the same /api/guide/chat the
 * user is already talking to, and contains no secrets — it is not a security
 * concern for this single-workspace demo product.
 */
function loadHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isChatMessage).slice(-MAX_HISTORY);
  } catch {
    return [];
  }
}

function saveHistory(messages: ChatMessage[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-MAX_HISTORY)));
  } catch {
    // Ignore quota / private-mode failures — persistence is best-effort.
  }
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    (record.role === "user" || record.role === "assistant") &&
    typeof record.content === "string"
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l1.8 5.6L19 9.4l-5.2 1.8L12 17l-1.8-5.8L5 9.4l5.2-1.8z" />
      <path d="M19 14l.9 2.6L22.5 17l-2.6.9L19 20.5l-.9-2.6L15.5 17l2.6-.4z" opacity="0.7" />
    </svg>
  );
}

function MicIcon({ className }: { className?: string }) {
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
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
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
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4z" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function SpeakerIcon({ className }: { className?: string }) {
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
      <path d="M11 5L6 9H2v6h4l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

function SpeakerMuteIcon({ className }: { className?: string }) {
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
      <path d="M11 5L6 9H2v6h4l5 4z" />
      <path d="M22 9l-6 6" />
      <path d="M16 9l6 6" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function promptsForLang(code: string): string[] {
  return SUGGESTED_PROMPTS[code] ?? SUGGESTED_PROMPTS.en;
}

/** Compact searchable language dropdown for the voice-input locale. */
function VoiceLangSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const current = findLanguage(value) ?? findLanguage("en");

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    const timer = window.setTimeout(() => searchRef.current?.focus(), 30);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
    };
  }, [open]);

  const results = useMemo<Language[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.native.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-[200px] items-center gap-1.5 rounded-md border border-white/10 bg-[#1a1d2e] px-2 py-1 text-xs text-foreground transition-colors hover:border-white/20"
      >
        <span className="leading-none">{current?.flag}</span>
        <span className="truncate">{current?.name}</span>
        <ChevronIcon className="ml-auto size-3.5 text-muted-foreground" />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-lg border border-white/10 bg-[#0d0f1a] shadow-2xl">
          <div className="p-1.5">
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search languages…"
              className="w-full rounded-md border border-white/10 bg-[#1a1d2e] px-2 py-1 text-xs text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-56 overflow-y-auto px-1 pb-1">
            {results.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => {
                  onChange(lang.code);
                  setQuery("");
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-white/5",
                  lang.code === value && "bg-[#a78bfa]/10 text-[#c4b5fd]",
                )}
              >
                <span className="leading-none">{lang.flag}</span>
                <span className="text-foreground">{lang.name}</span>
                <span className="truncate text-muted-foreground">{lang.native}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Xeno Guide — the in-app Resonate assistant. A nav button (left of Copilot)
 * that opens a chat Sheet. Free-form markdown answers, localStorage history,
 * suggested prompts, and Web Speech voice input.
 */
export default function XenoGuide() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [voiceLang, setVoiceLang] = useState("en");
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);

  const controllerRef = useRef<AbortController | null>(null);
  const stopListeningRef = useRef<(() => void) | null>(null);
  const stopSpeakRef = useRef<(() => void) | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  // Mirror state into refs so the auto-speak effect (keyed on messages only)
  // reads current values without re-firing on every toggle.
  const autoSpeakRef = useRef(true);
  const voiceLangRef = useRef("en");
  const spokenRef = useRef(0); // index up to which messages have been auto-handled

  // Load persisted state on mount; default voice language to the page's
  // translation language (falls back to English).
  useEffect(() => {
    const loaded = loadHistory();
    setMessages(loaded);
    spokenRef.current = loaded.length; // don't auto-speak restored history
    const stored = (() => {
      try {
        return localStorage.getItem(VOICE_LANG_KEY);
      } catch {
        return null;
      }
    })();
    setVoiceLang(stored ?? getCurrentLang() ?? "en");
    const autoStored = (() => {
      try {
        return localStorage.getItem(AUTOSPEAK_KEY);
      } catch {
        return null;
      }
    })();
    setAutoSpeak(autoStored === null ? true : autoStored === "true");
    setHydrated(true);
  }, []);

  // Keep refs in sync for the auto-speak effect.
  useEffect(() => {
    autoSpeakRef.current = autoSpeak;
  }, [autoSpeak]);
  useEffect(() => {
    voiceLangRef.current = voiceLang;
  }, [voiceLang]);
  useEffect(() => {
    if (hydrated) {
      try {
        localStorage.setItem(AUTOSPEAK_KEY, String(autoSpeak));
      } catch {
        // best-effort
      }
    }
  }, [autoSpeak, hydrated]);

  // Auto-speak each newly-arrived assistant answer in the selected language.
  useEffect(() => {
    const lastIndex = messages.length - 1;
    if (lastIndex < spokenRef.current) return; // nothing new
    const last = messages[lastIndex];
    spokenRef.current = messages.length;
    if (!last || last.role !== "assistant" || last.error || !autoSpeakRef.current) {
      return;
    }
    const text = plainTextForSpeech(last.content);
    if (!text) return;
    stopSpeakRef.current?.();
    setSpeakingIndex(lastIndex);
    stopSpeakRef.current = speak(text, pickSpeechLocale(text, voiceLangRef.current), () =>
      setSpeakingIndex((cur) => (cur === lastIndex ? null : cur)),
    );
  }, [messages]);

  // Persist after hydration so we don't overwrite stored history with [].
  useEffect(() => {
    if (hydrated) saveHistory(messages);
  }, [messages, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(VOICE_LANG_KEY, voiceLang);
    } catch {
      // best-effort
    }
  }, [voiceLang, hydrated]);

  // Auto-scroll to the latest message (and the thinking indicator).
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  // Auto-focus the textarea when the panel opens.
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => textareaRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [open]);

  // Abort an in-flight turn / stop recognition on unmount.
  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
      stopListeningRef.current?.();
      cancelSpeech();
    };
  }, []);

  const toggleSpeak = (index: number, content: string) => {
    if (speakingIndex === index) {
      stopSpeakRef.current?.();
      cancelSpeech();
      setSpeakingIndex(null);
      return;
    }
    const text = plainTextForSpeech(content);
    if (!text) return;
    stopSpeakRef.current?.();
    setSpeakingIndex(index);
    stopSpeakRef.current = speak(text, pickSpeechLocale(text, voiceLangRef.current), () =>
      setSpeakingIndex((cur) => (cur === index ? null : cur)),
    );
  };

  const toggleAutoSpeak = () => {
    setAutoSpeak((prev) => {
      const next = !prev;
      if (!next) {
        cancelSpeech();
        setSpeakingIndex(null);
      }
      return next;
    });
  };

  const resizeTextarea = () => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 72)}px`; // ~3 rows
  };

  const send = (raw: string) => {
    const content = raw.trim();
    if (!content || pending) return;

    stopSpeakRef.current?.();
    cancelSpeech();
    setSpeakingIndex(null);

    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setDraft("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setPending(true);

    const controller = new AbortController();
    controllerRef.current = controller;

    const payload = next
      .slice(-MAX_HISTORY)
      .map(({ role, content: text }) => ({ role, content: text }));

    fetch("/api/guide/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: payload }),
      signal: controller.signal,
    })
      .then((res) => res.json() as Promise<{ reply: string }>)
      .then((data) => {
        if (controller.signal.aborted) return;
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || error instanceof DOMException) return;
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Something went wrong. Please try again.", error: true },
        ]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setPending(false);
      });
  };

  const toggleMic = () => {
    if (listening) {
      stopListeningRef.current?.();
      setListening(false);
      return;
    }
    if (!isSpeechRecognitionSupported()) {
      setVoiceError("Voice input isn't supported in this browser.");
      return;
    }
    setVoiceError(null);
    setListening(true);
    stopListeningRef.current = startSpeechRecognition(
      SPEECH_LOCALES[voiceLang] ?? voiceLang,
      (result) => {
        setDraft((prev) => (prev ? `${prev} ${result.transcript}` : result.transcript));
        window.setTimeout(resizeTextarea, 0);
      },
      (error) => {
        setVoiceError(
          error === "not-allowed" || error === "service-not-allowed"
            ? "Microphone permission denied."
            : "Couldn't capture audio — please try again.",
        );
        setListening(false);
      },
      () => setListening(false),
    );
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      controllerRef.current?.abort();
      stopListeningRef.current?.();
      cancelSpeech();
      setSpeakingIndex(null);
      setListening(false);
      setPending(false);
    }
    setOpen(nextOpen);
  };

  const clearChat = () => {
    cancelSpeech();
    setSpeakingIndex(null);
    spokenRef.current = 0;
    setMessages([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      // best-effort
    }
  };

  const prompts = promptsForLang(voiceLang);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <Button
        variant="ghost"
        size="sm"
        className="relative text-muted-foreground"
        onClick={() => setOpen(true)}
        title="Xeno Guide — your Resonate AI assistant"
      >
        <SparkleIcon className="size-4 text-[#a78bfa]" />
        Xeno Guide
        <span className="absolute -top-0.5 -right-0.5 size-2 animate-pulse rounded-full bg-emerald-400" />
      </Button>

      <SheetContent
        showCloseButton={false}
        className="flex w-full flex-col gap-0 bg-[#0d0f1a] p-0 sm:max-w-md"
      >
        <SheetHeader className="gap-2 border-b border-[#a78bfa]/20 p-4">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="flex items-center gap-2 text-white">
              <SparkleIcon className="size-4 text-[#a78bfa]" />
              Xeno Guide
            </SheetTitle>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleAutoSpeak}
                title={
                  autoSpeak
                    ? "Auto-speak answers: on"
                    : "Auto-speak answers: off"
                }
                aria-label="Toggle auto-speak"
                aria-pressed={autoSpeak}
                className="transition-colors hover:text-foreground"
              >
                {autoSpeak ? (
                  <SpeakerIcon className="size-4 text-[#a78bfa]" />
                ) : (
                  <SpeakerMuteIcon className="size-4 text-muted-foreground" />
                )}
              </button>
              {messages.length > 0 ? (
                <button
                  type="button"
                  onClick={clearChat}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Clear chat
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Your Resonate AI assistant</p>
          <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
            <span aria-hidden>🎙</span>
            <span>Voice language:</span>
            <VoiceLangSelect value={voiceLang} onChange={setVoiceLang} />
          </div>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Hi! I&apos;m <span className="font-medium text-foreground">Xeno Guide</span>. Ask me
                anything about Resonate — segments, campaigns, AI features, or analytics.
              </p>
              <div className="flex flex-col gap-2">
                {prompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setDraft(prompt)}
                    className="rounded-full border border-white/10 px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-white/5"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((message, index) => (
                <MessageBubble
                  key={index}
                  message={message}
                  speaking={speakingIndex === index}
                  onToggleSpeak={() => toggleSpeak(index, message.content)}
                />
              ))}
              {pending ? <ThinkingDots /> : null}
            </div>
          )}
        </div>

        <div className="border-t border-white/5 bg-[#1a1d2e] p-3">
          {voiceError ? (
            <p className="mb-2 text-xs text-destructive">{voiceError}</p>
          ) : null}
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={toggleMic}
              title={listening ? "Listening… speak now" : "Voice input"}
              aria-label="Voice input"
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors",
                listening
                  ? "animate-pulse border-red-500/50 bg-red-500/15 text-red-400"
                  : "border-white/10 text-muted-foreground hover:text-foreground",
              )}
            >
              <MicIcon className="size-4" />
            </button>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                resizeTextarea();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(draft);
                }
              }}
              rows={1}
              placeholder="Ask anything about Resonate…"
              className="max-h-[72px] min-h-9 flex-1 resize-none rounded-lg border border-white/10 bg-[#0d0f1a] px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-[#a78bfa]/50"
            />
            <button
              type="button"
              onClick={() => send(draft)}
              disabled={pending || draft.trim().length === 0}
              title="Send"
              aria-label="Send"
              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#a78bfa] text-[#0d0f1a] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <SendIcon className="size-4" />
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MessageBubble({
  message,
  speaking,
  onToggleSpeak,
}: {
  message: ChatMessage;
  speaking: boolean;
  onToggleSpeak: () => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm border border-[#a78bfa]/30 bg-[#a78bfa]/20 px-3 py-2 text-sm whitespace-pre-wrap text-foreground">
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start gap-1">
      <div
        className={cn(
          "max-w-[90%] rounded-2xl rounded-tl-sm border px-3 py-2",
          message.error
            ? "border-destructive/30 bg-destructive/10 text-destructive"
            : "border-white/5 bg-[#1a1d2e] text-foreground",
        )}
      >
        {message.error ? (
          <p className="text-sm">{message.content}</p>
        ) : (
          <GuideMarkdown text={message.content} />
        )}
      </div>
      {message.error ? null : (
        <button
          type="button"
          onClick={onToggleSpeak}
          title={speaking ? "Stop" : "Listen"}
          className={cn(
            "flex items-center gap-1 px-1 text-[11px] transition-colors",
            speaking
              ? "text-[#a78bfa]"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {speaking ? (
            <StopIcon className="size-3" />
          ) : (
            <SpeakerIcon className="size-3" />
          )}
          {speaking ? "Stop" : "Listen"}
        </button>
      )}
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-white/5 bg-[#1a1d2e] px-3 py-2.5">
        <span className="sr-only">Thinking…</span>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 animate-bounce rounded-full bg-[#a78bfa]"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
