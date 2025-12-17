// src/seeds.ts
import { seedTemplates, getTemplateCount } from "./memory";
import greetingsEn from "./corpus/greetings_en.json";

export async function seedAllIfEmpty() {
  // cheap sync check; safe to call on every launch
  if (getTemplateCount() > 0) return;

  const baseRows = [
    // keep your existing curated rows if you have them…
    { kind: "checkin",  locale: "en", text: "{name}, quick pulse—energy more chill or buzzy today?" },
    { kind: "birthday", locale: "en", text: "Happy birthday, {name}! One small wish for your {day_part}?" },
    { kind: "festival", locale: "en", text: "{name}, wishing you a warm {festival}!" }
  ];

  const greetingRows = (greetingsEn as string[]).map(text => ({
    kind: "greeting",
    locale: "en",
    text
  }));

  seedTemplates([...baseRows, ...greetingRows]);
}
