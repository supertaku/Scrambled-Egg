import { useCallback, useEffect, useState } from "react";
import { LogOut, ShieldCheck } from "lucide-react-native";
import { Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { disableAdminMode, getAdminMode, subscribeAdminMode, verifyAndEnableAdminMode } from "@/services/adminService";
import { colors } from "@/theme/colors";

interface AdminUnlockModalProps {
  onClose: () => void;
  visible: boolean;
}

export function AdminUnlockModal({ onClose, visible }: AdminUnlockModalProps) {
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
    const unlocked = await verifyAndEnableAdminMode(adminCode);
    if (!unlocked) {
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
            <Image
              resizeMode="contain"
              source={require("../../assets/images/mascot/grayhawk-interrogating.png")}
              style={styles.interrogationMascot}
            />
            <View style={styles.questionBubble}>
              <Text style={styles.questionBubbleText}>?</Text>
            </View>
          </View>

          <Text style={styles.adminTitle}>{adminMode ? "Admin mode is active" : "Admin ka ba?"}</Text>
          <Text style={styles.adminText}>
            {adminMode
              ? "Admin-only pages are visible. Exit admin mode when done managing documents."
              : "Enter the admin code para lumabas ang Documents, Import, and About tabs."}
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
                placeholder="Admin code"
                placeholderTextColor={colors.muted}
                secureTextEntry
                style={styles.adminInput}
                value={adminCode}
              />
              {adminError ? <Text style={styles.adminError}>{adminError}</Text> : null}
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

const styles = StyleSheet.create({
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(31, 41, 51, 0.52)",
    flex: 1,
    justifyContent: "center",
    padding: 20
  },
  adminModal: {
    backgroundColor: colors.white,
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
    borderColor: "#E8C7D0",
    borderRadius: 18,
    borderWidth: 1,
    height: 118,
    justifyContent: "center",
    marginBottom: 4,
    overflow: "hidden",
    width: 118
  },
  interrogationMascot: {
    height: 98,
    width: 98
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
    backgroundColor: colors.white,
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
