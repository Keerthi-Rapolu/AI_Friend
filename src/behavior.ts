// src/behavior.ts
import { askLocal } from "./llm";
import {
  getAllFacts, getFactsByKey, getTemplates,
  recordTemplateUse, recentOpeners, setUsage, getUsage
} from "./memory";

export type Mood = "happy" | "sad" | "angry" | "neutral";

export const PLAYBOOKS: Record<string, { validate: string[]; ask: string[]; action: string[]; optout: string[] }> = {
  sad: {
    validate: ["That sounds really heavy.", "I’m sorry you’re going through that."],
    ask: ["What part feels toughest right now?"],
    action: ["Want a tiny step—like a 2-minute break?"],
    optout: ["If you’d rather skip it, that’s okay too."]
  },
  stressed: {
    validate: ["Totally get why that’s overwhelming."],
    ask: ["Is it the deadline or the uncertainty that’s tougher?"],
    action: ["We can list 3 items and pick one small win."],
    optout: ["Say the word if you prefer a distraction instead."]
  },
  happy: {
    validate: ["Love that for you!", "That’s awesome!"],
    ask: ["What made it click?"],
    action: ["Want me to note this as a highlight?"],
    optout: ["Or we can just enjoy the moment and move on!"]
  }
};

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

export function dayPart() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

function firstSentence(s: string) {
  const clean = String(s || "").replace(/\s+/g, " ").trim();
  const sent = clean.split(/(?<=[.!?])\s+/)[0] || clean;
  return sent;
}

function oneSentence(s: string, maxWords = 25) {
  const sent = firstSentence(s);
  const words = sent.split(/\s+/);
  if (words.length <= maxWords) return sent;
  return words.slice(0, maxWords).join(" ").replace(/[,:;]$/, "") + "…";
}

export type DraftCtx = {
  locale: string;
  mood: Mood;
  signal?: { festival?: string };
  avoidOpeners?: string[]; // new
};

export async function buildDraft(kind: string, ctx: DraftCtx) {
  const templates = await getTemplates(kind, ctx.locale);
  const avoidIds = (await getUsage(`last_${kind}_ids`))?.split(",").filter(Boolean) ?? [];

  // avoid recently used *openers* too
  const avoidSet = new Set((ctx.avoidOpeners ?? []).map(s => s.toLowerCase().trim()));

  const filtered = templates.filter(t => {
    if (avoidIds.includes(String(t.id))) return false;
    const opener = firstSentence(t.text).toLowerCase().trim();
    return !avoidSet.has(opener);
  });

  const pool = filtered.length ? filtered : templates;
  const chosen = pool[Math.floor(Math.random() * pool.length)];

  // rotate last 3 ids
  const updated = [String(chosen.id)].concat(avoidIds).slice(0, 3).join(",");
  await setUsage(`last_${kind}_ids`, updated);
  await recordTemplateUse(kind, chosen.id);

  const name = getFactsByKey("name")?.[0]?.v ?? "there";
  const filled = chosen.text
    .replace("{name}", name)
    .replace("{day_part}", dayPart())
    .replace("{festival}", ctx.signal?.festival ?? "");

  return { text: filled, opener: firstSentence(filled) };
}

export async function composeHumanReply(userText: string, opts: {
  mood: Mood;
  kind: "greeting" | "checkin" | "birthday" | "festival" | "smalltalk";
  locale?: string;
  headline?: string | null;
}) {
  const locale = opts.locale ?? "en";
  const avoidOpeners = await recentOpeners(7);

  const draft = await buildDraft(
    opts.kind === "greeting" ? "greeting"
      : opts.kind === "birthday" ? "birthday"
      : opts.kind === "festival" ? "festival"
      : "checkin",
    { mood: opts.mood, locale, avoidOpeners }
  );

  const persona = (getFactsByKey("style")?.[0]?.v as any) || "friendly";
  const guidance =
    persona === "funny"   ? "a touch of playful humor" :
    persona === "caring"  ? "gentle warmth" :
    persona === "serious" ? "calm, professional clarity" : "warm and natural";

  const facts = getAllFacts(8).map(f => `${f.k}=${f.v}`).join("; ");
  const play = PLAYBOOKS[opts.mood] || ({} as any);

  // Strong system guard → EXACTLY ONE SENTENCE
  const sys =
`You are a considerate, succinct companion.
Return ONE sentence only (≤ ~25 words). No second sentence, no fragments after a period.
Be warm and specific. Vary openings and avoid ones used recently.
Respect boundaries in facts (e.g., block_checkins=true).
Never claim internet access; no medical/legal claims.
Style today: ${guidance}.
Known user facts: ${facts || "(none)"}.
Avoid openings: ${JSON.stringify(avoidOpeners)}.`;

  const prompt = [
    `User said: "${userText}"`,
    `Refine this draft but keep its intent: "${draft.text}"`,
    opts.headline ? `Optional headline to weave in: ${opts.headline}` : undefined,
    `Mood: ${opts.mood}`,
    `Playbook: ${JSON.stringify(play)}`
  ].filter(Boolean).join("\n");

  const raw = await askLocal(prompt, { system: sys, maxTokens: 80, temperature: 0.7 });

  // Post-guard: ensure single sentence & short
  const finalText = oneSentence(String(raw), 25);

  // record opener text (first clause) for the “avoid recent openers” feature
  await setUsage("last_opener_text", finalText.split(/[.!?]/)[0].slice(0, 80));

  // If the model somehow returned empty, fall back to the draft’s first sentence
  return finalText || oneSentence(draft.text, 25);
}
