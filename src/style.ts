// src/style.ts
import { askLocal } from "./llm";

export type ComposeOpts = {
  facts?: string;
  recentPairs?: { user_text: string; bot_text: string }[];
  sarcasmLevel?: "off" | "low" | "med";
  persona?: "friendly" | "serious" | "caring" | "funny";
  headline?: string | null;
  draft?: string;            // NEW: prefilled template text
  avoidOpeners?: string[];   // NEW: to avoid recent openers
  mood?: "happy" | "sad" | "angry" | "neutral";
};

function keepShort(s: string, max = 1) {
  const cleaned = s.replace(/\s+/g, " ").trim();
  return cleaned.split(/(?<=[.!?])\s+/).slice(0, max).join(" ");
}

export async function composeReply(userText: string, opts: ComposeOpts = {}): Promise<string> {
  const persona = opts.persona ?? "friendly";
  const guidance =
    persona === "funny" ? "a touch of playful humor" :
    persona === "caring" ? "gentle warmth" :
    persona === "serious" ? "calm, professional clarity" : "warm and natural";

  const sys = `
You are "Nova", a supportive AI friend on a phone.
- 1–2 sentences, concise.
- Vary phrasing; avoid stock lines and openings recently used.
- Offer to search first; fetch only after user says "more" or "search".
- Use memory lightly, never invent facts. Be extra kind if mood is negative.
Style today: ${guidance}.
Known user facts: ${opts.facts || "(none)"}.
Recent messages: ${opts.recentPairs?.map(p => `U:${p.user_text} / A:${p.bot_text}`).join(" | ") || "(none)"}.
Avoid openings: ${JSON.stringify(opts.avoidOpeners ?? [])}.
Mood: ${opts.mood ?? "neutral"}.
`;

  const prompt = [
    `User said: "${userText}"`,
    opts.headline ? `Optional headline: ${opts.headline}` : undefined,
    opts.draft ? `Draft to refine: "${opts.draft}"` : undefined,
    `Constraint: return only the final message, max 2 sentences.`
  ].filter(Boolean).join("\n");

  const raw = await askLocal(prompt, { system: sys, maxTokens: 100, temperature: 0.75 });
  return keepShort(String(raw), 1);
}

export function detectMood(text: string): "happy"|"sad"|"angry"|"neutral" {
  const t = text.toLowerCase();
  if (/(happy|great|awesome|excited|good day)/.test(t)) return "happy";
  if (/(sad|rough day|down|tired|stressed|overwhelmed|anxious)/.test(t)) return "sad";
  if (/(angry|mad|furious|annoyed)/.test(t)) return "angry";
  return "neutral";
}