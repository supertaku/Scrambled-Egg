import { useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ZoomIn, ZoomOut } from "lucide-react-native";

import { orgChartColleges, type OrgNode } from "@/data/orgChart";
import { colors } from "@/theme/colors";

const NODE_W = 190;
const NODE_H = 64;
const H_GAP = 24;
const V_GAP = 36;
const CONNECTOR_W = 2;

// ─── Recursive node layout ──────────────────────────────────────────────────

interface LayoutNode {
  node: OrgNode;
  x: number;
  y: number;
  width: number;
}

interface LayoutResult {
  nodes: LayoutNode[];
  totalWidth: number;
  totalHeight: number;
}

function layoutTree(node: OrgNode, offsetX: number, offsetY: number): LayoutResult {
  const children = node.children ?? [];

  if (children.length === 0) {
    return {
      nodes: [{ node, x: offsetX, y: offsetY, width: NODE_W }],
      totalWidth: NODE_W,
      totalHeight: NODE_H
    };
  }

  // Layout all children first
  const childResults: LayoutResult[] = [];
  let childX = 0;
  for (const child of children) {
    const result = layoutTree(child, childX, 0);
    childResults.push(result);
    childX += result.totalWidth + H_GAP;
  }

  const totalChildWidth = childX - H_GAP;
  const parentX = totalChildWidth / 2 - NODE_W / 2;

  // Offset all children by offsetX, offsetY + NODE_H + V_GAP
  const allNodes: LayoutNode[] = [{ node, x: offsetX + parentX, y: offsetY, width: NODE_W }];
  let runX = offsetX;
  for (const cr of childResults) {
    for (const n of cr.nodes) {
      allNodes.push({ node: n.node, x: runX + n.x, y: offsetY + NODE_H + V_GAP + n.y, width: n.width });
    }
    runX += cr.totalWidth + H_GAP;
  }

  const maxChildY = Math.max(...childResults.map((cr) => cr.totalHeight));
  return {
    nodes: allNodes,
    totalWidth: Math.max(NODE_W, totalChildWidth),
    totalHeight: NODE_H + V_GAP + maxChildY
  };
}

// Build connector lines between parent and each child
function buildConnectors(
  nodes: LayoutNode[],
  root: OrgNode
): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];

  function walk(node: OrgNode) {
    const parentLayout = nodes.find((n) => n.node.id === node.id);
    if (!parentLayout) return;

    for (const child of node.children ?? []) {
      const childLayout = nodes.find((n) => n.node.id === child.id);
      if (!childLayout) continue;

      const x1 = parentLayout.x + NODE_W / 2;
      const y1 = parentLayout.y + NODE_H;
      const x2 = childLayout.x + NODE_W / 2;
      const y2 = childLayout.y;
      lines.push({ x1, y1, x2, y2 });
      walk(child);
    }
  }

  walk(root);
  return lines;
}

// ─── Single node card ─────────────────────────────────────────────────────

function NodeCard({ node, isPrimary }: { node: OrgNode; isPrimary: boolean }) {
  return (
    <View style={[styles.node, isPrimary ? styles.nodePrimary : undefined]}>
      <Text style={[styles.nodeName, isPrimary ? styles.nodeNamePrimary : undefined]} numberOfLines={2}>
        {node.name}
      </Text>
      <Text style={[styles.nodeTitle, isPrimary ? styles.nodeTitlePrimary : undefined]} numberOfLines={2}>
        {node.title}
      </Text>
    </View>
  );
}

// ─── Connector line as absolutely-positioned View ──────────────────────────

