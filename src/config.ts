// src/config.ts
export const flags = {
  // Fully offline / on-device only
  engine: "local" as const,

  // Local model settings (used by llm.ts)
  localModelName: "Qwen2.5-1.5B-Instruct",
  localMaxTokens: 196,
  localTemperature: 0.7,

  // Kept for compatibility; ignored in local mode
  httpModelUrl: "",
  httpModelName: "",
  httpApiKey: "",
};
