/**
 * Page translation via the free Google Translate website widget (zero API cost,
 * no key). We inject the widget once, then drive it purely through the
 * `googtrans` cookie + a reload — the visible Google toolbar is hidden in CSS
 * (see globals.css). Pure browser utility: no React imports.
 *
 * Caveat: this is the unofficial element.js widget, not the paid Cloud
 * Translation API. It is best-effort and intended for the demo.
 */

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: {
      translate: {
        TranslateElement: new (
          options: { pageLanguage: string; autoDisplay?: boolean },
          element: string,
        ) => unknown;
      };
    };
  }
}

/** Inject the Google Translate script + hidden init div exactly once. */
export function injectGoogleTranslate(): void {
  if (document.getElementById("google_translate_element")) return;

  const div = document.createElement("div");
  div.id = "google_translate_element";
  div.style.display = "none";
  document.body.appendChild(div);

  window.googleTranslateElementInit = () => {
    if (!window.google) return;
    new window.google.translate.TranslateElement(
      { pageLanguage: "en", autoDisplay: false },
      "google_translate_element",
    );
  };

  const script = document.createElement("script");
  script.src =
    "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
  script.async = true;
  document.head.appendChild(script);
}

/**
 * Set the `googtrans` cookie and reload so the widget re-translates. Passing
 * `en` clears the cookie (resets to the original English page).
 */
export function translatePage(langCode: string): void {
  const expiry = new Date();
  expiry.setFullYear(expiry.getFullYear() + 1);

  if (langCode === "en") {
    document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/";
    document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${location.hostname}`;
    location.reload();
    return;
  }

  document.cookie = `googtrans=/en/${langCode}; expires=${expiry.toUTCString()}; path=/`;
  document.cookie = `googtrans=/en/${langCode}; expires=${expiry.toUTCString()}; path=/; domain=${location.hostname}`;
  location.reload();
}

/** Read the active target language from the cookie; defaults to `en`. */
export function getCurrentLang(): string {
  const match = document.cookie.match(/googtrans=\/en\/([^;]+)/);
  return match?.[1] ?? "en";
}
