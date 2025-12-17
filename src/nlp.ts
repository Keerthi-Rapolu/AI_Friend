// src/nlp.ts
import { resolveAirport } from "./airports";

const DATE_PHRASE =
  /\b(?:today|tomorrow|day after|on\s+\w+\s+\d{1,2}|on\s+\d{4}-\d{2}-\d{2}|\d{1,2}\s*(?:am|pm))\b/i;

const CITY = "([a-z .'-]{2,})";

/** Pull from/to/date out of free text, resolve with airport dataset. */
export async function parseFlightFromUtterance(line: string) {
  const t = (line || "").trim();

  const mFrom = t.match(new RegExp(`\\bfrom\\s+${CITY}(?=\\s+(?:to|on|for|$))`, "i"))?.[1];
  const mTo   = t.match(new RegExp(`\\bto\\s+${CITY}(?=\\s+(?:from|on|for|$))`, "i"))?.[1];

  let rawFrom = mFrom?.trim();
  let rawTo   = mTo?.trim();

  if (!rawFrom || !rawTo) {
    const after = t.replace(/^(?:book|reserve|get|find|buy|flight|flights)\s*/i, "");
    const pair  = after.match(new RegExp(`${CITY}\\s+to\\s+${CITY}(?=\\s|$)`, "i"));
    rawFrom = rawFrom || pair?.[1]?.trim();
    rawTo   = rawTo   || pair?.[2]?.trim();
  }

  const when = t.match(DATE_PHRASE)?.[0];

  const [fromA, toA] = await Promise.all([
    rawFrom ? resolveAirport(rawFrom) : Promise.resolve(null),
    rawTo   ? resolveAirport(rawTo)   : Promise.resolve(null),
  ]);

  return {
    fromText: rawFrom || undefined,
    toText:   rawTo   || undefined,
    dateText: when    || undefined,
    fromCity: fromA?.city,
    fromIATA: fromA?.iata,
    toCity:   toA?.city,
    toIATA:   toA?.iata,
  };
}
