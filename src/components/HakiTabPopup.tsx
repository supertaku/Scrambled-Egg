import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import { PixelHaki } from "./mascot/PixelHaki";

interface HakiTabPopupProps {
  message: string | null;
  onDismiss?: () => void;
  visibleKey: number;
}

export function HakiTabPopup({ message, onDismiss, visibleKey }: HakiTabPopupProps) {
  const [renderedMessage, setRenderedMessage] = useState<string | null>(null);
  const mascotOpacity = useRef(new Animated.Value(0)).current;
  const mascotTranslateY = useRef(new Animated.Value(0)).current;
  const mascotTranslateX = useRef(new Animated.Value(-260)).current;
  const mascotScale = useRef(new Animated.Value(1)).current;
  const bubbleOpacity = useRef(new Animated.Value(0)).current;
  const bubbleTranslateY = useRef(new Animated.Value(18)).current;
  const bubbleScale = useRef(new Animated.Value(0.86)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!message || visibleKey === 0) {
      return;
    }

    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
    }

    setRenderedMessage(message);
    mascotOpacity.setValue(0);
    mascotTranslateY.setValue(0);
    mascotTranslateX.setValue(-260);
    mascotScale.setValue(1);
    bubbleOpacity.setValue(0);
    bubbleTranslateY.setValue(18);
    bubbleScale.setValue(0.86);

    Animated.parallel([
      Animated.timing(mascotOpacity, {
        toValue: 1,
        duration: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      }),
      Animated.spring(mascotTranslateX, {
        toValue: 0,
        friction: 7,
        tension: 120,
        useNativeDriver: true
      })
    ]).start(() => {
      Animated.parallel([
        Animated.timing(bubbleOpacity, {
          toValue: 1,
          duration: 140,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true
        }),
        Animated.spring(bubbleTranslateY, {
          toValue: 0,
          friction: 7,
          tension: 140,
          useNativeDriver: true
        }),
        Animated.spring(bubbleScale, {
          toValue: 1,
          friction: 6,
          tension: 150,
          useNativeDriver: true
        })
      ]).start(({ finished }) => {
        if (!finished) {
          return;
        }

        dismissTimer.current = setTimeout(() => {
          Animated.sequence([
            Animated.parallel([
              Animated.timing(bubbleOpacity, {
                toValue: 0,
                duration: 160,
                easing: Easing.in(Easing.quad),
                useNativeDriver: true
              }),
              Animated.timing(bubbleTranslateY, {
                toValue: 12,
                duration: 160,
                easing: Easing.in(Easing.quad),
                useNativeDriver: true
              }),
              Animated.timing(bubbleScale, {
                toValue: 0.92,
                duration: 160,
                easing: Easing.in(Easing.quad),
                useNativeDriver: true
              })
            ]),
            Animated.delay(110),
            Animated.parallel([
              Animated.timing(mascotOpacity, {
                toValue: 0,
                duration: 180,
                easing: Easing.in(Easing.quad),
                useNativeDriver: true
              }),
              Animated.timing(mascotTranslateX, {
                toValue: -260,
                duration: 260,
                easing: Easing.in(Easing.quad),
                useNativeDriver: true
              })
            ])
          ]).start(({ finished: dismissFinished }) => {
            if (dismissFinished) {
              setRenderedMessage(null);
              onDismiss?.();
            }
          });
        }, 3000);
      });
    });
  }, [
    bubbleOpacity,
    bubbleScale,
    bubbleTranslateY,
    mascotOpacity,
    mascotScale,
    mascotTranslateX,
    mascotTranslateY,
    message,
    onDismiss,
    visibleKey
  ]);

  function runDismissAnimation() {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(bubbleOpacity, {
          toValue: 0,
          duration: 120,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(bubbleScale, {
          toValue: 0.92,
          duration: 120,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true
        })
      ]),
      Animated.parallel([
        Animated.timing(mascotOpacity, {
          toValue: 0,
          duration: 140,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(mascotTranslateX, {
          toValue: -260,
          duration: 220,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true
        })
      ])
    ]).start(() => {
      setRenderedMessage(null);
      onDismiss?.();
    });
  }

  if (!renderedMessage) {
    return null;
  }

  function dismissImmediately() {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }

    runDismissAnimation();
  }

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.popup,
          {
            opacity: mascotOpacity,
            transform: [{ translateX: mascotTranslateX }, { translateY: mascotTranslateY }, { scale: mascotScale }]
          }
        ]}
      >
        <PixelHaki animated={false} height={218} state="detective" style={styles.hakiImage} width={142} />
        <Animated.View
          style={[
            styles.bubbleWrap,
            {
              opacity: bubbleOpacity,
              transform: [{ translateY: bubbleTranslateY }, { scale: bubbleScale }]
            }
          ]}
        >
          <Pressable accessibilityRole="button" onPress={dismissImmediately} style={styles.speechBubble}>
            <View pointerEvents="none" style={styles.speechBubbleTailBorder} />
            <View pointerEvents="none" style={styles.speechBubbleTail} />
            <Text style={styles.hakiName}>Haki</Text>
            <Text selectable style={styles.message}>{renderedMessage}</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    bottom: 72,
    left: 0,
    position: "absolute",
    right: 0,
    zIndex: 50,
    elevation: 50
  },
  popup: {
    alignItems: "flex-end",
    flexDirection: "row",
    minHeight: 220,
    paddingHorizontal: 8
  },
  hakiImage: {
    marginRight: -18,
    zIndex: 2
  },
  bubbleWrap: {
    flexShrink: 1,
    marginBottom: 48
  },
  speechBubble: {
    backgroundColor: colors.white,
    borderColor: "#D0D5DD",
    borderRadius: 20,
    borderTopLeftRadius: 8,
    borderWidth: 1.5,
    elevation: 10,
    flexShrink: 1,
    maxWidth: 274,
    minHeight: 76,
    paddingHorizontal: 18,
    paddingVertical: 14,
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 14
  },
  speechBubbleTailBorder: {
    borderBottomColor: "transparent",
    borderBottomWidth: 12,
    borderRightColor: "#D0D5DD",
    borderRightWidth: 17,
    borderTopColor: "transparent",
    borderTopWidth: 12,
    height: 0,
    left: -17,
    position: "absolute",
    top: 24,
    width: 0,
    zIndex: 1
  },
  speechBubbleTail: {
    borderBottomColor: "transparent",
    borderBottomWidth: 10,
    borderRightColor: colors.white,
    borderRightWidth: 15,
    borderTopColor: "transparent",
    borderTopWidth: 10,
    height: 0,
    left: -13,
    position: "absolute",
    top: 26,
    width: 0,
    zIndex: 2
  },
  hakiName: {
    color: colors.maroon,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginBottom: 4,
    textTransform: "uppercase"
  },
  message: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21
  }
});
