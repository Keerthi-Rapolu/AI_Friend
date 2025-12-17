// src/types.ts (lean)
export type AssistIntent =
  | { kind: "ASK"; text: string }           // general Q&A
  | { kind: "MOOD"; mood: "sad"|"ok"|"happy"; note?: string } // journaling
  | { kind: "SUMMARIZE_PAGE"; context: string } // when you pass in text you show
  | { kind: "SUGGEST_REPLY"; history: string[] }; // suggest next reply inside app

export type AssistantReply = {
  text: string;
  suggestions?: string[];  // quick options for user
};
