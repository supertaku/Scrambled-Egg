import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { useThemeColors, useThemedStyles } from "@/theme/ThemeProvider";
import type { Theme } from "@/theme/themes";
import type { ChatRole } from "@/types/search";

const suggestions: Record<ChatRole, string[]> = {
  haki: [
    "How do I file a complaint?",
    "I lost my ID and I feel stressed. What can I do?",
    "How do I prepare for an exam?",
    "What is photosynthesis?"
  ],
  information_officer: [
    "How do I file a complaint?",
    "How do I request a good moral character?",
    "What should I do if I lose my ID?"
  ],
  friendly_buddy: [
    "I feel stressed about my studies. What should I do first?",
    "How can I make a difficult decision calmly?",
    "How can I start a respectful difficult conversation?"
  ],
  researcher: [
    "What is photosynthesis?",
    "Explain how sorting algorithms work.",
    "What causes a solar eclipse?"
  ]
};

interface SuggestedQuestionsProps {
  chatRole: ChatRole;
  onSelect: (question: string) => void;
}

export function SuggestedQuestions({ chatRole, onSelect }: SuggestedQuestionsProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Suggested questions</Text>
      <View style={styles.chips}>
        {suggestions[chatRole].map((question, index) => (
          <ChipItem key={question} question={question} index={index} onSelect={onSelect} />
        ))}
      </View>
    </View>
  );
}

function ChipItem({
  question,
  index,
  onSelect
}: {
  question: string;
  index: number;
  onSelect: (q: string) => void;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 9, tension: 80, useNativeDriver: true })
      ]).start();
    }, index * 60);
    return () => clearTimeout(timer);
  }, [index, fadeAnim, slideAnim]);

  const handlePressIn = () =>
    Animated.spring(pressScale, { toValue: 0.94, useNativeDriver: true, friction: 7, tension: 200 }).start();
  const handlePressOut = () =>
    Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 160 }).start();

  return (
    <Pressable onPress={() => onSelect(question)} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View
        style={[
          styles.chip,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }, { scale: pressScale }]
          }
        ]}
      >
        <Text style={styles.chipText}>{question}</Text>
      </Animated.View>
    </Pressable>
  );
}

const createStyles = ({ colors }: Theme) => StyleSheet.create({
  container: {
    gap: 10
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chip: {
    backgroundColor: colors.maroonSoft,
    borderColor: colors.maroonBorder,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 9
  },
  chipText: {
    color: colors.maroon,
    fontSize: 13,
    fontWeight: "700"
  }
});
