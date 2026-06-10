import { Canvas, Group } from "@shopify/react-native-skia";
import type { SharedValue } from "react-native-reanimated";

import { HakiRig } from "./HakiRig";
import type { HakiActivity, HakiAnimationEvent, HakiBondLevel, HakiDirection, HakiMood } from "./hakiMascotState";
import type { HakiDetailLevel } from "./hakiPlacementBudget";
import { useHakiAnimator } from "./useHakiAnimator";

interface HakiCanvasProps {
  active: boolean;
  activity: HakiActivity;
  bondLevel: HakiBondLevel;
  detail: HakiDetailLevel;
  direction: HakiDirection;
  event?: HakiAnimationEvent | undefined;
  eventKey: number;
  gazeX?: SharedValue<number> | undefined;
  gazeY?: SharedValue<number> | undefined;
  mood: HakiMood;
  reducedMotion: boolean;
  size: number;
}

export function HakiCanvas(props: HakiCanvasProps) {
  const animator = useHakiAnimator({
    active: props.active,
    activity: props.activity,
    bondLevel: props.bondLevel,
    direction: props.direction,
    event: props.event,
    eventKey: props.eventKey,
    gazeX: props.gazeX,
    gazeY: props.gazeY,
    mood: props.mood,
    reducedMotion: props.reducedMotion
  });
  const scale = props.size / 1536;
  const x = (props.size - 1024 * scale) / 2;

  return (
    <Canvas style={{ height: props.size, width: props.size }}>
      <Group transform={[{ translateX: x }, { scale }]}>
        <HakiRig activity={props.activity} animator={animator} direction={props.direction} event={props.event} simplified={props.detail === "map" || props.detail === "compact"} />
      </Group>
    </Canvas>
  );
}
