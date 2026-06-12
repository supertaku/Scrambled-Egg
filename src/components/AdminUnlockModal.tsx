import { useCallback, useEffect, useState } from "react";
import { LogOut, ShieldCheck } from "lucide-react-native";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { disableAdminMode, getAdminMode, subscribeAdminMode, tryUnlockAdminMode } from "@/services/adminService";
import { HakiHdMascot, HD_DETECTIVE_IMAGE } from "@/mascot";
import { useThemeColors, useThemedStyles } from "@/theme/ThemeProvider";
import type { Theme } from "@/theme/themes";

interface AdminUnlockModalProps {
  onClose: () => void;
  visible: boolean;
}

export function AdminUnlockModal({ onClose, visible }: AdminUnlockModalProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [adminMode, setAdminMode] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const [adminError, setAdminError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getAdminMode().then((enabled) => {
      if (mounted) {
        setAdminMode(enabled);
      }
    });

    const unsubscribe = subscribeAdminMode((enabled) => {
      setAdminMode(enabled);
      if (enabled) {
        setAdminCode("");
        setAdminError(null);
        onClose();
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [onClose]);

  const handleAdminSubmit = useCallback(async () => {
    const result = await tryUnlockAdminMode(adminCode);
    if (result.ok) return;
    if (typeof result.lockedForMs === "number" && result.lockedForMs > 0) {
      const seconds = Math.ceil(result.lockedForMs / 1000);
      setAdminError(`Too many attempts. Try again in ${seconds}s.`);
    } else if (typeof result.attemptsRemaining === "number") {
      setAdminError(
        result.attemptsRemaining > 0
          ? `Invalid admin code. ${result.attemptsRemaining} attempt${result.attemptsRemaining === 1 ? "" : "s"} left.`
          : "Invalid admin code."
      );
    } else {
      setAdminError("Invalid admin code.");
    }
  }, [adminCode]);

  const handleAdminLogout = useCallback(async () => {
    await disableAdminMode();
    setAdminCode("");
    setAdminError(null);
    onClose();
  }, [onClose]);

  const closeModal = useCallback(() => {
    setAdminCode("");
    setAdminError(null);
    onClose();
  }, [onClose]);

  return (
    <Modal animationType="fade" onRequestClose={closeModal} transparent visible={visible}>
      <View style={styles.modalBackdrop}>
        <View style={styles.adminModal}>
          <View style={styles.interrogationFrame}>
            <HakiHdMascot animated={false} height={100} source={HD_DETECTIVE_IMAGE} status="interrogating" style={styles.interrogationMascot} width={71} />
            <View style={styles.questionBubble}>
              <Text style={styles.questionBubbleText}>?</Text>
            </View>
          </View>

          <Text style={styles.adminTitle}>{adminMode ? "Administrator access is on" : "Administrator sign in"}</Text>
          <Text style={styles.adminText}>
            {adminMode
              ? "Administrator pages are available. Sign out when you are done managing campus files."
              : "Enter the administrator code to manage campus files."}
          </Text>

          {adminMode ? (
            <View style={styles.adminActions}>
              <Pressable onPress={closeModal} style={[styles.adminButton, styles.adminButtonSecondary]}>
                <Text style={styles.adminButtonSecondaryText}>Close</Text>
              </Pressable>
              <Pressable onPress={handleAdminLogout} style={styles.adminButton}>
                <LogOut color={colors.white} size={16} />
                <Text style={styles.adminButtonText}>Exit admin</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.adminUnlock}>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={(text) => {
                  setAdminCode(text);
                  setAdminError(null);
                }}
                onSubmitEditing={handleAdminSubmit}
                placeholder="Administrator code"
                placeholderTextColor={colors.muted}
                secureTextEntry
                style={styles.adminInput}
                value={adminCode}
              />
              {adminError ? <Text selectable style={styles.adminError}>{adminError}</Text> : null}
              <View style={styles.adminActions}>
                <Pressable onPress={closeModal} style={[styles.adminButton, styles.adminButtonSecondary]}>
                  <Text style={styles.adminButtonSecondaryText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={handleAdminSubmit} style={styles.adminButton}>
                  <ShieldCheck color={colors.white} size={16} />
                  <Text style={styles.adminButtonText}>Unlock</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = ({ colors }: Theme) => StyleSheet.create({
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(31, 41, 51, 0.52)",
    flex: 1,
    justifyContent: "center",
    padding: 20
  },
  adminModal: {
    backgroundColor: colors.card,
    borderRadius: 18,
    gap: 12,
    maxWidth: 360,
    padding: 18,
    width: "100%"
  },
  interrogationFrame: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.maroonSoft,
    borderColor: colors.maroonBorder,
    borderRadius: 18,
    borderWidth: 1,
    height: 118,
    justifyContent: "center",
    marginBottom: 4,
    overflow: "hidden",
    width: 118
  },
  interrogationMascot: {
    marginTop: 10
  },
  questionBubble: {
    alignItems: "center",
    backgroundColor: colors.gold,
    borderColor: colors.white,
    borderRadius: 18,
    borderWidth: 2,
    height: 36,
    justifyContent: "center",
    position: "absolute",
    right: 10,
    top: 10,
    width: 36
  },
  questionBubbleText: {
    color: colors.maroonDark,
    fontSize: 22,
    fontWeight: "900"
  },
  adminTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center"
  },
  adminText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center"
  },
  adminUnlock: {
    gap: 8
  },
  adminInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 14,
    minHeight: 44,
    paddingHorizontal: 12
  },
  adminError: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "700"
  },
  adminActions: {
    flexDirection: "row",
    gap: 10
  },
  adminButton: {
    alignItems: "center",
    backgroundColor: colors.maroon,
    borderRadius: 12,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 12
  },
  adminButtonSecondary: {
    backgroundColor: colors.card,
    borderColor: colors.maroon,
    borderWidth: 1
  },
  adminButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "900"
  },
  adminButtonSecondaryText: {
    color: colors.maroon,
    fontSize: 13,
    fontWeight: "900"
  }
});
