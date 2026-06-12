import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";

import { HakiMascotCompat, HD_ONBOARDING_IMAGES } from "@/mascot";
import { useThemeColors, useThemedStyles } from "@/theme/ThemeProvider";
import type { Theme } from "@/theme/themes";
import type { MascotStatus } from "../mascot/mascotConfig";

type Pose = "welcome" | "learning" | "celebration";

function poseForStep(step: number): Pose {
  if (step >= 5) {
    return "celebration";
  }
  return step >= 2 ? "learning" : "welcome";
}

function statusForPose(pose: Pose): MascotStatus {
  if (pose === "celebration") return "success";
  if (pose === "learning") return "teaching";
  return "idle";
}

interface OnboardingHakiProps {
  message: string;
  reducedMotion: boolean;
  replayKey: number;
  step: number;
  onPress: () => void;
}

export function OnboardingHaki({
  message,
  reducedMotion,
  replayKey,
  step,
  onPress
}: OnboardingHakiProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const translateY = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const bubbleScale = useRef(new Animated.Value(1)).current;
  const pose = poseForStep(step);

  useEffect(() => {
    translateY.stopAnimation();
    rotate.stopAnimation();
    scale.stopAnimation();
    translateY.setValue(0);
    rotate.setValue(0);
    scale.setValue(1);

    if (reducedMotion) {
      return undefined;
    }

    const animation = step === 1
      ? Animated.loop(
          Animated.sequence([
            Animated.timing(scale, { toValue: 1.035, duration: 850, useNativeDriver: true }),
            Animated.timing(scale, { toValue: 1, duration: 850, useNativeDriver: true })
          ])
        )
      : step === 2
        ? Animated.loop(
            Animated.sequence([
              Animated.timing(rotate, { toValue: 1, duration: 1000, useNativeDriver: true }),
              Animated.timing(rotate, { toValue: 0, duration: 1000, useNativeDriver: true })
            ])
          )
        : step === 3
          ? Animated.loop(
              Animated.sequence([
                Animated.timing(rotate, { toValue: -0.6, duration: 780, useNativeDriver: true }),
                Animated.timing(rotate, { toValue: 0.4, duration: 780, useNativeDriver: true })
              ])
            )
          : step === 4
            ? Animated.loop(
                Animated.sequence([
                  Animated.timing(translateY, { toValue: 5, duration: 460, useNativeDriver: true }),
                  Animated.timing(translateY, { toValue: 0, duration: 460, useNativeDriver: true }),
                  Animated.delay(950)
                ])
              )
            : step === 5
              ? Animated.loop(
                  Animated.sequence([
                    Animated.parallel([
                      Animated.timing(translateY, { toValue: -9, duration: 620, useNativeDriver: true }),
                      Animated.timing(scale, { toValue: 1.04, duration: 620, useNativeDriver: true })
                    ]),
                    Animated.parallel([
                      Animated.timing(translateY, { toValue: 0, duration: 620, useNativeDriver: true }),
                      Animated.timing(scale, { toValue: 1, duration: 620, useNativeDriver: true })
                    ])
                  ])
                )
              : Animated.loop(
                  Animated.sequence([
                    Animated.timing(translateY, {
                      toValue: -5,
                      duration: 1500,
                      easing: Easing.inOut(Easing.ease),
                      useNativeDriver: true
                    }),
                    Animated.timing(translateY, {
                      toValue: 0,
                      duration: 1500,
                      easing: Easing.inOut(Easing.ease),
                      useNativeDriver: true
                    })
                  ])
                );

    animation.start();
    return () => animation.stop();
  }, [reducedMotion, rotate, scale, step, translateY]);

  useEffect(() => {
    if (replayKey === 0 || reducedMotion) {
      return;
    }

    Animated.sequence([
      Animated.spring(scale, { toValue: 1.08, friction: 5, tension: 150, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 130, useNativeDriver: true })
    ]).start();
    bubbleScale.setValue(0.94);
    Animated.spring(bubbleScale, { toValue: 1, friction: 5, tension: 150, useNativeDriver: true }).start();
  }, [bubbleScale, reducedMotion, replayKey, scale]);

  const rotation = rotate.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ["-3deg", "0deg", "3deg"]
  });

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityLabel="Hear Haki's prompt again"
        accessibilityRole="button"
        onPress={onPress}
        style={styles.mascotPressable}
      >
        <Animated.View style={[styles.mascot, { transform: [{ translateY }, { rotate: rotation }, { scale }] }]}>
          <HakiMascotCompat
            externalFloat
            height={218}
            reducedMotion={reducedMotion}
            source={HD_ONBOARDING_IMAGES[pose]}
            status={statusForPose(pose)}
            width={155}
          />
        </Animated.View>
      </Pressable>
      <Animated.View style={[styles.bubble, { transform: [{ scale: bubbleScale }] }]}>
        <View style={styles.tail} />
        <Text style={styles.name}>Haki</Text>
        <Text selectable style={styles.message}>{message}</Text>
      </Animated.View>
    </View>
  );
}

const createStyles = ({ colors }: Theme) => StyleSheet.create({
  container: {
    alignItems: "center",
    height: 272,
    justifyContent: "flex-end",
    marginBottom: 12,
    position: "relative"
  },
  mascotPressable: {
    alignItems: "center",
    bottom: 0,
    height: 224,
    justifyContent: "center",
    left: 2,
    position: "absolute",
    width: 184
  },
  mascot: {
    height: "100%",
    width: "100%"
  },
  bubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.card,
    borderColor: colors.borderStrong,
    borderRadius: 18,
    borderTopLeftRadius: 8,
    borderWidth: 1,
    marginBottom: 64,
    marginRight: 8,
    maxWidth: "61%",
    minHeight: 74,
    paddingHorizontal: 14,
    paddingVertical: 11,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10
  },
  tail: {
    backgroundColor: colors.card,
    borderBottomColor: colors.borderStrong,
    borderLeftColor: colors.borderStrong,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    height: 14,
    left: -8,
    position: "absolute",
    top: 32,
    transform: [{ rotate: "45deg" }],
    width: 14
  },
  name: {
    color: colors.maroon,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginBottom: 4,
    textTransform: "uppercase"
  },
  message: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18
  }
});
