import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, UsersRound } from "lucide-react-native";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/theme/colors";

interface OrgGroup {
  key: string;
  name: string;
  description: string;
  nodes: string[];
}

const organizationGroups: OrgGroup[] = [
  {
    key: "campus-director",
    name: "Campus Director",
    description: "Top campus leadership and final escalation path for campus-wide concerns.",
    nodes: ["Campus Director", "Executive Support Staff", "Campus-wide Coordination"]
  },
  {
    key: "academic-affairs",
    name: "Assistant Director for Academic Affairs",
    description: "Academic coordination, faculty concerns, and instruction-related routing.",
    nodes: ["Assistant Director for Academic Affairs", "Program and College Coordination", "Academic Records Routing"]
  },
  {
    key: "engineering",
    name: "College of Engineering",
    description: "Academic unit for engineering programs, advising, and college-level processing.",
    nodes: ["College Dean or Officer-in-Charge", "Department Chairs", "Program Advisers", "Students"]
  },
  {
    key: "engineering-technology",
    name: "College of Engineering Technology",
    description: "Academic unit for technology programs, lab coordination, and advising.",
    nodes: ["College Dean or Officer-in-Charge", "Program Chairs", "Laboratory Coordinators", "Students"]
  },
  {
    key: "education-sciences",
    name: "College of Education and Sciences",
    description: "Academic unit for education and sciences programs, advising, and student support.",
    nodes: ["College Dean or Officer-in-Charge", "Program Chairs", "Faculty Advisers", "Students"]
  },
  {
    key: "registrar",
    name: "Registrar",
    description: "Handles enrollment records, document requests, COR concerns, and academic records routing.",
    nodes: ["Registrar Head", "Records Verification", "Document Releasing", "Students"]
  },
  {
    key: "accounting",
    name: "Accounting",
    description: "Handles payment validation, financial clearance, and accounting-related student concerns.",
    nodes: ["Accounting Head", "Assessment and Validation", "Clearance Checking", "Students"]
  },
  {
    key: "clinic",
    name: "Clinic",
    description: "Handles first aid, clinic assistance, health records, and campus medical support.",
    nodes: ["Clinic Personnel", "Medical Assistance Desk", "Emergency Referral", "Students"]
  },
  {
    key: "guidance",
    name: "Guidance",
    description: "Handles counseling, student wellness support, and guidance-related referrals.",
    nodes: ["Guidance Counselor", "Counseling Intake", "Student Follow-up", "Students"]
  },
  {
    key: "student-affairs",
    name: "Office of Student Affairs",
    description: "Handles student conduct, activities, organizations, and student support routing.",
    nodes: ["OSA Head", "Student Activities", "Conduct and Discipline", "Students"]
  },
  {
    key: "library",
    name: "Library",
    description: "Handles library services, resource access, borrowing guidance, and research support.",
    nodes: ["Library Head", "Circulation Desk", "Reference Support", "Students"]
  }
];

export default function OrganizationScreen() {
  const defaultGroup = organizationGroups[0];
  const [selectedKey, setSelectedKey] = useState(defaultGroup?.key ?? "");
  const selectedGroup = useMemo(
    () => organizationGroups.find((group) => group.key === selectedKey) ?? defaultGroup,
    [selectedKey, defaultGroup]
  );
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 30,
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
        <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <View style={styles.section}>
          <View style={styles.introCard}>
            <Building2 color={colors.maroon} size={24} />
            <View style={styles.introCopy}>
              <Text style={styles.introTitle}>University organization</Text>
              <Text style={styles.introText}>
                Browse common offices and academic groups used for routing campus concerns.
              </Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupTabs}>
            {organizationGroups.map((group) => (
              <Pressable
                key={group.key}
                onPress={() => setSelectedKey(group.key)}
                style={[styles.groupTab, selectedGroup.key === group.key && styles.groupTabActive]}
              >
                <Text style={[styles.groupTabText, selectedGroup.key === group.key && styles.groupTabTextActive]}>
                  {group.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <UsersRound color={colors.gold} size={22} />
              <View style={styles.chartHeaderCopy}>
                <Text style={styles.smallLabel}>Selected group</Text>
                <Text style={styles.chartTitle}>{selectedGroup.name}</Text>
              </View>
            </View>
            <Text style={styles.description}>{selectedGroup.description}</Text>

            <View style={styles.chart}>
              {selectedGroup.nodes.map((node, index) => (
                <View key={`${selectedGroup.key}-${node}`} style={styles.nodeWrap}>
                  <View style={[styles.node, index === 0 && styles.nodePrimary]}>
                    <Text style={[styles.nodeText, index === 0 && styles.nodeTextPrimary]}>{node}</Text>
                  </View>
                  {index < selectedGroup.nodes.length - 1 ? <View style={styles.connector} /> : null}
                </View>
              ))}
            </View>
          </View>

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
    fontWeight: "900"
  },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    flex: 1,
    overflow: "hidden"
  },
  scroll: {
    flex: 1
  },
  content: {
    backgroundColor: colors.surface,
    gap: 18,
    paddingTop: 24,
    paddingBottom: 110
  },
  section: {
    gap: 14,
    paddingHorizontal: 18
  },
  introCard: {
    alignItems: "flex-start",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 16
  },
  introCopy: {
    flex: 1,
    gap: 4
  },
  introTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900"
  },
  introText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20
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
    paddingHorizontal: 13,
    paddingVertical: 9
  },
  groupTabActive: {
    backgroundColor: colors.maroon,
    borderColor: colors.maroon
  },
  groupTabText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800"
  },
  groupTabTextActive: {
    color: colors.white
  },
  chartCard: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
    padding: 16
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
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  chartTitle: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: "900",
    lineHeight: 24
  },
  description: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20
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
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 50,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: "100%"
  },
  nodePrimary: {
    backgroundColor: colors.maroon,
    borderColor: colors.maroon
  },
  nodeText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
    textAlign: "center"
  },
  nodeTextPrimary: {
    color: colors.white
  },
  connector: {
    backgroundColor: colors.gold,
    height: 18,
    width: 2
  },
  noteCard: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.gold,
    borderRadius: 18,
    borderWidth: 1,
    gap: 5,
    padding: 14
  },
  noteTitle: {
    color: colors.maroonDark,
    fontSize: 15,
    fontWeight: "900"
  },
  noteText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19
  }
});
