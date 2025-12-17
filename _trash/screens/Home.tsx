import React, { useEffect, useState } from "react";
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Button } from "react-native";
import Voice from "@react-native-voice/voice";
import * as Speech from "expo-speech";
import { useNavigation } from "@react-navigation/native";
import { initDb, getContacts, addConversation, upsertProfile } from "../memory";
import { parseIntent, smallTalkResponse } from "../intents";
import { callNumber, emailDraft, whatsappDraft } from "../actions";

export default function Home() {
  const navigation = useNavigation();
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [contacts, setContacts] = useState<Record<string, string>>({});
  const [lastReply, setLastReply] = useState("");

  useEffect(() => {
    initDb();
    upsertProfile({ user_id: "me", contacts: { mom: "+14085551234", recruiter: "recruiter@example.com" } });
    getContacts(setContacts);

    Voice.onSpeechResults = e => {
      const text = e.value?.[0] || "";
      setTranscript(text);
      handleUnderstanding(text);
    };

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, []);

  async function startListening() {
    setTranscript("");
    setListening(true);
    await Voice.start("en-US");
  }

  async function stopListening() {
    setListening(false);
    await Voice.stop();
  }

  async function handleUnderstanding(text: string) {
    const intent = parseIntent(text);

    if (intent.kind === "CALL" && intent.contactName) {
      const num = contacts[intent.contactName];
      if (num) await callNumber(num);
      return;
    }
    if (intent.kind === "EMAIL_DRAFT") {
      await emailDraft(contacts.recruiter, intent.subject || "Follow-up", "Body");
      return;
    }
    if (intent.kind === "WHATSAPP_DRAFT") {
      await whatsappDraft(intent.message || "Hey!");
      return;
    }

    const reply = smallTalkResponse(text);
    setLastReply(reply);
    Speech.speak(reply);
    addConversation(text, reply, "neutral");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AI Friend</Text>
      <Button title="Manage Contacts" onPress={() => navigation.navigate("Contacts" as never)} />

      <ScrollView style={{ maxHeight: 160 }}>
        <Text>{transcript}</Text>
        <Text>{lastReply}</Text>
      </ScrollView>

      <TouchableOpacity
        style={styles.micButton}
        onPressIn={startListening}
        onPressOut={stopListening}
      >
        <Text style={{ color: "#fff" }}>{listening ? "Listening…" : "Hold to Talk"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  micButton: { marginTop: 20, backgroundColor: "#222", padding: 20, borderRadius: 999 }
});
