import type { ImageSourcePropType, StyleProp, ViewStyle } from "react-native";

import type { MascotStatus } from "@/components/mascot/mascotConfig";
import { HakiHdMascot } from "../hd/HakiHdMascot";

interface HakiMascotCompatProps {
  animated?: boolean | undefined;
  /** Skip the internal float when an outer transform already bobs the mascot. */
  externalFloat?: boolean | undefined;
  height?: number | undefined;
  reducedMotion?: boolean | undefined;
  /** Override the status-mapped art (dedicated onboarding/model poses). */
  source?: ImageSourcePropType | undefined;
  status?: MascotStatus | undefined;
  style?: StyleProp<ViewStyle> | undefined;
  width?: number | undefined;
}

/**
 * Status-driven mascot used across the app. Renders the HD cartoon Haki —
 * the single official look — with procedural motion per expression.
 */
export function HakiMascotCompat(props: HakiMascotCompatProps) {
  return <HakiHdMascot {...props} />;
}