function Connector({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  // Midpoint vertical line: from (x1,y1) → mid → (x2, y2)
  const midY = (y1 + y2) / 2;

  return (
    <>
      {/* Down from parent */}
      <View
        style={{
          position: "absolute",
          left: x1 - CONNECTOR_W / 2,
          top: y1,
          width: CONNECTOR_W,
          height: midY - y1,
          backgroundColor: colors.gold
        }}
      />
      {/* Horizontal segment */}
      {x1 !== x2 && (
        <View
          style={{
            position: "absolute",
            left: Math.min(x1, x2),
            top: midY - CONNECTOR_W / 2,
            width: Math.abs(x2 - x1) + CONNECTOR_W,
            height: CONNECTOR_W,
            backgroundColor: colors.gold
          }}
        />
      )}
      {/* Down to child */}
      <View
        style={{
          position: "absolute",
          left: x2 - CONNECTOR_W / 2,
          top: midY,
          width: CONNECTOR_W,
          height: y2 - midY,
          backgroundColor: colors.gold
        }}
      />
    </>
  );
}

// ─── Main OrgChart screen ─────────────────────────────────────────────────

export default function OrgChartScreen() {
  const [selectedCollege, setSelectedCollege] = useState(0);

  const college = orgChartColleges[selectedCollege]!;
  const { nodes, totalWidth, totalHeight } = layoutTree(college.data, 20, 20);
  const connectors = buildConnectors(nodes, college.data);

  const canvasW = totalWidth + 40;
  const canvasH = totalHeight + 40;

  // Pan & zoom
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const scaleVal = useRef(0.9);
  const txVal = useRef(0);
  const tyVal = useRef(0);

  translateX.addListener(({ value }) => { txVal.current = value; });
  translateY.addListener(({ value }) => { tyVal.current = value; });
  scale.addListener(({ value }) => { scaleVal.current = value; });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_e, gs) => {
        translateX.setValue(txVal.current + gs.dx - (gs.dx > 0 ? 0 : 0));
        translateY.setValue(tyVal.current + gs.dy);
      },
      onPanResponderRelease: (_e, gs) => {
        txVal.current = txVal.current + gs.dx;
        tyVal.current = tyVal.current + gs.dy;
        translateX.setValue(txVal.current);
        translateY.setValue(tyVal.current);
      }
    })
  ).current;

  const zoom = (delta: number) => {
    const next = Math.min(2, Math.max(0.4, scaleVal.current + delta));
    Animated.spring(scale, {
      toValue: next,
      useNativeDriver: true,
      friction: 8,
      tension: 100
    }).start();
  };

  const resetView = () => {
    Animated.parallel([
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 8, tension: 80 }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 8, tension: 80 }),
      Animated.spring(scale, { toValue: 0.9, useNativeDriver: true, friction: 8, tension: 80 })
    ]).start();
    txVal.current = 0;
    tyVal.current = 0;
  };

  // Reset pan/zoom when switching colleges
  const switchCollege = (idx: number) => {
    setSelectedCollege(idx);
    txVal.current = 0;
    tyVal.current = 0;
    translateX.setValue(0);
    translateY.setValue(0);
    scale.setValue(0.9);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Org Chart</Text>
      </View>

      {/* College tabs */}
      <View style={styles.sheetContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabRow}
        >
          {orgChartColleges.map((col, idx) => {
            const active = idx === selectedCollege;
            return (
              <Pressable key={col.key} onPress={() => switchCollege(idx)}>
                <View style={[styles.tab, active && styles.tabActive]}>
                  <Text style={[styles.tabShort, active && styles.tabShortActive]}>{col.short}</Text>
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={2}>
                    {col.label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Zoom controls */}
        <View style={styles.zoomControls}>
          <Pressable onPress={() => zoom(0.2)} style={styles.zoomBtn}>
            <ZoomIn color={colors.maroon} size={20} />
          </Pressable>
          <Pressable onPress={resetView} style={styles.zoomBtn}>
            <Text style={styles.zoomReset}>Reset</Text>
          </Pressable>
          <Pressable onPress={() => zoom(-0.2)} style={styles.zoomBtn}>
            <ZoomOut color={colors.maroon} size={20} />
          </Pressable>
        </View>

        {/* Draggable canvas */}
        <View style={styles.canvas} {...panResponder.panHandlers}>
          <Animated.View
            style={{
              width: canvasW,
              height: canvasH,
              transform: [
                { translateX },
                { translateY },
                { scale }
              ]
            }}
          >
            {/* Connectors below nodes */}
            {connectors.map((line, i) => (
              <Connector key={i} {...line} />
            ))}

            {/* Nodes */}
            {nodes.map((n) => (
              <View
                key={n.node.id}
                style={{ position: "absolute", left: n.x, top: n.y, width: NODE_W }}
              >
                <NodeCard node={n.node} isPrimary={n.node.id === college.data.id} />
              </View>
            ))}
          </Animated.View>
        </View>

        {/* Hint */}
        <View style={styles.hintBar}>
          <Text style={styles.hintText}>Drag to pan · Use +/− to zoom</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.maroon, flex: 1 },
  header: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 54,
    paddingBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 8
  },
  headerTitle: { color: colors.white, fontSize: 20, fontWeight: "900", letterSpacing: -0.3 },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    flex: 1,
    overflow: "hidden"
  },
  tabRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 12
  },
  tab: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: 160,
    gap: 2
  },
  tabActive: {
    backgroundColor: colors.maroon,
    borderColor: colors.maroon,
    shadowColor: colors.maroon,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  tabShort: { color: colors.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8 },
  tabShortActive: { color: "rgba(255,255,255,0.7)" },
  tabLabel: { color: colors.ink, fontSize: 13, fontWeight: "800", lineHeight: 17 },
  tabLabelActive: { color: colors.white },
  zoomControls: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingBottom: 10
  },
  zoomBtn: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  zoomReset: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  canvas: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: colors.surface
  },
  hintBar: {
    alignItems: "center",
    paddingVertical: 10,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    backgroundColor: colors.white,
    paddingBottom: 120
  },
  hintText: { color: colors.mutedLight, fontSize: 12, fontWeight: "700" },
  node: {
    width: NODE_W,
    minHeight: NODE_H,
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2
  },
  nodePrimary: {
    backgroundColor: colors.maroon,
    borderColor: colors.maroon,
    shadowColor: colors.maroon,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6
  },
  nodeName: { color: colors.ink, fontSize: 12, fontWeight: "900", lineHeight: 16 },
  nodeNamePrimary: { color: colors.white },
  nodeTitle: { color: colors.muted, fontSize: 11, fontWeight: "500", lineHeight: 15, marginTop: 2 },
  nodeTitlePrimary: { color: "rgba(255,255,255,0.75)" }
});
