// app/settings.tsx
import React, { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { persona, type Persona } from "../src/config";
import { rememberFact, getFactsByKey } from "../src/memory";

const VIBES: Array<Persona["vibe"]> = ["friendly", "caring", "funny", "serious"];

export default function Settings() {
  const [selected, setSelected] = useState<Persona["vibe"]>(persona.vibe);

  useEffect(() => {
    // load saved vibe from memory if present
    const v = getFactsByKey("style")?.[0]?.v as Persona["vibe"] | undefined;
    if (v && VIBES.includes(v)) setSelected(v);
  }, []);

  return (
    <View style={{ padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: "600" }}>Personality</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        {VIBES.map((v) => {
          const active = v === selected;
          return (
            <Pressable
              key={v}
              onPress={() => {
                setSelected(v);
                rememberFact({ subject: "me", key: "style", value: v });
              }}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderWidth: 1,
                borderRadius: 8,
                borderColor: active ? "#0a84ff" : "#ccc",
                backgroundColor: active ? "#0a84ff20" : "transparent",
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={{ fontWeight: active ? "700" : "400" }}>{v}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
