import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, UsersRound } from "lucide-react-native";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/theme/colors";
import { organizationGroups, type OrgGroup } from "@/data/organizationGroups";

function AnimatedNode({ node, index, isPrimary, groupKey }: { node: string; index: number; isPrimary: boolean; groupKey: string }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.92);
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 80, useNativeDriver: true })
      ]).start();
    }, index * 80);
    return () => clearTimeout(timer);
  }, [groupKey, index, fadeAnim, scaleAnim]);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
      <View style={[styles.node, isPrimary ? styles.nodePrimary : undefined]}>
        <Text style={[styles.nodeText, isPrimary ? styles.nodeTextPrimary : undefined]}>{node}</Text>
      </View>
    </Animated.View>
  );
}

function AnimatedConnector({ index, groupKey }: { index: number; groupKey: string }) {
  const heightAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    heightAnim.setValue(0);
    const timer = setTimeout(() => {
      Animated.timing(heightAnim, { toValue: 20, duration: 200, useNativeDriver: false }).start();
    }, index * 80 + 120);
    return () => clearTimeout(timer);
  }, [groupKey, index, heightAnim]);

  return (
    <View style={styles.connectorWrap}>
      <Animated.View style={[styles.connector, { height: heightAnim }]} />
    </View>
  );
}

export default function OrganizationScreen() {
  const defaultGroup = organizationGroups[0];
  const [selectedKey, setSelectedKey] = useState(defaultGroup?.key ?? "");
  const selectedGroup = useMemo(
    () => organizationGroups.find((group) => group.key === selectedKey) ?? defaultGroup,
    [selectedKey, defaultGroup]
  );
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 340,
        useNativeDriver: true
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 9,
        tension: 50,
        useNativeDriver: true
      })
    ]).start();
  }, [fadeAnim, slideAnim]);

  if (!selectedGroup) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.headerArea}>
        <Text style={styles.headerTitle}>Organization</Text>
      </View>
      <View style={styles.sheetContainer}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

            <View style={styles.section}>
              {/* Intro card */}
              <View style={styles.introCard}>
                <View style={styles.introIconBg}>
                  <Building2 color={colors.maroon} size={22} />
                </View>
                <View style={styles.introCopy}>
                  <Text style={styles.introLabel}>TUP Taguig</Text>
                  <Text style={styles.introTitle}>University organization</Text>
                  <Text style={styles.introText}>
                    Browse common offices and academic groups used for routing campus concerns.
                  </Text>
                </View>
              </View>

              {/* Tab chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupTabs}>
                {organizationGroups.map((group) => {
                  const isActive = selectedGroup.key === group.key;
                  return (
                    <GroupTab
                      key={group.key}
                      group={group}
                      isActive={isActive}
                      onPress={() => setSelectedKey(group.key)}
                    />
                  );
                })}
              </ScrollView>

              {/* Chart card */}
              <View style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <UsersRound color={colors.gold} size={20} />
                  <View style={styles.chartHeaderCopy}>
                    <Text style={styles.smallLabel}>Selected group</Text>
                    <Text style={styles.chartTitle}>{selectedGroup.name}</Text>
                  </View>
                </View>
                <Text style={styles.description}>{selectedGroup.description}</Text>

                <View style={styles.chart}>
                  {selectedGroup.nodes.map((node, index) => (
                    <View key={`${selectedGroup.key}-${node}`} style={styles.nodeWrap}>
                      <AnimatedNode
                        node={node}
                        index={index}
                        isPrimary={index === 0}
                        groupKey={selectedGroup.key}
                      />
                      {index < selectedGroup.nodes.length - 1 ? (
                        <AnimatedConnector index={index} groupKey={selectedGroup.key} />
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>

              {/* Note card */}
              <View style={styles.noteCard}>
                <Text style={styles.noteTitle}>Data note</Text>
                <Text style={styles.noteText}>
                  Office routing should still be verified with official campus announcements or the responsible office.
                </Text>
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

function GroupTab({
  group,
  isActive,
  onPress
}: {
  group: OrgGroup;
  isActive: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.93, useNativeDriver: true, friction: 6, tension: 200 }).start();
  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 160 }).start();

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={[styles.groupTab, isActive && styles.groupTabActive, { transform: [{ scale }] }]}>
        <Text style={[styles.groupTabText, isActive && styles.groupTabTextActive]}>
          {group.name}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.maroon,
    flex: 1
  },
  headerArea: {
    alignItems: "center",
    backgroundColor: colors.maroon,
    justifyContent: "center",
    minHeight: 54,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12
  },
  headerTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.3
  },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    flex: 1,
    overflow: "hidden"
  },
  scroll: {
    flex: 1
  },
  content: {
    backgroundColor: colors.surface,
    gap: 16,
    paddingTop: 24,
    paddingBottom: 114
  },
  section: {
    gap: 14,
    paddingHorizontal: 18
  },
  introCard: {
    alignItems: "flex-start",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2
  },
  introIconBg: {
    backgroundColor: colors.maroonSoft,
    borderRadius: 14,
    padding: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  introCopy: {
    flex: 1,
    gap: 3
  },
  introLabel: {
    color: colors.maroon,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  introTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.3
  },
  introText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18
  },
  groupTabs: {
    gap: 8,
    paddingVertical: 2
  },
  groupTab: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  groupTabActive: {
    backgroundColor: colors.maroon,
    borderColor: colors.maroon,
    shadowColor: colors.maroon,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  groupTabText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700"
  },
  groupTabTextActive: {
    color: colors.white,
    fontWeight: "800"
  },
  chartCard: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2
  },
  chartHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
  },
  chartHeaderCopy: {
    flex: 1,
    gap: 2
  },
  smallLabel: {
    color: colors.maroon,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  chartTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 22,
    letterSpacing: -0.3
  },
  description: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 19
  },
  chart: {
    alignItems: "stretch",
    gap: 0
  },
  nodeWrap: {
    alignItems: "center"
  },
  node: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    width: "100%"
  },
  nodePrimary: {
    backgroundColor: colors.maroon,
    borderColor: colors.maroon,
    shadowColor: colors.maroon,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4
  },
  nodeText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    textAlign: "center"
  },
  nodeTextPrimary: {
    color: colors.white,
    fontWeight: "800"
  },
  connectorWrap: {
    alignItems: "center"
  },
  connector: {
    backgroundColor: colors.gold,
    width: 2,
    borderRadius: 1
  },
  noteCard: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.gold,
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    padding: 14
  },
  noteTitle: {
    color: colors.maroonDark,
    fontSize: 14,
    fontWeight: "900"
  },
  noteText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 19
  }
});
