import { useEffect } from "react";
import { Canvas, Group, Image as SkiaImage, useImage } from "@shopify/react-native-skia";
import { Easing, useDerivedValue, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";

import { useReducedMotion } from "@/hooks/useReducedMotion";
import { HAKI_ASSETS } from "../mascot/hakiAssets";

export function FeatherLoader() {
  const reducedMotion = useReducedMotion();
  const feather = useImage(HAKI_ASSETS.feather);
  const motion = useSharedValue(0);

  useEffect(() => {
    motion.value = 0;
    if (reducedMotion) return;
    motion.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 650, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 650, easing: Easing.inOut(Easing.sin) })
      ),
      -1
    );
  }, [motion, reducedMotion]);

  const transform = useDerivedValue(() => [
    { translateY: 3 - motion.value * 7 },
    { rotate: -0.2 + motion.value * 0.4 },
    { scale: 0.94 + motion.value * 0.11 }
  ]);

  return (
    <Canvas style={{ height: 32, width: 32 }}>
      <Group transform={transform} origin={{ x: 16, y: 16 }}>
        <SkiaImage image={feather} x={8} y={1} width={16} height={30} />
      </Group>
    </Canvas>
  );
}
