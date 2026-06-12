import { StyleSheet } from "react-native";

import { colors } from "@/theme/colors";
import { campusMapPalette } from "@/theme/featurePalettes";

const FEATHER_SIZE = 18;
const SPRITE_HEIGHT = 36;
const SPRITE_WIDTH = 36;

export const campusMapStyles = StyleSheet.create({
  safeArea: {
    backgroundColor: campusMapPalette.backdrop,
    flex: 1
  },
  stage: {
    backgroundColor: campusMapPalette.backdrop,
    flex: 1,
    overflow: "hidden"
  },
  mapViewport: {
    bottom: 8,
    left: 0,
    position: "absolute",
    right: 0,
    top: 58
  },
  mapCanvas: {
    borderColor: campusMapPalette.backdropBorder,
    borderWidth: 2,
    overflow: "hidden",
    position: "absolute"
  },
  mapImage: {
    height: "100%",
    width: "100%"
  },
  backButton: {
    alignItems: "center",
    backgroundColor: campusMapPalette.controlGold,
    borderBottomColor: campusMapPalette.controlShadow,
    borderBottomWidth: 4,
    borderColor: campusMapPalette.controlHighlight,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderTopWidth: 3,
    flexDirection: "row",
    gap: 3,
    left: 10,
    paddingHorizontal: 9,
    paddingVertical: 8,
    position: "absolute",
    top: 9,
    zIndex: 20
  },
  backText: {
    color: campusMapPalette.inkStrong,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.7
  },
  feather: {
    height: FEATHER_SIZE,
    marginLeft: -FEATHER_SIZE / 2,
    marginTop: -FEATHER_SIZE / 2,
    position: "absolute",
    width: FEATHER_SIZE,
    zIndex: 3
  },
  featherCounter: {
    alignItems: "center",
    backgroundColor: campusMapPalette.controlGold,
    borderBottomColor: campusMapPalette.controlShadow,
    borderBottomWidth: 4,
    borderColor: campusMapPalette.controlHighlight,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderTopWidth: 3,
    bottom: 12,
    flexDirection: "row",
    gap: 5,
    left: 10,
    paddingHorizontal: 9,
    paddingVertical: 6,
    position: "absolute",
    zIndex: 20
  },
  featherCounterIcon: {
    height: 16,
    width: 16
  },
  featherCounterText: {
    color: campusMapPalette.inkStrong,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.7
  },
  featherBanner: {
    alignSelf: "center",
    backgroundColor: campusMapPalette.paper,
    borderBottomColor: campusMapPalette.controlShadow,
    borderBottomWidth: 5,
    borderColor: campusMapPalette.controlHighlight,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderTopWidth: 3,
    gap: 8,
    maxWidth: 320,
    padding: 16,
    position: "absolute",
    top: "32%",
    zIndex: 40
  },
  featherBannerTitle: {
    color: campusMapPalette.inkStrong,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.8,
    textAlign: "center"
  },
  featherBannerText: {
    color: campusMapPalette.ink,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    textAlign: "center"
  },
  featherBannerButton: {
    alignSelf: "center",
    backgroundColor: campusMapPalette.controlGold,
    borderBottomColor: campusMapPalette.controlShadow,
    borderBottomWidth: 4,
    borderColor: campusMapPalette.controlHighlight,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderTopWidth: 3,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 14
  },
  featherBannerButtonText: {
    color: campusMapPalette.inkStrong,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.7
  },
  searchArea: {
    alignItems: "flex-end",
    position: "absolute",
    right: 10,
    top: 9,
    zIndex: 20
  },
  searchToggle: {
    alignItems: "center",
    backgroundColor: campusMapPalette.controlGold,
    borderBottomColor: campusMapPalette.controlShadow,
    borderBottomWidth: 4,
    borderColor: campusMapPalette.controlHighlight,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderTopWidth: 3,
    height: 42,
    justifyContent: "center",
    width: 44
  },
  debugToggle: {
    alignItems: "center",
    backgroundColor: campusMapPalette.mapPanel,
    borderColor: campusMapPalette.controlGold,
    borderWidth: 1,
    marginTop: 6,
    paddingHorizontal: 7,
    paddingVertical: 5
  },
  debugToggleActive: {
    backgroundColor: campusMapPalette.maroon
  },
  debugToggleText: {
    color: campusMapPalette.controlGold,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.7
  },
  searchPanel: {
    backgroundColor: campusMapPalette.paper,
    borderColor: campusMapPalette.inkStrong,
    borderWidth: 3,
    gap: 7,
    marginTop: 6,
    padding: 8,
    width: 236
  },
  searchLabel: {
    color: campusMapPalette.maroon,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1
  },
  searchInputRow: {
    backgroundColor: campusMapPalette.paperBright,
    borderColor: campusMapPalette.mutedBorder,
    borderWidth: 2,
    paddingHorizontal: 7
  },
  searchInput: {
    color: campusMapPalette.ink,
    fontSize: 12,
    fontWeight: "700",
    paddingVertical: 8
  },
  results: {
    maxHeight: 155
  },
  resultButton: {
    backgroundColor: campusMapPalette.sand,
    borderColor: campusMapPalette.sandOutline,
    borderWidth: 1,
    marginBottom: 4,
    paddingHorizontal: 8,
    paddingVertical: 8
  },
  resultText: {
    color: campusMapPalette.ink,
    fontSize: 11,
    fontWeight: "800"
  },
  noResults: {
    color: campusMapPalette.mutedText,
    fontSize: 11,
    fontWeight: "700",
    paddingVertical: 5
  },
  searchHint: {
    color: campusMapPalette.mutedText,
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 14
  },
  highlight: {
    backgroundColor: "rgba(255, 215, 91, 0.26)",
    borderColor: campusMapPalette.goldGlow,
    borderWidth: 3,
    shadowColor: campusMapPalette.goldGlow,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 5
  },
  debugLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4
  },
  debugWalkZone: {
    backgroundColor: "rgba(29, 160, 75, 0.17)",
    borderColor: "rgba(29, 160, 75, 0.72)",
    borderWidth: 1
  },
  debugBuildingRegion: {
    backgroundColor: "rgba(204, 32, 46, 0.22)",
    borderColor: "rgba(224, 59, 69, 0.85)",
    borderWidth: 1
  },
  debugInteractionZone: {
    backgroundColor: "rgba(255, 215, 91, 0.24)",
    borderColor: campusMapPalette.goldGlow,
    borderWidth: 1
  },
  debugFootPoint: {
    backgroundColor: campusMapPalette.cyan,
    borderColor: campusMapPalette.cyanOutline,
    borderRadius: 4,
    borderWidth: 1,
    height: 7,
    marginLeft: -3,
    marginTop: -3,
    position: "absolute",
    width: 7
  },
  spritePosition: {
    height: SPRITE_HEIGHT,
    position: "absolute",
    width: SPRITE_WIDTH,
    zIndex: 6
  },
  spriteImage: {
    height: "100%",
    width: "100%"
  },
  promptPosition: {
    maxWidth: 185,
    position: "absolute",
    zIndex: 12
  },
  promptButton: {
    alignItems: "center",
    backgroundColor: campusMapPalette.deepMaroon,
    borderColor: campusMapPalette.paleGold,
    borderWidth: 2,
    flexDirection: "row",
    gap: 5,
    maxWidth: 185,
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  promptText: {
    color: campusMapPalette.paleGoldText,
    flexShrink: 1,
    fontSize: 10,
    fontWeight: "900"
  },
  dpad: {
    alignItems: "center",
    backgroundColor: "rgba(30, 22, 28, 0.7)",
    borderColor: "rgba(255, 226, 140, 0.75)",
    borderWidth: 2,
    bottom: 13,
    left: 12,
    padding: 7,
    position: "absolute",
    zIndex: 18
  },
  dpadMiddle: {
    flexDirection: "row"
  },
  dpadCenter: {
    backgroundColor: campusMapPalette.promptBackdrop,
    height: 38,
    width: 38
  },
  directionButton: {
    alignItems: "center",
    backgroundColor: campusMapPalette.gold,
    borderColor: campusMapPalette.goldOutline,
    borderWidth: 2,
    height: 38,
    justifyContent: "center",
    width: 38
  },
  directionButtonPressed: {
    backgroundColor: campusMapPalette.goldPressed
  },
  dimmedControls: {
    opacity: 0.32
  },
  dialogue: {
    bottom: 12,
    left: 10,
    position: "absolute",
    right: 10,
    zIndex: 30
  },
  dialogueInner: {
    backgroundColor: campusMapPalette.paper,
    borderColor: campusMapPalette.inkStrong,
    borderWidth: 4,
    gap: 8,
    padding: 12,
    shadowColor: campusMapPalette.shadow,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.38,
    shadowRadius: 0
  },
  dialogueMascot: {
    position: "absolute",
    right: 35,
    top: -72,
    zIndex: 4
  },
  dialogueHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10
  },
  dialogueTitleArea: {
    flex: 1,
    gap: 2
  },
  dialogueMarker: {
    color: campusMapPalette.tupMaroon,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1
  },
  dialogueTitle: {
    color: campusMapPalette.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  dialogueClose: {
    alignItems: "center",
    backgroundColor: campusMapPalette.gold,
    borderColor: campusMapPalette.goldOutline,
    borderWidth: 2,
    height: 30,
    justifyContent: "center",
    width: 30
  },
  dialogueText: {
    color: campusMapPalette.text,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18
  },
  detailText: {
    color: campusMapPalette.text,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 17
  },
  dialogueAction: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: campusMapPalette.deepMaroon,
    borderColor: campusMapPalette.dialogOutline,
    borderWidth: 2,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 9
  },
  dialogueActionText: {
    color: campusMapPalette.paleGoldBright,
    fontSize: 11,
    fontWeight: "900"
  }
});
