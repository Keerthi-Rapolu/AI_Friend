// src/overlayBubble.tsx
import React, { useEffect, useState } from "react";
import { View, TouchableOpacity, Text, StyleSheet, Platform } from "react-native";
import * as Speech from "expo-speech";
import { startAssistantService } from "./androidService";

export default function OverlayBubble(): JSX.Element {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (Platform.OS === "android") {
      // start foreground service; no-op on iOS
      startAssistantService().catch(() => {});
    }
  }, []);

  return (
    <View style={styles.container} pointerEvents="box-none">
      <TouchableOpacity
        style={[styles.button, active ? styles.buttonActive : undefined]}
        onPress={() => {
          setActive((v) => !v);
          Speech.speak(!active ? "Listening…" : "Stopped listening.");
        }}
        accessibilityRole="button"
        accessibilityLabel="AI Friend mic"
      >
        <Text style={styles.label}>🎙</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: "absolute", right: 20, bottom: 80 },
  button: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
  },
  buttonActive: { backgroundColor: "#0A84FF" },
  label: { color: "#fff", fontWeight: "600", fontSize: 22 },
});
