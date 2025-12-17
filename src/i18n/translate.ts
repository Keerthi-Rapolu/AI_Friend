import { flags } from "../config";
export async function maybeTranslateOut(text: string) {
  if (!flags.enableTranslate || !flags.targetLang || flags.targetLang === "en") return text;
  try {
    const r = await fetch(`https://libretranslate.de/translate`, {
      method:"POST",
      headers:{ "content-type":"application/json" },
      body: JSON.stringify({ q: text, source:"en", target: flags.targetLang, format:"text" })
    });
    const j = await r.json(); return j?.translatedText ?? text;
  } catch { return text; }
}
