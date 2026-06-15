/**
 * Thin wrapper over the browser Web Speech *synthesis* API (text-to-speech) —
 * zero cost, no key, no dependency. Pure utility: no React imports. Used by
 * Xeno Guide to read answers aloud in the user's language.
 *
 * SpeechSynthesisUtterance / SpeechSynthesisVoice are part of the standard DOM
 * lib, so no custom types are needed here.
 */

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Best matching installed voice for a BCP-47 locale (exact, then base lang). */
function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const target = lang.toLowerCase();
  const base = target.split("-")[0];
  return (
    voices.find((v) => v.lang.toLowerCase() === target) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(base))
  );
}

/**
 * Speak `text` in `lang`. Cancels any in-progress speech first. Returns a stop
 * function. `onEnd` fires when speech finishes, errors, or is stopped.
 */
export function speak(text: string, lang: string, onEnd?: () => void): () => void {
  if (!isSpeechSynthesisSupported() || text.trim().length === 0) {
    onEnd?.();
    return () => {};
  }

  const synth = window.speechSynthesis;
  synth.cancel(); // never stack utterances

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  const voice = pickVoice(lang);
  if (voice) utterance.voice = voice;
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();

  // Voice list can load lazily; speaking still works (engine uses lang default),
  // and a late-arriving exact voice is applied on the next call.
  synth.speak(utterance);

  return () => {
    utterance.onend = null;
    utterance.onerror = null;
    synth.cancel();
  };
}

/** Stop any in-progress speech. */
export function cancelSpeech(): void {
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
}
