"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Send, Sparkles } from "lucide-react";
import type { Channel } from "@resonate/shared";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { describeRules } from "@/lib/segment-describe";
import type { SegmentListItem } from "@/server/segments/listSegments";

// ── Endpoint contracts (server routes built in parallel) ─────────────────
// POST /api/ai/draft-messages
type DraftVariant = { label: string; text: string };
type DraftMessagesResponse = { variants: DraftVariant[]; degraded: boolean };
// POST /api/campaigns/render-preview
type RenderPreviewResponse = {
  rendered: string;
  sample: { name: string; city: string } | null;
};
// POST /api/campaigns → full Campaign row; we only rely on its id.
type CreatedCampaign = { id: string };

const CHANNELS: Channel[] = ["WHATSAPP", "SMS", "EMAIL", "RCS"];
const CHANNEL_LABELS: Record<Channel, string> = {
  WHATSAPP: "WhatsApp",
  SMS: "SMS",
  EMAIL: "Email",
  RCS: "RCS",
};
const MERGE_FIELDS = [
  "{{first_name}}",
  "{{city}}",
  "{{last_order_days_ago}}",
  "{{total_spend_rupees}}",
];
const SMS_LIMIT = 160;
const PREVIEW_DEBOUNCE_MS = 400;

type SegmentsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; segments: SegmentListItem[] };

type Step = 1 | 2 | 3;

const STEPS: { step: Step; label: string }[] = [
  { step: 1, label: "Audience" },
  { step: 2, label: "Message" },
  { step: 3, label: "Review" },
];

