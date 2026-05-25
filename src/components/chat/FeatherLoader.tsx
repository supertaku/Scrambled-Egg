import { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";

import { useReducedMotion } from "@/hooks/useReducedMotion";

const FEATHER_IMAGE = require("../../../assets/images/mascot/pixel/haki-feather.png");

export function FeatherLoader() {
  const reducedMotion = useReducedMotion();
  const motion = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    motion.stopAnimation();
    motion.setValue(0);

    if (reducedMotion) {
      return undefined;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(motion, {
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          toValue: 1,
          useNativeDriver: true
        }),
        Animated.timing(motion, {
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          toValue: 0,
          useNativeDriver: true
        })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [motion, reducedMotion]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={{
          opacity: motion.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
          transform: [
            { translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [3, -4] }) },
            { rotate: motion.interpolate({ inputRange: [0, 1], outputRange: ["-13deg", "13deg"] }) },
            { scale: motion.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.05] }) }
          ]
        }}
      >
        <Image accessibilityIgnoresInvertColors resizeMode="contain" source={FEATHER_IMAGE} style={styles.feather} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    width: 32
  },
  feather: {
    height: 30,
    width: 30
  }
});
