// src/intent_router.ts
import type { Task } from "./skills";
import { resolveAppIdByAlias } from "./skills";
import { parseFlightFromUtterance } from "./nlp";

function extractAppHint(t: string): string | undefined {
  const m = t.match(/\b(?:in|on)\s+(?:the\s+)?([a-z][\w\s.&+-]{1,30})\b/i);
  if (!m) return;
  return resolveAppIdByAlias(m[1]) || m[1];
}

// ✅ make this generic over Task so returns fit your union
function withAppHint<T extends Task>(task: T | null, text: string): T | null {
  if (!task) return null as any;
  const appId = extractAppHint(text);
  if (appId) (task as any).appId = appId;
  return task;
}

const maybe = (s?: string) => (s && s.trim()) || undefined;
const onlyDigitsPlus = (s: string) => s.replace(/[^\d+]/g, "");
const DATE_PHRASE = /\b(?:today|tomorrow|day after|on\s+\w+\s+\d{1,2}|on\s+\d{4}-\d{2}-\d{2}|\d{1,2}\s*(?:am|pm))\b/i;

/** Parse a user utterance into a Task skeleton (async because NLP may load). */
export async function parseTask(text: string): Promise<Task | null> {
  const t = text.trim();

  // ---- CALL
  if (/^call\b/i.test(t)) {
    const who = t.replace(/^call\b/i, "").trim();
    const digits = onlyDigitsPlus(who);
    return /^\+?\d{5,}$/.test(digits)
      ? { kind: "CALL", phone: digits }
      : { kind: "CALL", contactName: who || undefined };
  }

  // ---- SMS
  if (/^(text|message|sms)\b/i.test(t)) {
    const rest = t.replace(/^(text|message|sms)\b/i, "").trim();
    const msgInQuotes = rest.match(/"([^"]+)"/)?.[1] ?? rest.match(/'([^']+)'/)?.[1];
    const afterSay = rest.match(/\b(say|message|text)\s+(.+)$/i)?.[2];
    const content = msgInQuotes || afterSay || "";
    const toPart = rest.replace(/(".*?"|'.*?'|\b(say|message|text)\s+.+)$/i, "").trim();
    const digits = onlyDigitsPlus(toPart);
    return /^\+?\d{5,}$/.test(digits)
      ? { kind: "SMS", phone: digits, text: content }
      : { kind: "SMS", contactName: toPart || undefined, text: content };
  }

  // ---- WHATSAPP
  if (/^whatsapp\b/i.test(t)) {
    const rest = t.replace(/^whatsapp\b/i, "").trim();
    const msgInQuotes = rest.match(/"([^"]+)"/)?.[1] ?? rest.match(/'([^']+)'/)?.[1];
    const afterSay = rest.match(/\b(say|message|text)\s+(.+)$/i)?.[2];
    const content = msgInQuotes || afterSay || "";
    const toPart = rest.replace(/(".*?"|'.*?'|\b(say|message|text)\s+.+)$/i, "").trim();
    const digits = onlyDigitsPlus(toPart);
    return /^\+?\d{5,}$/.test(digits)
      ? { kind: "WHATSAPP", phone: digits, text: content }
      : { kind: "WHATSAPP", contactName: toPart || undefined, text: content };
  }

  // ---- EMAIL
  if (/^email\b|^mail\b/i.test(t)) {
    const to = t.match(/\bto\s+([^\s"']+)/i)?.[1];
    const subject = t.match(/\bsubject\s+([^"']+)/i)?.[1];
    const body = t.match(/\b(say|body)\s+(.+)$/i)?.[2];
    return { kind: "EMAIL", to: maybe(to), subject: maybe(subject), body: maybe(body) };
  }

  // ---- FOOD / GROCERY / SHOP
  if (/^(order|food)\b/i.test(t))
    return withAppHint({ kind: "FOOD_ORDER", query: t.replace(/^(order|food)\s*/i, "").trim() || "food" } as Task, t);

  if (/^(grocery|groceries)\b/i.test(t))
    return withAppHint({ kind: "GROCERY_ORDER", query: t.replace(/^(grocery|groceries)\s*/i, "").trim() || "groceries" } as Task, t);

  if (/^(shop|buy)\b/i.test(t))
    return withAppHint({ kind: "SHOP", query: t.replace(/^(shop|buy)\s*/i, "").trim() || "" } as Task, t);

  // ---- RIDE
  const rideBook = t.match(/\b(book|get|arrange|call)\s+(?:an?\s+)?(uber|ola|cab|taxi)(?:\s+(?:to|for)\s+(.+))?$/i);
  if (rideBook) return withAppHint({ kind: "RIDE", query: rideBook[3]?.trim() || "nearby" } as Task, t);

  if (/^(ride|cab|taxi|uber|ola)\b/i.test(t))
    return withAppHint({ kind: "RIDE", query: t.replace(/^(ride|cab|taxi|uber|ola)\s*/i, "").trim() || "nearby" } as Task, t);

  // ---- NAVIGATE
  if (/^(navigate|directions|maps|take me to)\b/i.test(t))
    return withAppHint({ kind: "NAVIGATE", query: t.replace(/^(navigate|directions|maps|take me to)\s*/i, "").trim() || "nearby" } as Task, t);

  // ---- FLIGHT (NLP helper resolves city/IATA; we pull date locally)
  const FLIGHT_TRIGGER = /\b(?:book|reserve|get|find|buy)?\s*(?:a\s+)?(?:flight|plane|air\s*ticket|tickets?)\b/i;
  if (FLIGHT_TRIGGER.test(t) || /^flight\b/i.test(t) || /\bflight booking\b/i.test(t)) {
    const got = await parseFlightFromUtterance(t);
    const dateText = t.match(DATE_PHRASE)?.[0];
    return withAppHint(
      {
        kind: "FLIGHT_BOOK",
        from: maybe(got.fromText || got.fromCity || (got as any).fromIATA),
        to:   maybe(got.toText   || got.toCity   || (got as any).toIATA),
        date: maybe(dateText),
      } as Task,
      t
    );
  }

  // ---- CALENDAR
  if (/^(add|create)\s+(event|meeting)\b/i.test(t)) {
    const title = t.replace(/^(add|create)\s+(event|meeting)\s*/i, "").trim() || "Event";
    const d = t.match(DATE_PHRASE);
    return withAppHint({ kind: "CALENDAR", text: title, dates: d?.[0] } as Task, t);
  }

  // ---- REMINDER
  if (/^remind\b/i.test(t)) {
    const what = t.replace(/^remind( me)?/i, "").trim();
    const when = what.match(/\b(today|tomorrow|day after|\d{4}-\d{2}-\d{2}|(?:\d{1,2}\s*(?:am|pm)))\b/i)?.[0];
    const textOnly = what.replace(/\b(today|tomorrow|day after|\d{4}-\d{2}-\d{2}|(?:\d{1,2}\s*(?:am|pm)))\b/i, "").replace(/\bto\b/i, "").trim();
    return { kind: "REMINDER", text: textOnly || undefined, when: when || undefined } as Task;
  }

  // ---- ALARM
  if (/^(set )?alarm\b/i.test(t)) {
    const time = t.match(/(\d{1,2}(:\d{2})?\s*(am|pm)?)/i)?.[1];
    return { kind: "ALARM", time: time || undefined } as Task;
  }

  // ---- NOTE
  if (/^note\b|^save note\b/i.test(t)) {
    const textOnly = t.replace(/^save note|^note/i, "").trim().replace(/^[:\- ]+/, "");
    return { kind: "NOTE", text: textOnly || undefined } as Task;
  }

  // ---- OPEN APP
  const mOpen = t.match(/^open\s+([a-zA-Z ][\w .+-]{0,30})$/i);
  if (mOpen) return { kind: "OPEN_APP", appId: resolveAppIdByAlias(mOpen[1]) || mOpen[1] };

  return null;
}
