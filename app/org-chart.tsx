import { useCallback, useEffect, useMemo, useState } from "react";
import { Stack } from "expo-router";
import { Focus, ZoomIn, ZoomOut } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import {
  calculateFitTransform,
  clampOrgTranslation,
  clampOrgZoom,
  createOrgChartLayout,
  ORG_MAX_ZOOM,
  ORG_NODE_HEIGHT,
  ORG_NODE_WIDTH,
  type OrgConnector,
  type OrgTransform
} from "@/components/orgChart/orgChartLayout";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { orgChartColleges, type OrgNode } from "@/data/orgChart";
import { colors } from "@/theme/colors";

const PAN_MARGIN = 30;

function clampOffset(position: number, contentSize: number, viewportSize: number): number {
  "worklet";
  if (contentSize <= viewportSize - PAN_MARGIN * 2) {
    return (viewportSize - contentSize) / 2;
  }
  return Math.max(viewportSize - contentSize - PAN_MARGIN, Math.min(PAN_MARGIN, position));
}

function connectorPath(line: OrgConnector): string {
  const midY = (line.y1 + line.y2) / 2;
  return `M ${line.x1} ${line.y1} V ${midY} H ${line.x2} V ${line.y2}`;
}

function NodeCard({ node, primary }: { node: OrgNode; primary: boolean }) {
  return (
    <View style={[styles.node, primary ? styles.nodePrimary : undefined]}>
      <Text selectable numberOfLines={2} style={[styles.nodeName, primary ? styles.nodeNamePrimary : undefined]}>{node.name}</Text>
      <Text selectable numberOfLines={2} style={[styles.nodeTitle, primary ? styles.nodeTitlePrimary : undefined]}>{node.title}</Text>
    </View>
  );
}

