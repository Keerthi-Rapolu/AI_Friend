// app/index.tsx
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, TextInput, Alert } from "react-native";
import * as Speech from "expo-speech";
import * as Notifications from "expo-notifications";

import { initDb, addConversation, getRecentConversation, rememberFact, getAllFacts, getFactsByKey } from "../src/memory";
import { parseIntent } from "../src/intents";
import { initLLM, configureHttpProvider } from "../src/llm";
import { composeReply, detectMood } from "../src/style";
import { answerFromWeb, getTopHeadline } from "../src/web";
import { flags } from "../src/config";
import { composeHumanReply } from "../src/behavior";
import { seedAllIfEmpty as seedAll } from "../src/seeds";

import { suggestReplies, type QuickReply } from "../src/quickReplies";
import { sweepOld } from "../src/activityLog";
import OverlayBubble from "../src/overlayBubble";

export default function Home() {
  // ---- state ----
  const [transcript, setTranscript] = useState("");
  const [lastReply, setLastReply] = useState("");
  const [ready, setReady] = useState(false);
  const [lastQuery, setLastQuery] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [suggested, setSuggested] = useState<QuickReply[]>([]);

  // prevent double-send when pressing return and the Send button quickly
  const sendingRef = useRef(false);
  const sendSafely = async (raw: string) => {
    const text = (raw || "").trim();
    if (!ready || !text) return;
    if (sendingRef.current) return;
    sendingRef.current = true;
    try { await onSend(text); }
    finally { sendingRef.current = false; setTranscript(""); }
  };

  // ---- init ----
  useEffect(() => {
    (async () => {
      try {
        console.log("[INIT] begin");
        initDb();
        try { await seedAll(); } catch (e) { console.warn("[INIT] seed failed", e); }

        // Prep notifications, sweep logs
        await Notifications.getBadgeCountAsync().catch(() => {});
        sweepOld();

        setReady(true);

        // LLM init 
        try {
            await initLLM("Qwen2.5-1.5B-Instruct");
          console.log("[INIT] LLM ready (offline)");
        } catch (e) {
          console.warn("[INIT] LLM init fallback:", String(e));
        }
      } catch (e) {
        console.error("[INIT] fatal", e);
        Alert.alert("Startup error", String(e));
      }
    })();
  }, []);

  async function speakAndLog(reply: string, userText = "", moodHint?: string) {
    setLastReply(reply);
    try {
      const mood = detectMood(userText);
      const tt: any = { language: "en-US", rate: 0.98, pitch: 1.0 };
      if (mood === "sad")   { tt.rate = 0.9;  tt.pitch = 0.95; }
      if (mood === "happy") { tt.rate = 1.05; tt.pitch = 1.05; }
      Speech.speak(reply, tt);
    } catch {}
    addConversation(userText, reply, moodHint || "neutral");
  }

  // ---- main send handler ----
  async function onSend(text: string) {
    setSuggested([]); // clear chips each turn
    if (!ready) return;

    const mood = detectMood(text);
    const blockCheckins = getFactsByKey("block_checkins")?.[0]?.v === "true";

    // quick toggles
    if (/^go offline$/i.test(text)) { setOffline(true);  await speakAndLog("Okay, offline mode is on. I won’t fetch from the web.", text); return; }
    if (/^go online$/i.test(text))  { setOffline(false); await speakAndLog("Back online. I can search when you ask.", text); return; }

    // NOTE: v6 — removed all task session & external-app actions

    // “more / search” follow-up
    if (/^(more|details|search( now)?)$/i.test(text) && lastQuery) {
      if (offline) { await speakAndLog("Offline mode is on. Say “go online” if you want me to search.", text); return; }
      const ans = await answerFromWeb(lastQuery);
      const msg = ans.summary || "I found info, but the summary wasn’t clean this time.";
      await speakAndLog(msg, text);
      return;
    }

    // greetings → short, human-y
    if (/^\s*(hi|hello|hey|yo|good (morning|afternoon|evening))\b/i.test(text)) {
      let headline: { title: string; url: string } | null = null;
      if (!offline && Math.random() < 0.4) {
        headline = await getTopHeadline("US:en");
        // v6: no "open link" button; we only mention it in text reply as context
      }
      const reply = await composeHumanReply(text, { mood, kind: "greeting", headline: headline?.title ?? null });
      await speakAndLog(reply, text, mood);
      const recentTwo = getRecentConversation(2).map(r => ({ from: "me" as const, text: r.user_text }));
      setSuggested(await suggestReplies({ channel: "sms", lastTwo: recentTwo }));
      return;
    }

    // intents limited to facts only (v6)
    const intent = parseIntent(text);

    if (intent.kind === "FACT_ADD") {
      const subj = (intent.subject ?? "me").trim();
      rememberFact({ subject: subj, key: intent.key, value: intent.value });
      return speakAndLog(
        subj === "me"
          ? (intent.key === "name" ? `Nice to meet you, ${intent.value}. I'll remember that.` : `I'll remember your ${intent.key} is ${intent.value}.`)
          : `Got it — ${subj}'s ${intent.key} is ${intent.value}.`,
        text
      );
    }

    if (intent.kind === "FACT_QUERY") {
      const subj = (intent.subject ?? "me").trim();
      if (intent.key) {
        const rows = getFactsByKey(intent.key, subj);
        return speakAndLog(
          rows.length
            ? (subj === "me" ? `Your ${intent.key}: ${rows[0].v}` : `${subj}'s ${intent.key}: ${rows[0].v}`)
            : (subj === "me" ? `I don't have your ${intent.key} yet.` : `I don't have ${subj}'s ${intent.key} yet.`),
          text
        );
      } else {
        const all = getAllFacts(10, subj).map(f => `${f.k}: ${f.v}`);
        return speakAndLog(
          all.length
            ? (subj === "me" ? `I remember: ${all.join("; ")}` : `I remember about ${subj}: ${all.join("; ")}`)
            : (subj === "me" ? "I haven't saved anything yet." : `I haven't saved anything for ${subj} yet.`),
          text
        );
      }
    }

    // offer to search (summary only; no external open)
    const needsWeb = /\b(how|who|what|when|where|why|news|joke|recipe|steps|wiki|explain)\b/i.test(text);
    if (needsWeb) {
      setLastQuery(text);
      if (offline) await speakAndLog('You’re offline. Say "go online" if you want me to look it up.', text);
      else         await speakAndLog('I can look that up and keep it short. Say "search" or "more" and I’ll fetch it.', text);
      return;
    }

    // smalltalk → checkin (unless blocked)
    if (!blockCheckins) {
      try {
        const reply = await composeHumanReply(text, { mood, kind: "checkin" });
        await speakAndLog(reply, text, mood);
        const recentTwo = getRecentConversation(2).map(r => ({ from: "me" as const, text: r.user_text }));
        setSuggested(await suggestReplies({ channel: "sms", lastTwo: recentTwo }));
        return;
      } catch {}
    }

    // fallback short reply
    const facts = getAllFacts(12).map(f => `${f.k}=${f.v}`).join("; ");
    const reply = await composeReply(text, {
      facts,
      recentPairs: getRecentConversation(3),
      persona: (getFactsByKey("style")?.[0]?.v as any) || "friendly",
      mood
    });
    await speakAndLog(reply, text, mood);

    // show quick-reply chips even for fallback
    const recentTwo = getRecentConversation(2).map(r => ({ from: "me" as const, text: r.user_text }));
    setSuggested(await suggestReplies({ channel: "sms", lastTwo: recentTwo }));
  }

  const canSend = ready && transcript.trim().length > 0;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AI Friend</Text>

      <TextInput
        style={styles.textbox}
        placeholder={
          ready
            ? 'Try: "remember my name is Keerthi", "what do you remember about me?", "explain git rebase", "tell me a short recipe"'
            : "Setting up…"
        }
        editable={ready}
        value={transcript}
        onChangeText={setTranscript}
        onSubmitEditing={() => sendSafely(transcript)}
        returnKeyType="send"
      />

      <ScrollView style={{ maxHeight: 160, marginTop: 10 }}>
        <Text>{lastReply}</Text>
      </ScrollView>

      {suggested.length > 0 && (
        <View style={styles.chipsRow}>
          {suggested.map((r, i) => (
            <TouchableOpacity key={i} style={styles.chip} onPress={() => setTranscript(r.text)}>
              <Text style={{ color: "#0a84ff" }}>{r.text}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={[styles.micButton, !canSend && { opacity: 0.5 }]}
        disabled={!canSend}
        onPress={() => sendSafely(transcript)}
      >
        <Text style={{ color: "#fff" }}>{ready ? (offline ? "Send (Offline)" : "Send") : "Initializing…"}</Text>
      </TouchableOpacity>
      <OverlayBubble />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  micButton: { marginTop: 20, backgroundColor: "#222", padding: 20, borderRadius: 999 },
  textbox: { width: "100%", borderWidth: 1, borderColor: "#ccc", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 12 },
  chipsRow: { width: "100%", flexDirection: "row", flexWrap: "wrap", marginTop: 8, gap: 8 },
  chip: { borderWidth: 1, borderColor: "#0a84ff", borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, marginRight: 6, marginBottom: 6 },
});
