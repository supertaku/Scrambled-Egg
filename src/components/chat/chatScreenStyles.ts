import { StyleSheet } from "react-native";

import { chatListeningPalette } from "@/theme/featurePalettes";
import type { Theme } from "@/theme/themes";

export const createChatScreenStyles = ({ colors }: Theme) => StyleSheet.create({
  safeArea: { backgroundColor: colors.maroon, flex: 1 },
  headerArea: {
    alignItems: "center",
    backgroundColor: colors.maroon,
    justifyContent: "center",
    minHeight: 54,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12
  },
  headerTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%"
  },
  headerTitle: { color: colors.white, fontSize: 20, fontWeight: "900" },
  headerGap: { width: 74 },
  startFreshButton: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    minHeight: 34,
    paddingHorizontal: 9
  },
  startFreshButtonPressed: {
    opacity: 0.7
  },
  startFreshButtonDisabled: {
    opacity: 0.45
  },
  startFreshText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "900"
  },
  modelIndicator: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    maxWidth: "92%",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginTop: 4
  },
  modelIndicatorText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "600",
    opacity: 0.9,
    textAlign: "center"
  },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    flex: 1,
    overflow: "hidden"
  },
  screen: { backgroundColor: "transparent", flex: 1 },
  listAndStreamColumn: { flex: 1 },
  roleDropdown: {
    left: 14,
    position: "absolute",
    right: 54,
    top: 12,
    zIndex: 20
  },
  listeningPanel: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderBottomColor: "rgba(122,0,25,0.08)",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 82,
    paddingBottom: 6,
    paddingHorizontal: 18,
    paddingTop: 8
  },
  branchScene: {
    height: 66,
    justifyContent: "flex-end",
    position: "relative",
    width: 104
  },
  branchLine: {
    backgroundColor: chatListeningPalette.branch,
    borderRadius: 999,
    bottom: 12,
    height: 8,
    left: 4,
    position: "absolute",
    right: 2,
    transform: [{ rotate: "-5deg" }]
  },
  branchOffshoot: {
    backgroundColor: chatListeningPalette.branch,
    borderRadius: 999,
    bottom: 22,
    height: 6,
    left: 65,
    position: "absolute",
    transform: [{ rotate: "-28deg" }],
    width: 30
  },
  branchLeaf: {
    backgroundColor: chatListeningPalette.leaf,
    borderBottomLeftRadius: 12,
    borderTopRightRadius: 12,
    bottom: 36,
    height: 14,
    left: 88,
    position: "absolute",
    transform: [{ rotate: "18deg" }],
    width: 20
  },
  listeningMascot: {
    bottom: 9,
    left: 30,
    position: "absolute",
  },
  listeningBubble: {
    backgroundColor: colors.card,
    borderColor: colors.ink,
    borderRadius: 18,
    borderTopLeftRadius: 8,
    borderWidth: 1.5,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: "relative",
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 0
  },
  listeningBubbleTailBorder: {
    borderBottomColor: "transparent",
    borderBottomWidth: 10,
    borderRightColor: colors.ink,
    borderRightWidth: 15,
    borderTopColor: "transparent",
    borderTopWidth: 10,
    height: 0,
    left: -15,
    position: "absolute",
    top: 25,
    width: 0,
    zIndex: 1
  },
  listeningBubbleTail: {
    borderBottomColor: "transparent",
    borderBottomWidth: 8,
    borderRightColor: colors.white,
    borderRightWidth: 13,
    borderTopColor: "transparent",
    borderTopWidth: 8,
    height: 0,
    left: -11,
    position: "absolute",
    top: 27,
    width: 0,
    zIndex: 2
  },
  listeningName: {
    color: colors.maroon,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  listeningText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 2
  },
  messageList: { flex: 1 },
  chatBackgroundWrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: -1
  },
  chatBackground: {
    width: 300,
    height: 300,
    opacity: 0.05
  },
  messages: { gap: 10, padding: 16, paddingTop: 24, paddingBottom: 160 },
  suggestedQuestionsWrap: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 2,
    marginLeft: 44,
    padding: 14,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 0
  },
  sessionNotice: {
    alignSelf: "center",
    backgroundColor: colors.maroonSoft,
    borderColor: colors.maroonBorder,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 8,
    marginHorizontal: 16,
    marginTop: 14,
    maxWidth: "92%",
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  sessionNoticeText: {
    color: colors.maroonDark,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center"
  },
  memoryIndicator: {
    alignSelf: "center",
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 2,
    marginTop: -2,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  memoryFresh: {
    backgroundColor: colors.successSoft,
    borderColor: "rgba(22, 163, 74, 0.22)"
  },
  memoryWarn: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.gold
  },
  memoryIndicatorText: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: "900"
  },
  hakiRow: { justifyContent: "flex-start", flexDirection: "row", alignItems: "flex-end", marginBottom: 16, gap: 8 },
  hakiAvatarContainer: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.gold,
    borderRadius: 18,
    borderWidth: 1.5,
    height: 36,
    justifyContent: "center",
    overflow: "hidden",
    width: 36
  },
  hakiAvatar: {
    marginTop: 2
  },
  bubble: { borderRadius: 20, maxWidth: "82%", paddingHorizontal: 14, paddingVertical: 10, position: "relative" },
  hakiBubble: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: 9,
    borderColor: colors.ink,
    borderWidth: 1,
    elevation: 1,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 0
  },
  hakiBubbleTailBorder: {
    borderBottomColor: "transparent",
    borderBottomWidth: 8,
    borderRightColor: colors.ink,
    borderRightWidth: 12,
    borderTopColor: "transparent",
    borderTopWidth: 8,
    bottom: 9,
    height: 0,
    left: -12,
    position: "absolute",
    width: 0,
    zIndex: 1
  },
  hakiBubbleTail: {
    borderBottomColor: "transparent",
    borderBottomWidth: 7,
    borderRightColor: colors.white,
    borderRightWidth: 10,
    borderTopColor: "transparent",
    borderTopWidth: 7,
    bottom: 10,
    height: 0,
    left: -9,
    position: "absolute",
    width: 0,
    zIndex: 2
  },
  typingBubble: { alignItems: "center", flexDirection: "row", gap: 8 },
  typingText: { color: colors.muted, fontSize: 13, fontWeight: "700" }
});
