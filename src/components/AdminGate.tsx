import { useEffect, useState } from "react";
import { LockKeyhole } from "lucide-react-native";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { getAdminMode, subscribeAdminMode } from "@/services/adminService";
import { useThemeColors, useThemedStyles } from "@/theme/ThemeProvider";
import type { Theme } from "@/theme/themes";

interface AdminGateProps {
  children: React.ReactNode;
  label?: string;
}

export function AdminGate({ children, label = "Only an administrator can open this section." }: AdminGateProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [adminMode, setAdminMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    getAdminMode()
      .then((enabled) => {
        if (mounted) {
          setAdminMode(enabled);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    const unsubscribe = subscribeAdminMode((enabled) => {
      setAdminMode(enabled);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={colors.maroon} />
        <Text style={styles.text}>Checking access...</Text>
      </View>
    );
  }

  if (!adminMode) {
    return (
      <View style={styles.card}>
        <LockKeyhole color={colors.maroon} size={24} />
        <Text style={styles.title}>Administrator access needed</Text>
        <Text selectable style={styles.text}>{label} Tap Haki on the home screen and enter the administrator code.</Text>
      </View>
    );
  }

  return <>{children}</>;
}

const createStyles = ({ colors }: Theme) => StyleSheet.create({
  card: {
    alignItems: "flex-start",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    margin: 18,
    padding: 16
  },
  title: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900"
  },
  text: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  }
});
