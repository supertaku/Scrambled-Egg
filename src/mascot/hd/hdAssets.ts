import type { ImageSourcePropType } from "react-native";

import type { MascotStatus } from "@/components/mascot/mascotConfig";

/**
 * HD cartoon Haki art (the official mascot look). One image per expression;
 * motion is layered procedurally by HakiHdMascot, so adding a new pose is
 * just dropping a PNG here and pointing the right status at it.
 *
 * Every status has dedicated artwork from the same white-polo Haki set.
 */
export const HD_STATUS_IMAGES: Record<MascotStatus, ImageSourcePropType> = {
  idle: require("../../../assets/images/mascot/hd-v2/haki-idle.png"),
  thinking: require("../../../assets/images/mascot/hd-v2/haki-thinking.png"),
  typing: require("../../../assets/images/mascot/hd-v2/haki-typing.png"),
  interrogating: require("../../../assets/images/mascot/hd-v2/haki-interrogating.png"),
  sleepy: require("../../../assets/images/mascot/hd-v2/haki-sleepy.png"),
  teaching: require("../../../assets/images/mascot/hd-v2/haki-teaching.png"),
  idea: require("../../../assets/images/mascot/hd-v2/haki-idea.png"),
  success: require("../../../assets/images/mascot/hd-v2/haki-success.png"),
  error: require("../../../assets/images/mascot/hd-v2/haki-error.png"),
  groggy: require("../../../assets/images/mascot/hd-v2/haki-groggy.png")
};

export const HD_DETECTIVE_IMAGE: ImageSourcePropType = require("../../../assets/images/mascot/hd-v2/haki-detective.png");

/** Head-only portrait for chat bubbles and compact slots. */
export const HD_PORTRAIT_IMAGE: ImageSourcePropType = require("../../../assets/images/mascot/hd-v2/haki-chat-portrait.png");

/** Dedicated onboarding poses. */
export const HD_ONBOARDING_IMAGES = {
  celebration: require("../../../assets/images/mascot/hd-v2/haki-onboarding-celebration.png"),
  learning: require("../../../assets/images/mascot/hd-v2/haki-onboarding-learning.png"),
  welcome: require("../../../assets/images/mascot/hd-v2/haki-onboarding-welcome.png")
} satisfies Record<string, ImageSourcePropType>;

/** Dedicated model-operation poses for the AI Models screen. */
export const HD_MODEL_OPERATION_IMAGES = {
  downloading: require("../../../assets/images/mascot/hd-v2/haki-model-downloading.png"),
  ready: require("../../../assets/images/mascot/hd-v2/haki-model-ready.png"),
  switching: require("../../../assets/images/mascot/hd-v2/haki-model-switching.png"),
  verifying: require("../../../assets/images/mascot/hd-v2/haki-model-verifying.png")
} satisfies Record<string, ImageSourcePropType>;