export function NewCampaignFlow({ initialSegmentId }: { initialSegmentId: string | null }) {
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);

  // Step 1 — Audience
  const [segmentsState, setSegmentsState] = useState<SegmentsState>({ status: "loading" });
  const [segmentsReloadKey, setSegmentsReloadKey] = useState(0);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const preselectedRef = useRef(false);

  // Step 2 — Message
  const [channel, setChannel] = useState<Channel>("WHATSAPP");
  const [objective, setObjective] = useState("");
  const [brandVoice, setBrandVoice] = useState("warm, premium, concise");
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftDegraded, setDraftDegraded] = useState(false);
  const [variants, setVariants] = useState<DraftVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [messageTemplate, setMessageTemplate] = useState("");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);

  // Step 3 — Send
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const selectedSegment = useMemo(() => {
    if (segmentsState.status !== "loaded" || !selectedSegmentId) {
      return null;
    }
    return segmentsState.segments.find((s) => s.id === selectedSegmentId) ?? null;
  }, [segmentsState, selectedSegmentId]);

  const audienceDescription = useMemo(
    () => (selectedSegment ? describeRules(selectedSegment.rules) : ""),
    [selectedSegment],
  );

  // Suggested campaign name follows the selected segment until the user edits it.
  const effectiveName = nameTouched ? name : selectedSegment?.name ?? "";

  // Load segments on mount.
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setSegmentsState({ status: "loading" });
    fetch("/api/segments", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Request failed (${res.status})`);
        }
        return (await res.json()) as { segments: SegmentListItem[] };
      })
      .then((data) => {
        if (!cancelled) {
          setSegmentsState({ status: "loaded", segments: data.segments });
        }
      })
      .catch((error: unknown) => {
        if (cancelled || controller.signal.aborted) {
          return;
        }
        setSegmentsState({
          status: "error",
          message: error instanceof Error ? error.message : "Failed to load segments.",
        });
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [segmentsReloadKey]);

  // Preselect from ?segment= once, if it matches a loaded segment.
  useEffect(() => {
    if (preselectedRef.current || segmentsState.status !== "loaded") {
      return;
    }
    preselectedRef.current = true;
    if (initialSegmentId && segmentsState.segments.some((s) => s.id === initialSegmentId)) {
      setSelectedSegmentId(initialSegmentId);
    }
  }, [segmentsState, initialSegmentId]);

  // Live preview: debounced render of the template for the selected segment.
  const [preview, setPreview] = useState<RenderPreviewResponse | null>(null);
  useEffect(() => {
    if (!selectedSegmentId || messageTemplate.trim().length === 0) {
      setPreview(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch("/api/campaigns/render-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segmentId: selectedSegmentId, template: messageTemplate }),
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) {
            throw new Error(`Preview failed (${res.status})`);
          }
          return (await res.json()) as RenderPreviewResponse;
        })
        .then((data) => setPreview(data))
        .catch((error: unknown) => {
          if (!controller.signal.aborted && !(error instanceof DOMException)) {
            setPreview(null);
          }
        });
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [selectedSegmentId, messageTemplate]);

  const handleDraft = async () => {
    if (!selectedSegment || drafting) {
      return;
    }
    setDrafting(true);
    setDraftError(null);
    try {
      const res = await fetch("/api/ai/draft-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objective,
          audienceDescription,
          channel,
          brandVoice,
        }),
      });
      if (!res.ok) {
        throw new Error(`Draft failed (${res.status})`);
      }
      const data = (await res.json()) as DraftMessagesResponse;
      setVariants(data.variants);
      setDraftDegraded(data.degraded);
    } catch (error: unknown) {
      setDraftError(error instanceof Error ? error.message : "AI draft failed.");
    } finally {
      setDrafting(false);
    }
  };

  const selectVariant = (variant: DraftVariant) => {
    setSelectedVariant(variant.label);
    setMessageTemplate(variant.text);
  };

  const handleSend = async () => {
    if (!selectedSegment || sending || messageTemplate.trim().length === 0) {
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      const createRes = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: effectiveName.trim(),
          objective: objective.trim() || undefined,
          segmentId: selectedSegment.id,
          channel,
          messageTemplate,
          variantMeta: variants.length
            ? { variants, brandVoice, objective }
            : undefined,
        }),
      });
      if (!createRes.ok) {
        throw new Error(`Create failed (${createRes.status})`);
      }
      const campaign = (await createRes.json()) as CreatedCampaign;

      const sendRes = await fetch(`/api/campaigns/${campaign.id}/send`, { method: "POST" });
      if (!sendRes.ok) {
        throw new Error(`Send failed (${sendRes.status})`);
      }
      router.push(`/campaigns/${campaign.id}`);
    } catch (error: unknown) {
      setSendError(error instanceof Error ? error.message : "Something went wrong.");
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <Stepper current={step} />

      {step === 1 && (
        <AudienceStep
          state={segmentsState}
          selectedId={selectedSegmentId}
          onSelect={setSelectedSegmentId}
          onRetry={() => setSegmentsReloadKey((k) => k + 1)}
          onContinue={() => setStep(2)}
        />
      )}

      {step === 2 && selectedSegment && (
        <MessageStep
          channel={channel}
          onChannelChange={setChannel}
          objective={objective}
          onObjectiveChange={setObjective}
          brandVoice={brandVoice}
          onBrandVoiceChange={setBrandVoice}
          drafting={drafting}
          draftError={draftError}
          draftDegraded={draftDegraded}
          variants={variants}
          selectedVariant={selectedVariant}
          onDraft={handleDraft}
          onSelectVariant={selectVariant}
          messageTemplate={messageTemplate}
          onMessageTemplateChange={setMessageTemplate}
          preview={preview}
          name={effectiveName}
          onNameChange={(value) => {
            setNameTouched(true);
            setName(value);
          }}
          onBack={() => setStep(1)}
          onContinue={() => setStep(3)}
        />
      )}

      {step === 3 && selectedSegment && (
        <ReviewStep
          segment={selectedSegment}
          channel={channel}
          name={effectiveName}
          objective={objective}
          messageTemplate={messageTemplate}
          preview={preview}
          sending={sending}
          sendError={sendError}
          onBack={() => setStep(2)}
          onSend={handleSend}
        />
      )}
    </div>
  );
}

// ── Stepper ───────────────────────────────────────────────────────────────
function Stepper({ current }: { current: Step }) {
  return (
    <ol className="flex items-center gap-3 text-sm">
      {STEPS.map((item, index) => {
        const active = item.step === current;
        const done = item.step < current;
        return (
          <li key={item.step} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border text-xs font-medium tabular-nums transition-colors",
                  active || done
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/60 text-muted-foreground",
                )}
              >
                {item.step}
              </span>
              <span className={cn(active || done ? "text-foreground" : "text-muted-foreground")}>
                {item.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <span aria-hidden className="h-px w-8 bg-border" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ── Step 1: Audience ────────────────────────────────────────────────────
function AudienceStep({
  state,
  selectedId,
  onSelect,
  onRetry,
  onContinue,
}: {
  state: SegmentsState;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRetry: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-lg">Choose an audience</h2>
        <p className="text-sm text-muted-foreground">
          Pick a saved segment — its rules define who this campaign reaches.
        </p>
      </div>

      {state.status === "loading" && (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      )}

      {state.status === "error" && (
        <div className="rounded-lg border border-border/60 p-10 text-center">
          <p className="text-sm text-muted-foreground">{state.message}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}

      {state.status === "loaded" && state.segments.length === 0 && (
        <div className="rounded-lg border border-dashed border-border/60 p-12 text-center">
          <p className="text-sm text-muted-foreground">No segments yet. Create one first.</p>
          <Link href="/segments/new" className={cn(buttonVariants({ size: "sm" }), "mt-4")}>
            Create a segment
          </Link>
        </div>
      )}

      {state.status === "loaded" && state.segments.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {state.segments.map((segment) => {
            const selected = segment.id === selectedId;
            return (
              <button
                key={segment.id}
                type="button"
                onClick={() => onSelect(segment.id)}
                aria-pressed={selected}
                className={cn(
                  "rounded-xl text-left outline-none transition-shadow focus-visible:ring-3 focus-visible:ring-ring/50",
                )}
              >
                <Card
                  className={cn(
                    "h-full transition-colors",
                    selected ? "ring-2 ring-primary" : "hover:ring-foreground/20",
                  )}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">{segment.name}</CardTitle>
                      {segment.createdByAi && (
                        <Badge variant="secondary" className="gap-1">
                          <Sparkles className="size-3" /> AI
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {describeRules(segment.rules)}
                    </p>
                    <span className="text-sm tabular-nums">
                      <span className="font-medium">
                        {segment.lastPreviewCount === null
                          ? "—"
                          : formatNumber(segment.lastPreviewCount)}
                      </span>{" "}
                      <span className="text-muted-foreground">customers</span>
                    </span>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={onContinue} disabled={!selectedId}>
          Continue
        </Button>
      </div>
    </div>
  );
}

// ── Step 2: Message ─────────────────────────────────────────────────────
function MessageStep({
  channel,
  onChannelChange,
  objective,
  onObjectiveChange,
  brandVoice,
  onBrandVoiceChange,
  drafting,
  draftError,
  draftDegraded,
  variants,
  selectedVariant,
  onDraft,
  onSelectVariant,
  messageTemplate,
  onMessageTemplateChange,
  preview,
  name,
  onNameChange,
  onBack,
  onContinue,
}: {
  channel: Channel;
  onChannelChange: (channel: Channel) => void;
  objective: string;
  onObjectiveChange: (value: string) => void;
  brandVoice: string;
  onBrandVoiceChange: (value: string) => void;
  drafting: boolean;
  draftError: string | null;
  draftDegraded: boolean;
  variants: DraftVariant[];
  selectedVariant: string | null;
  onDraft: () => void;
  onSelectVariant: (variant: DraftVariant) => void;
  messageTemplate: string;
  onMessageTemplateChange: (value: string) => void;
  preview: RenderPreviewResponse | null;
  name: string;
  onNameChange: (value: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const charCount = messageTemplate.length;
  const overLimit = channel === "SMS" && charCount > SMS_LIMIT;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-lg">Craft the message</h2>
        <p className="text-sm text-muted-foreground">
          Set the channel and objective, draft with AI, then refine.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="channel">Channel</Label>
          <Select value={channel} onValueChange={(value) => onChannelChange(value as Channel)}>
            <SelectTrigger id="channel" aria-label="Channel" className="h-8 w-full">
              {CHANNEL_LABELS[channel]}
            </SelectTrigger>
            <SelectContent>
              {CHANNELS.map((c) => (
                <SelectItem key={c} value={c}>
                  {CHANNEL_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="objective">Objective</Label>
          <Input
            id="objective"
            value={objective}
            onChange={(e) => onObjectiveChange(e.target.value)}
            placeholder="win them back with 15% off"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="brand-voice">Brand voice</Label>
          <Input
            id="brand-voice"
            value={brandVoice}
            onChange={(e) => onBrandVoiceChange(e.target.value)}
            placeholder="warm, premium, concise"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="campaign-name">Campaign name</Label>
          <Input
            id="campaign-name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Campaign name"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-copper/30 bg-copper/5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-copper">
            <Sparkles className="size-4" /> Let AI draft three options
          </div>
          <Button size="sm" onClick={onDraft} disabled={drafting}>
            <Sparkles className="size-3.5" />
            {drafting ? "Drafting…" : "Draft 3 with AI"}
          </Button>
        </div>

        {draftError && <p className="text-sm text-destructive">{draftError}</p>}
        {draftDegraded && variants.length > 0 && (
          <p className="text-sm text-muted-foreground">
            AI is unavailable — here&apos;s a starting point you can edit.
          </p>
        )}

        {variants.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-3">
            {variants.map((variant) => {
              const selected = variant.label === selectedVariant;
              return (
                <button
                  key={variant.label}
                  type="button"
                  onClick={() => onSelectVariant(variant)}
                  aria-pressed={selected}
                  className={cn(
                    "flex flex-col gap-2 rounded-lg border bg-background p-3 text-left text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                    selected ? "border-primary ring-2 ring-primary" : "border-border/60 hover:border-foreground/30",
                  )}
                >
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {variant.label}
                  </span>
                  <span className="line-clamp-4 whitespace-pre-wrap text-foreground">
                    {variant.text}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="message">Message</Label>
        <Textarea
          id="message"
          value={messageTemplate}
          onChange={(e) => onMessageTemplateChange(e.target.value)}
          rows={5}
          placeholder="Hi {{first_name}}, we miss you in {{city}}…"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            Merge fields:{" "}
            <span className="font-mono">{MERGE_FIELDS.join(" · ")}</span>
          </span>
          {channel === "SMS" && (
            <span className={cn("tabular-nums", overLimit && "text-destructive")}>
              {charCount}/{SMS_LIMIT}
            </span>
          )}
        </div>
      </div>

      {messageTemplate.trim().length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Preview</span>
          <div className="rounded-2xl border bg-secondary/40 px-4 py-3">
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {preview ? preview.rendered : messageTemplate}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {preview?.sample
              ? `Preview for ${preview.sample.name} · ${preview.sample.city}`
              : "No matching customer"}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onContinue} disabled={messageTemplate.trim().length === 0}>
          Continue
        </Button>
      </div>
    </div>
  );
}

// ── Step 3: Review & send ─────────────────────────────────────────────────
function ReviewStep({
  segment,
  channel,
  name,
  objective,
  messageTemplate,
  preview,
  sending,
  sendError,
  onBack,
  onSend,
}: {
  segment: SegmentListItem;
  channel: Channel;
  name: string;
  objective: string;
  messageTemplate: string;
  preview: RenderPreviewResponse | null;
  sending: boolean;
  sendError: string | null;
  onBack: () => void;
  onSend: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-lg">Review &amp; send</h2>
        <p className="text-sm text-muted-foreground">
          Confirm the details, then send to your audience.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{name || "Untitled campaign"}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
            <Badge variant="outline">{channel}</Badge>
            <span>{segment.name}</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">
              {segment.lastPreviewCount === null
                ? "—"
                : formatNumber(segment.lastPreviewCount)}{" "}
              customers
            </span>
            {objective.trim() && (
              <>
                <span aria-hidden>·</span>
                <span className="italic">{objective.trim()}</span>
              </>
            )}
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Preview</span>
            <div className="rounded-2xl border bg-secondary/40 px-4 py-3">
              <p className="whitespace-pre-wrap text-sm text-foreground">
                {preview ? preview.rendered : messageTemplate}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {preview?.sample
                ? `Preview for ${preview.sample.name} · ${preview.sample.city}`
                : "No matching customer"}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Template</span>
            <pre className="overflow-x-auto rounded-lg border border-border/60 bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap text-muted-foreground">
              {messageTemplate}
            </pre>
          </div>
        </CardContent>
      </Card>

      {sendError && <p className="text-sm text-destructive">{sendError}</p>}

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack} disabled={sending}>
          Back
        </Button>
        <Button onClick={onSend} disabled={sending}>
          <Send className="size-4" />
          {sending ? "Sending…" : "Create & send"}
        </Button>
      </div>
    </div>
  );
}