export default function OrgChartScreen() {
  const reducedMotion = useReducedMotion();
  const [selectedCollege, setSelectedCollege] = useState(0);
  const [viewport, setViewport] = useState({ height: 0, width: 0 });
  const college = orgChartColleges[selectedCollege]!;
  const chart = useMemo(() => createOrgChartLayout(college.data), [college.data]);
  const fit = useMemo(() => calculateFitTransform(chart, viewport), [chart, viewport]);
  const minimumScale = Math.min(fit.scale, 0.24);

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const pinchStartScale = useSharedValue(1);
  const pinchStartX = useSharedValue(0);
  const pinchStartY = useSharedValue(0);
  const pinchFocalX = useSharedValue(0);
  const pinchFocalY = useSharedValue(0);

  const moveTo = useCallback((transform: OrgTransform, animated: boolean) => {
    if (animated && !reducedMotion) {
      scale.value = withTiming(transform.scale, { duration: 220 });
      translateX.value = withTiming(transform.x, { duration: 220 });
      translateY.value = withTiming(transform.y, { duration: 220 });
    } else {
      scale.value = transform.scale;
      translateX.value = transform.x;
      translateY.value = transform.y;
    }
  }, [reducedMotion, scale, translateX, translateY]);

  useEffect(() => {
    if (viewport.width > 0 && viewport.height > 0) {
      moveTo(fit, false);
    }
  }, [college.key, fit, moveTo, viewport.height, viewport.width]);

  const handleCanvasLayout = useCallback((event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout;
    setViewport({ height, width });
  }, []);

  const zoomBy = useCallback((factor: number) => {
    if (viewport.width <= 0 || viewport.height <= 0) {
      return;
    }

    const nextScale = clampOrgZoom(scale.value * factor, minimumScale);
    const centerX = viewport.width / 2;
    const centerY = viewport.height / 2;
    const nextTransform = clampOrgTranslation({
      scale: nextScale,
      x: centerX - ((centerX - translateX.value) / scale.value) * nextScale,
      y: centerY - ((centerY - translateY.value) / scale.value) * nextScale
    }, chart, viewport);
    if (reducedMotion) {
      moveTo(nextTransform, false);
    } else {
      scale.value = withSpring(nextTransform.scale, { damping: 18, stiffness: 170 });
      translateX.value = withSpring(nextTransform.x, { damping: 18, stiffness: 170 });
      translateY.value = withSpring(nextTransform.y, { damping: 18, stiffness: 170 });
    }
  }, [chart, minimumScale, moveTo, reducedMotion, scale, translateX, translateY, viewport]);

  const pan = Gesture.Pan()
    .maxPointers(1)
    .onStart(() => {
      panStartX.value = translateX.value;
      panStartY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = clampOffset(
        panStartX.value + event.translationX,
        chart.canvasWidth * scale.value,
        viewport.width
      );
      translateY.value = clampOffset(
        panStartY.value + event.translationY,
        chart.canvasHeight * scale.value,
        viewport.height
      );
    });

  const pinch = Gesture.Pinch()
    .onStart((event) => {
      pinchStartScale.value = scale.value;
      pinchStartX.value = translateX.value;
      pinchStartY.value = translateY.value;
      pinchFocalX.value = event.focalX;
      pinchFocalY.value = event.focalY;
    })
    .onUpdate((event) => {
      const nextScale = Math.min(ORG_MAX_ZOOM, Math.max(minimumScale, pinchStartScale.value * event.scale));
      const nextX = event.focalX - ((pinchFocalX.value - pinchStartX.value) / pinchStartScale.value) * nextScale;
      const nextY = event.focalY - ((pinchFocalY.value - pinchStartY.value) / pinchStartScale.value) * nextScale;
      scale.value = nextScale;
      translateX.value = clampOffset(nextX, chart.canvasWidth * nextScale, viewport.width);
      translateY.value = clampOffset(nextY, chart.canvasHeight * nextScale, viewport.height);
    });

  const gesture = Gesture.Simultaneous(pan, pinch);
  const animatedCanvasStyle = useAnimatedStyle(() => ({
    transformOrigin: [0, 0, 0],
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value }
    ]
  }));

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Org Chart</Text>
        <Text style={styles.headerSubtitle}>Pinch, pan, and inspect each college structure</Text>
      </View>
      <View style={styles.sheet}>
        <View style={styles.tabs}>
          {orgChartColleges.map((item, index) => {
            const selected = index === selectedCollege;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={item.key}
                onPress={() => setSelectedCollege(index)}
                style={[styles.tab, selected ? styles.tabSelected : undefined]}
              >
                <Text style={[styles.tabShort, selected ? styles.tabTextSelected : undefined]}>{item.short}</Text>
                <Text numberOfLines={3} style={[styles.tabLabel, selected ? styles.tabTextSelected : undefined]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.controlRow}>
          <Text style={styles.fitHint}>Starts fitted to show all nodes</Text>
          <View style={styles.controls}>
            <Control accessibilityLabel="Zoom out" onPress={() => zoomBy(0.82)}>
              <ZoomOut color={colors.maroon} size={19} />
            </Control>
            <Control accessibilityLabel="Fit all nodes" onPress={() => moveTo(fit, true)}>
              <Focus color={colors.maroon} size={18} />
            </Control>
            <Control accessibilityLabel="Zoom in" onPress={() => zoomBy(1.2)}>
              <ZoomIn color={colors.maroon} size={19} />
            </Control>
          </View>
        </View>

        <View onLayout={handleCanvasLayout} style={styles.viewport}>
          <GestureDetector gesture={gesture}>
            <Animated.View style={StyleSheet.absoluteFill}>
              <Animated.View
                style={[
                  styles.chartCanvas,
                  { height: chart.canvasHeight, width: chart.canvasWidth },
                  animatedCanvasStyle
                ]}
              >
                <Svg height={chart.canvasHeight} pointerEvents="none" style={StyleSheet.absoluteFill} width={chart.canvasWidth}>
                  {chart.connectors.map((line, index) => (
                    <Path
                      d={connectorPath(line)}
                      fill="none"
                      key={`${line.x1}-${line.x2}-${index}`}
                      stroke={colors.gold}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  ))}
                </Svg>
                {chart.nodes.map((layoutNode) => (
                  <View
                    key={layoutNode.node.id}
                    style={{ left: layoutNode.x, position: "absolute", top: layoutNode.y }}
                  >
                    <NodeCard node={layoutNode.node} primary={layoutNode.node.id === college.data.id} />
                  </View>
                ))}
              </Animated.View>
            </Animated.View>
          </GestureDetector>
        </View>
        <View style={styles.footer}>
          <Text style={styles.footerText}>Drag to pan. Pinch or use controls to zoom.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function Control({
  accessibilityLabel,
  children,
  onPress
}: {
  accessibilityLabel: string;
  children: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" onPress={onPress} style={styles.control}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.maroon, flex: 1 },
  header: { gap: 3, paddingBottom: 14, paddingHorizontal: 20, paddingTop: 8 },
  headerTitle: { color: colors.white, fontSize: 22, fontWeight: "900", letterSpacing: -0.4 },
  headerSubtitle: { color: "rgba(255,255,255,0.68)", fontSize: 12, fontWeight: "600" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    flex: 1,
    overflow: "hidden"
  },
  tabs: {
    flexDirection: "row",
    gap: 6,
    paddingBottom: 12,
    paddingHorizontal: 14,
    paddingTop: 14
  },
  tab: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    minHeight: 64,
    paddingHorizontal: 8,
    paddingVertical: 8
  },
  tabSelected: { backgroundColor: colors.maroon, borderColor: colors.maroon },
  tabShort: { color: colors.maroon, fontSize: 10, fontWeight: "900", letterSpacing: 0.7 },
  tabLabel: { color: colors.ink, fontSize: 10.5, fontWeight: "800", lineHeight: 13 },
  tabTextSelected: { color: colors.white },
  controlRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 10,
    paddingHorizontal: 18
  },
  fitHint: { color: colors.muted, flex: 1, fontSize: 11, fontWeight: "700" },
  controls: { flexDirection: "row", gap: 7 },
  control: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  viewport: { backgroundColor: colors.surface, flex: 1, overflow: "hidden" },
  chartCanvas: { position: "absolute" },
  node: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    height: ORG_NODE_HEIGHT,
    justifyContent: "center",
    paddingHorizontal: 12,
    width: ORG_NODE_WIDTH
  },
  nodePrimary: { backgroundColor: colors.maroon, borderColor: colors.maroon },
  nodeName: { color: colors.ink, fontSize: 12, fontWeight: "900", lineHeight: 16 },
  nodeNamePrimary: { color: colors.white },
  nodeTitle: { color: colors.muted, fontSize: 10.5, fontWeight: "600", lineHeight: 14, marginTop: 2 },
  nodeTitlePrimary: { color: "rgba(255,255,255,0.76)" },
  footer: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingBottom: 94,
    paddingTop: 10
  },
  footerText: { color: colors.muted, fontSize: 12, fontWeight: "700" }
});
