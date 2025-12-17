// src/llm.ts
import { flags } from "./config";

type GenOptions = { maxTokens?: number; temperature?: number; system?: string };
type LocalEngine = {
  init: (modelName: string) => Promise<void>;
  generate: (prompt: string, opts?: GenOptions) => Promise<string>;
};

let ready = false;
let engine: LocalEngine | null = null;

// --- tiny offline fallback (no deps) ---
const fallbackEngine: LocalEngine = {
  async init() { ready = true; },
  async generate(prompt: string) {
    const p = (prompt || "").trim();
    if (!p) return "I’m here and listening. What’s up?";
    if (/sad|upset|lonely|tired|down/i.test(p)) {
      return "I’m with you. Want to share a bit more? One small step at a time—you’ve got this.";
    }
    if (/^who|what|when|where|why|how\b/i.test(p)) {
      return "Here’s a short offline answer. If you need details, tell me and I’ll keep it concise.";
    }
    if (/joke|funny/i.test(p)) {
      return "Quick one: Why did the dev cross the road? To get to the other IDE. 😄";
    }
    return p.length < 80 ? `Got it. ${p[0].toUpperCase() + p.slice(1)}` : "Okay, I’ll keep it short and helpful.";
  },
};

// --- optional MLC engine (when you later install @react-native-ai/mlc) ---
async function makeMlcEngine(): Promise<LocalEngine | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mlc = require("@react-native-ai/mlc");
    if (typeof mlc?.create !== "function") return null;

    const ref: { engine?: any } = {};
    return {
      async init(modelName: string) {
        ref.engine = mlc.create();
        await ref.engine.reload({ model_id: modelName });
        ready = true;
      },
      async generate(prompt: string, opts?: GenOptions) {
        if (!ref.engine) throw new Error("MLC engine not initialized");
        const res = await ref.engine.chat.completions.create({
          messages: [
            { role: "system", content: opts?.system ?? "Be brief, kind, helpful." },
            { role: "user", content: prompt },
          ],
          temperature: opts?.temperature ?? flags.localTemperature,
          max_tokens: opts?.maxTokens ?? flags.localMaxTokens,
        });
        const text = res?.choices?.[0]?.message?.content
          ?? res?.choices?.[0]?.delta?.content
          ?? "";
        return String(text).trim() || "…";
      },
    };
  } catch {
    return null;
  }
}

// -------- Public API --------
export async function initLLM(modelName?: string): Promise<void> {
  if (ready) return;

  if (flags.engine === "local") {
    const mlc = await makeMlcEngine();
    if (mlc) {
      engine = mlc;
      await engine.init(modelName || flags.localModelName);
      return;
    }
    engine = fallbackEngine;
    await engine.init(modelName || flags.localModelName);
    return;
  }

  // Safety: even if someone sets engine="http", stay offline
  engine = fallbackEngine;
  await engine.init(modelName || flags.localModelName);
}

export async function generate(prompt: string, opts?: GenOptions): Promise<string> {
  if (!ready || !engine) await initLLM(flags.localModelName);
  return engine!.generate(prompt, opts);
}

// ---- Compatibility shims (old code calls these) ----
export async function askLocal(prompt: string, opts?: GenOptions) {
  return generate(prompt, opts);
}
export async function ask(prompt: string, opts?: GenOptions) {
  return generate(prompt, opts);
}

// Kept for old imports; no-op in offline build
export function configureHttpProvider(_: any) {}

export default { initLLM, generate, askLocal, ask, configureHttpProvider };
