import { Search, SendHorizontal } from "lucide-react-native";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";

import { colors } from "@/theme/colors";

interface QuestionInputProps {
  value: string;
  loading?: boolean;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
}

export function QuestionInput({ value, loading = false, onChangeText, onSubmit }: QuestionInputProps) {
  const disabled = loading || value.trim().length === 0;

  return (
    <View style={styles.container}>
      <Search color={colors.muted} size={20} />
      <TextInput
        accessibilityLabel="Ask a school process question"
        multiline
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder="Ask about registrar, clinic, enrollment, rules..."
        placeholderTextColor={colors.muted}
        returnKeyType="search"
        style={styles.input}
        value={value}
      />
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onSubmit}
        style={[styles.button, disabled ? styles.buttonDisabled : undefined]}
      >
        {loading ? <ActivityIndicator color={colors.white} /> : <SendHorizontal color={colors.white} size={19} />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  input: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    maxHeight: 96,
    minHeight: 42,
    padding: 0,
    textAlignVertical: "center"
  },
  button: {
    alignItems: "center",
    backgroundColor: colors.maroon,
    borderRadius: 16,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  buttonDisabled: {
    backgroundColor: colors.grayhawk
  }
});
