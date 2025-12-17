// src/quickReplies.ts
import { askLocal } from "./llm";

export type QuickReply = { text: string };

type Ctx = {
  channel: "sms" | "whatsapp" | "email";
  lastTwo?: { from: "me" | "them"; text: string }[]; // optional
  starter?: "hi" | "thanks" | "confirm" | "followup";
  max?: number; // optional in type
};

export async function suggestReplies(
  { channel, lastTwo = [], starter, max = 3 }: Ctx // defaults here
) {
  const history = lastTwo
    .map(m => `${m.from === "me" ? "Me" : "Them"}: ${m.text}`)
    .join(" | ");

  const sys = `
You suggest 1–3 short, polite replies (max ~12 words).
Keep it simple. Prefer one-tap friendly options. Avoid emojis unless casual is explicit.
Channel: ${channel}. Conversation: ${history || "(new chat)"}.
If completely new chat, include one warm "Hi ..." opener.
${starter ? "Seed tone: " + starter : ""}`.trim();

  const res = await askLocal("Suggest quick replies only.", {
    system: sys,
    maxTokens: 120,
    temperature: 0.7,
  });

  const picks = res
    .split(/\n|•|-/)
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, max);

  return picks.map(text => ({ text }));
}
