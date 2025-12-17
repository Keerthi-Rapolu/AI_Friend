export type Intent =
  | { kind: "CALL"; contact?: string }
  | { kind: "EMAIL_DRAFT"; to?: string; subject?: string; about?: string }
  | { kind: "WHATSAPP_DRAFT"; to?: string; message?: string }
  | { kind: "FACT_ADD"; subject?: string; key: string; value: string }
  | { kind: "FACT_QUERY"; subject?: string; key?: string }
  | { kind: "MOOD"; mood: "happy"|"sad"|"angry"|"anxious"|"stressed"|"tired"|"lonely"; text: string }
  | { kind: "SMALLTALK"; text: string };

const CALL_RE  = /\b(call|dial|ring|phone)\b/i;
const EMAIL_RE = /\b(email|mail)\b/i;
const WA_RE    = /\b(whatsapp|wa msg|wa)\b/i;

function normalizeSubject(raw?: string) {
  if (!raw) return "me";
  const s = raw.trim().toLowerCase();
  if (["i", "me", "my", "myself"].includes(s)) return "me";
  return s.replace(/[.?!]+$/g, "").trim();
}
function slugKey(raw: string) {
  let k = raw.toLowerCase().trim();
  k = k.replace(/\bfavou?rite\b/g, "favorite").replace(/\bcolou?r\b/g, "color");
  k = k.replace(/\b(dob|birth\s*date)\b/g, "birthday").replace(/\b(mobile|telephone|phone number)\b/g, "phone");
  k = k.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return k || "value";
}
function cleanValue(v?: string) { return (v ?? "").replace(/[.,!?]\s*$/, "").trim(); }

const EMOTION_WORDS = /\b(sad|down|lonely|depressed|anxious|stressed|overwhelmed|upset|angry|mad|furious|tired|exhausted|happy|excited)\b/i;

export function parseIntent(text: string): Intent {
  const t = text.trim();

  // Emotions first (avoid treating "I am sad" as a name)
  const mFeel = t.match(/\b(i am|i'm|feeling|feel)\s+(?:really\s+|so\s+)?([a-z]+)\b/i);
  if (mFeel && EMOTION_WORDS.test(mFeel[2])) {
    const word = mFeel[2].toLowerCase();
    const mood =
      /happy|excited/.test(word) ? "happy" :
      /angry|mad|furious/.test(word) ? "angry" :
      /anxious|stressed|overwhelmed|upset/.test(word) ? "anxious" :
      /tired|exhausted/.test(word) ? "tired" :
      /lonely/.test(word) ? "lonely" : "sad";
    return { kind: "MOOD", mood, text: t };
  }

  if (CALL_RE.test(t)) {
    const m = t.match(/(?:call|dial|ring|phone)\s+(.+)/i);
    return { kind: "CALL", contact: m?.[1]?.replace(/[.,!?]/g, "").trim() };
  }
  if (EMAIL_RE.test(t)) {
    const mTo  = t.match(/(?:email|mail)\s+(?:to\s+)?([^\s]+)?/i);
    const mSub = t.match(/(?:about|subject)\s+(.+)/i);
    return { kind: "EMAIL_DRAFT", to: mTo?.[1]?.replace(/[.,!?]/g, ""), subject: mSub?.[1], about: mSub?.[1] };
  }
  if (WA_RE.test(t)) {
    const mTo  = t.match(/(?:whatsapp|wa)\s+(?:to\s+)?([^\s]+)?/i);
    const mMsg = t.match(/(?:say|message|text)\s+(.+)/i);
    return { kind: "WHATSAPP_DRAFT", to: mTo?.[1], message: mMsg?.[1] };
  }

  // "<Name>'s <key> is <value>"
  let m = t.match(/([A-Za-z][\w .'-]{0,40})'s\s+([a-z][a-z\s\-]+?)\s*(?:is|=)\s*(.+)$/i);
  if (m) return { kind: "FACT_ADD", subject: normalizeSubject(m[1]), key: slugKey(m[2]), value: cleanValue(m[3]) };

  // "set <subject> <key> to <value>"
  m = t.match(/(?:set|save|remember)\s+([A-Za-z][\w .'-]{0,40})\s+([a-z][a-z\s\-]+?)\s*(?:to|=)\s*(.+)$/i);
  if (m) return { kind: "FACT_ADD", subject: normalizeSubject(m[1]), key: slugKey(m[2]), value: cleanValue(m[3]) };

  // "my <key> is <value>"
  m = t.match(/\bmy\s+([a-z][a-z\s\-]+?)\s*(?:is|=)\s*(.+)$/i);
  if (m) return { kind: "FACT_ADD", subject: "me", key: slugKey(m[1]), value: cleanValue(m[2]) };

  // Name shortcuts — deliberately exclude "i am"/"i'm" (they cause false positives)
  m = t.match(/\b(?:my name is|call me)\s+([A-Za-z][\w .'-]{0,40})\b/i);
  if (m && !EMOTION_WORDS.test(m[1])) return { kind: "FACT_ADD", subject: "me", key: "name", value: cleanValue(m[1]) };

  // Queries
  m = t.match(/\bwhat(?:'s| is)?\s+my\s+([a-z][a-z\s\-]+)\b/i);
  if (m) return { kind: "FACT_QUERY", subject: "me", key: slugKey(m[1]) };
  m = t.match(/\bwhat(?:'s| is)?\s+([A-Za-z][\w .'-]{0,40})'s\s+([a-z][a-z\s\-]+)\b/i);
  if (m) return { kind: "FACT_QUERY", subject: normalizeSubject(m[1]), key: slugKey(m[2]) };
  m = t.match(/\bwhat.*remember(?:\s+about\s+([A-Za-z][\w .'-]{0,40}))?/i);
  if (m) return { kind: "FACT_QUERY", subject: normalizeSubject(m[1]) };

  return { kind: "SMALLTALK", text: t };
}
