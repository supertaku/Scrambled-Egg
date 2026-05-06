import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";

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
        <Image
          accessibilityIgnoresInvertColors
          source={require("../../assets/images/mascot/grayhawk-detective.png")}
          style={styles.hakiImage}
          resizeMode="contain"
        />
        <Animated.View
          style={[
            styles.bubbleWrap,
            {
              opacity: bubbleOpacity,
              transform: [{ translateY: bubbleTranslateY }, { scale: bubbleScale }]
            }
          ]}
        >
          <Pressable accessibilityRole="button" onPress={dismissImmediately} style={styles.cloudBubble}>
            <View style={[styles.cloudPuff, styles.cloudPuffTop]} />
            <View style={[styles.cloudPuff, styles.cloudPuffRight]} />
            <View style={[styles.cloudPuff, styles.cloudPuffBottom]} />
            <View style={styles.cloudTailLarge} />
            <View style={styles.cloudTailSmall} />
            <Text style={styles.hakiName}>Haki</Text>
            <Text style={styles.message}>{renderedMessage}</Text>
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
    height: 226,
    marginRight: -42,
    width: 208,
    zIndex: 2
  },
  bubbleWrap: {
    flexShrink: 1,
    marginBottom: 48
  },
  cloudBubble: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    elevation: 8,
    flexShrink: 1,
    maxWidth: 274,
    minHeight: 76,
    paddingHorizontal: 18,
    paddingVertical: 13,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16
  },
  cloudPuff: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    position: "absolute",
    zIndex: -1
  },
  cloudPuffTop: {
    height: 44,
    left: 32,
    top: -18,
    width: 44
  },
  cloudPuffRight: {
    height: 40,
    right: 18,
    top: -10,
    width: 40
  },
  cloudPuffBottom: {
    bottom: -10,
    height: 34,
    left: 58,
    width: 34
  },
  cloudTailLarge: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    bottom: 14,
    height: 20,
    left: -16,
    position: "absolute",
    width: 20
  },
  cloudTailSmall: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    bottom: 2,
    height: 11,
    left: -30,
    position: "absolute",
    width: 11
  },
  hakiName: {
    color: colors.maroon,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.4,
    marginBottom: 3,
    textTransform: "uppercase"
  },
  message: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20
  }
});
