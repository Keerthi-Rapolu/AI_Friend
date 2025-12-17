import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Button, StyleSheet, ScrollView } from "react-native";
import { getContacts, upsertProfile } from "../memory";

export default function Contacts() {
  const [contacts, setContacts] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [value, setValue] = useState("");

  useEffect(() => {
    getContacts(setContacts);
  }, []);

  function addContact() {
    const newContacts = { ...contacts, [name.toLowerCase()]: value };
    upsertProfile({ user_id: "me", contacts: newContacts });
    setContacts(newContacts);
    setName("");
    setValue("");
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Contacts</Text>

      {Object.entries(contacts).map(([k, v]) => (
        <Text key={k} style={styles.contact}>{`${k}: ${v}`}</Text>
      ))}

      <TextInput
        style={styles.input}
        placeholder="Name (e.g., mom)"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={styles.input}
        placeholder="Number or Email"
        value={value}
        onChangeText={setValue}
      />
      <Button title="Add / Update" onPress={addContact} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  contact: { fontSize: 16, marginVertical: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 8,
    marginVertical: 6
  }
});
