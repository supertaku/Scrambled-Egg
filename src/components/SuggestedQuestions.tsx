import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";

const suggestions = [
  "How do I request documents from the Registrar?",
  "What should I do if I lose my ID?",
  "How do I prepare for an exam?",
  "How do I handle an awkward campus situation?"
];

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
}

export function SuggestedQuestions({ onSelect }: SuggestedQuestionsProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Suggested questions</Text>
      <View style={styles.chips}>
        {suggestions.map((question) => (
          <Pressable key={question} onPress={() => onSelect(question)} style={styles.chip}>
            <Text style={styles.chipText}>{question}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10
  },
  label: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800"
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chip: {
    backgroundColor: colors.maroonSoft,
    borderColor: "#E8C7D0",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  chipText: {
    color: colors.maroonDark,
    fontSize: 13,
    fontWeight: "700"
  }
});
