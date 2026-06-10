import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HakiMascot } from "@/components/mascot/HakiMascot";
import type { HakiActivity, HakiAnimationEvent, HakiBondLevel, HakiDirection, HakiMood, HakiPlacement } from "@/components/mascot/hakiMascotState";
import { colors } from "@/theme/colors";

const ACTIVITIES: HakiActivity[] = ["idle", "listening", "thinking", "answering", "success", "error", "sleepy", "groggy", "onboarding", "modelOperation", "walking", "exploring", "admin"];
const MOODS: HakiMood[] = ["calm", "curious", "happy", "sleepy", "dizzy", "concerned", "annoyed", "focused"];
const DIRECTIONS: HakiDirection[] = ["front", "left", "right", "back"];
const BONDS: HakiBondLevel[] = ["new", "warming", "familiar", "bonded"];
const PLACEMENTS: HakiPlacement[] = ["header", "chatListening", "chatAvatar", "onboarding", "modelStatus", "tabPopup", "admin", "mapPlayer", "mapDialogue"];
const EVENTS: HakiAnimationEvent[] = ["attention", "pet", "swipe", "tripleTap", "pokeBurst", "wake", "groggy"];

export default function HakiLabScreen() {
  const [activity, setActivity] = useState<HakiActivity>("idle");
  const [mood, setMood] = useState<HakiMood>("curious");
  const [direction, setDirection] = useState<HakiDirection>("front");
  const [bondLevel, setBondLevel] = useState<HakiBondLevel>("new");
  const [placement, setPlacement] = useState<HakiPlacement>("header");
  const [event, setEvent] = useState<HakiAnimationEvent | undefined>();
  const [eventKey, setEventKey] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const size = placement === "mapPlayer" ? 72 : placement === "chatAvatar" ? 72 : 250;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Haki Lab</Text>
        <View style={styles.stage}>
          <HakiMascot activity={activity} bondLevel={bondLevel} direction={direction} event={event} eventKey={eventKey} interactionMode="full" mood={mood} placement={placement} reducedMotion={reducedMotion} size={size} />
        </View>
        <Control label="Activity" options={ACTIVITIES} value={activity} onChange={setActivity} />
        <Control label="Mood" options={MOODS} value={mood} onChange={setMood} />
        <Control label="Direction" options={DIRECTIONS} value={direction} onChange={setDirection} />
        <Control label="Bond" options={BONDS} value={bondLevel} onChange={setBondLevel} />
        <Control label="Placement" options={PLACEMENTS} value={placement} onChange={setPlacement} />
        <Text style={styles.label}>Reaction</Text>
        <View style={styles.options}>{EVENTS.map((option) => <Pressable key={option} onPress={() => { setEvent(option); setEventKey((key) => key + 1); }} style={styles.option}><Text style={styles.optionText}>{option}</Text></Pressable>)}</View>
        <Pressable onPress={() => setReducedMotion((value) => !value)} style={[styles.motionToggle, reducedMotion ? styles.motionToggleActive : undefined]}><Text style={styles.motionText}>Reduced motion: {reducedMotion ? "On" : "Off"}</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Control<T extends string>({ label, onChange, options, value }: { label: string; onChange: (value: T) => void; options: readonly T[]; value: T }) {
  return <View><Text style={styles.label}>{label}</Text><View style={styles.options}>{options.map((option) => <Pressable key={option} onPress={() => onChange(option)} style={[styles.option, option === value ? styles.optionActive : undefined]}><Text style={[styles.optionText, option === value ? styles.optionTextActive : undefined]}>{option}</Text></Pressable>)}</View></View>;
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.surface, flex: 1 },
  content: { gap: 14, padding: 18, paddingBottom: 80 },
  title: { color: colors.ink, fontSize: 24, fontWeight: "900" },
  stage: { alignItems: "center", backgroundColor: colors.white, borderColor: colors.border, borderRadius: 8, borderWidth: 1, minHeight: 290, justifyContent: "center" },
  label: { color: colors.ink, fontSize: 12, fontWeight: "900", marginBottom: 7, textTransform: "uppercase" },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  option: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: 6, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  optionActive: { backgroundColor: colors.maroon, borderColor: colors.maroon },
  optionText: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  optionTextActive: { color: colors.white },
  motionToggle: { alignItems: "center", backgroundColor: colors.white, borderColor: colors.borderStrong, borderRadius: 7, borderWidth: 1, padding: 12 },
  motionToggleActive: { backgroundColor: colors.goldSoft, borderColor: colors.gold },
  motionText: { color: colors.ink, fontSize: 13, fontWeight: "900" }
});
