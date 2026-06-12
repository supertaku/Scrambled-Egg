import "react-native-gesture-handler";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Tabs, useRouter, useSegments } from "expo-router";
import { Home, BookOpen, Lightbulb, Map, MessageCircle, type LucideIcon } from "lucide-react-native";
import {
  ActivityIndicator,
  Animated,
  AppState,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider, useKeyboardState } from "react-native-keyboard-controller";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ModelOperationBadge } from "@/components/models/ModelOperationBadge";
import { cleanupPartialGgufDownloads, recoverInterruptedModelOperation } from "@/ai/localModelManager";
import { disableAdminMode, subscribeAdminMode } from "@/services/adminService";
import { getCurrentAIMode, releaseLocalAIForMemoryPressure } from "@/services/modeSelectionService";
import { shouldPresentFirstRunOnboarding, subscribeOnboardingCompleted } from "@/services/onboardingService";
import { colors } from "@/theme/colors";
import { metrics } from "@/theme/metrics";
import { logger } from "@/utils/logger";

const TAB_BAR_PADDING = 8;
const TAB_BAR_SIDE_MARGIN = 18;

const USER_ROUTE_NAMES = ["index", "map", "chat", "library", "tips"] as const;
const ADMIN_ONLY_ROUTE_NAMES = ["documents", "add-document"];
const REMOVED_ADMIN_ROUTE_NAMES: string[] = [];

type UserRouteName = (typeof USER_ROUTE_NAMES)[number];

const TAB_ICON_BY_ROUTE: Record<UserRouteName, LucideIcon> = {
  index: Home,
  map: Map,
  chat: MessageCircle,
  library: BookOpen,
  tips: Lightbulb
};

const TAB_LABEL_BY_ROUTE: Record<UserRouteName, string> = {
  index: "Home",
  map: "Map",
  chat: "Chat",
  library: "Library",
  tips: "Tips"
};

function isUserRouteName(name: string): name is UserRouteName {
  return (USER_ROUTE_NAMES as readonly string[]).includes(name);
}

interface TabItemProps {
  accessibilityLabel: string;
  focused: boolean;
  Icon: LucideIcon;
  label: string;
  onPress: () => void;
}

function TabItem({ accessibilityLabel, focused, Icon, label, onPress }: TabItemProps) {
  const scale = useRef(new Animated.Value(focused ? 1.15 : 1)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1.15 : 1,
      useNativeDriver: true,
      friction: 7,
      tension: 120
    }).start();
  }, [focused, scale]);

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.88,
      useNativeDriver: true,
      friction: 6,
      tension: 200
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 5,
      tension: 180
    }).start();
  };

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tabItem}
    >
      <Animated.View style={{ transform: [{ scale: Animated.multiply(scale, pressScale) }] }}>
        <Icon
          color={focused ? colors.white : "rgba(255,255,255,0.38)"}
          size={focused ? 20 : 23}
          strokeWidth={focused ? 2.5 : 1.8}
        />
      </Animated.View>
      {/* Icon-only navigation makes first-time users guess what "Tips" or
          "Library" is; the focused tab names itself without crowding the bar. */}
      {focused ? (
        <Text allowFontScaling={false} numberOfLines={1} style={styles.tabLabel}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

interface CustomTabBarProps extends BottomTabBarProps {
  adminMode: boolean;
}

function TabsFrame({
  immersiveRouteVisible,
  renderTabBar
}: {
  immersiveRouteVisible: boolean;
  renderTabBar: (props: BottomTabBarProps) => React.ReactNode;
}) {
  const keyboardVisible = useKeyboardState((state) => state.isVisible);

  useEffect(() => {
    if (!__DEV__) return;
    logger.ui.log("Floating tab keyboard visibility state.", {
      hidden: immersiveRouteVisible || keyboardVisible,
      immersiveRouteVisible,
      keyboardVisible
    });
  }, [immersiveRouteVisible, keyboardVisible]);

  return (
    <View style={styles.root}>
      <Tabs
        tabBar={immersiveRouteVisible || keyboardVisible ? () => null : renderTabBar}
        screenOptions={{
          headerShown: false
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Home" }} />
        <Tabs.Screen name="map" options={{ title: "Map" }} />
        <Tabs.Screen name="campus-map" options={{ href: null, title: "Campus Map" }} />
        <Tabs.Screen name="chat" options={{ title: "Chat" }} />
        <Tabs.Screen name="library" options={{ title: "Library" }} />
        <Tabs.Screen name="library-topic/[chunkId]" options={{ href: null }} />
        <Tabs.Screen name="canteen" options={{ href: null, title: "Food" }} />
        <Tabs.Screen name="canteen-store/[storeId]" options={{ href: null }} />
        <Tabs.Screen name="tips" options={{ title: "Tips" }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
        <Tabs.Screen name="onboarding" options={{ href: null }} />
        <Tabs.Screen name="models" options={{ href: null, title: "Chat Options" }} />
        <Tabs.Screen name="organization" options={{ href: null, title: "Org" }} />
        <Tabs.Screen name="org-chart" options={{ href: null, title: "Org Chart" }} />
        <Tabs.Screen name="documents" options={{ href: null, title: "Docs" }} />
        <Tabs.Screen name="add-document" options={{ href: null, title: "Add" }} />
        <Tabs.Screen name="settings" options={{ href: null, title: "Settings" }} />
      </Tabs>
      {!immersiveRouteVisible ? <ModelOperationBadge /> : null}
    </View>
  );
}

function CustomTabBar({ state, navigation, adminMode }: CustomTabBarProps) {
  const { width } = useWindowDimensions();
  const tabBarWidth = Math.max(0, width - TAB_BAR_SIDE_MARGIN * 2);
  const contentWidth = Math.max(0, tabBarWidth - TAB_BAR_PADDING * 2);

  const visibleRoutes = useMemo(
    () => state.routes.filter((route) => isUserRouteName(route.name)),
    [state.routes]
  );

  const activeRoute = state.routes[state.index];
  const activeIndex = activeRoute
    ? visibleRoutes.findIndex((route) => route.key === activeRoute.key)
    : -1;
  const tabWidth = visibleRoutes.length > 0 ? contentWidth / visibleRoutes.length : 0;

  const translateX = useRef(new Animated.Value(0)).current;
  const indicatorOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (activeIndex !== -1) {
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: activeIndex * tabWidth,
          useNativeDriver: true,
          friction: 7,
          tension: 100
        }),
        Animated.timing(indicatorOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true
        })
      ]).start();
    }
  }, [activeIndex, tabWidth, adminMode, translateX, indicatorOpacity]);

  if (visibleRoutes.length === 0) {
    return null;
  }

  const showIndicator = activeIndex !== -1;
  const indicatorColor = adminMode ? colors.gold : colors.maroon;

  return (
    <View style={styles.tabBarContainer}>
      <View style={[styles.tabBar, { width: tabBarWidth }]}>
        {/* Pill indicator */}
        {showIndicator ? (
          <Animated.View
            style={[
              styles.indicator,
              {
                width: tabWidth - 10,
                transform: [{ translateX: Animated.add(translateX, new Animated.Value(5)) }],
                opacity: indicatorOpacity,
                backgroundColor: indicatorColor,
                shadowColor: indicatorColor
              }
            ]}
          />
        ) : null}

        {visibleRoutes.map((route, index) => {
          const isFocused = activeIndex === index;
          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const Icon = TAB_ICON_BY_ROUTE[route.name as UserRouteName];

          return (
            <TabItem
              key={route.key}
              accessibilityLabel={TAB_LABEL_BY_ROUTE[route.name as UserRouteName]}
              focused={isFocused}
              Icon={Icon}
              label={TAB_LABEL_BY_ROUTE[route.name as UserRouteName]}
              onPress={onPress}
            />
          );
        })}
      </View>
    </View>
  );
}

export default function RootLayout() {
  const [adminMode, setAdminMode] = useState(false);
  const [onboardingReady, setOnboardingReady] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const router = useRouter();
  const segments = useSegments();
  const currentRoute = segments[segments.length - 1] as string | undefined;
  const onboardingVisible = currentRoute === "onboarding";
  const immersiveRouteVisible = onboardingVisible || currentRoute === "campus-map";

  useEffect(() => {
    let mounted = true;
    void shouldPresentFirstRunOnboarding()
      .then((shouldPresent) => {
        if (mounted) {
          setNeedsOnboarding(shouldPresent);
          setOnboardingReady(true);
        }
      })
      .catch((error) => {
        logger.ui.warn("Could not resolve onboarding state.", {
          error: error instanceof Error ? error.message : String(error)
        });
        if (mounted) {
          setOnboardingReady(true);
        }
      });

    const unsubscribe = subscribeOnboardingCompleted(() => {
      setNeedsOnboarding(false);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    cleanupPartialGgufDownloads();
    void recoverInterruptedModelOperation();
    void getCurrentAIMode().catch((error) => {
      logger.ai.warn("Startup capability detection failed", { error: error instanceof Error ? error.message : String(error) });
    });
    void disableAdminMode()
      .then(() => {
        if (mounted) setAdminMode(false);
      })
      .catch((error) => {
        logger.ui.warn("Startup admin-mode reset failed", {
          error: error instanceof Error ? error.message : String(error)
        });
        if (mounted) setAdminMode(false);
      });

    const unsubscribe = subscribeAdminMode((enabled) => {
      setAdminMode(enabled);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "inactive" || nextState === "background") {
        releaseLocalAIForMemoryPressure(`AppState changed to ${nextState}.`);
        void disableAdminMode().catch((error) => {
          logger.ui.warn("Admin-mode background reset failed", {
            error: error instanceof Error ? error.message : String(error)
          });
        });
      }

      if ((previousState === "inactive" || previousState === "background") && nextState === "active") {
        void getCurrentAIMode().catch((error) => {
          logger.ai.warn("Foreground capability detection failed", {
            error: error instanceof Error ? error.message : String(error)
          });
        });
      }

      previousState = nextState;
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!onboardingReady) {
      return;
    }

    if (needsOnboarding && currentRoute !== "onboarding") {
      router.replace("/onboarding" as never);
    } else if (!adminMode && currentRoute !== undefined && ADMIN_ONLY_ROUTE_NAMES.includes(currentRoute)) {
      router.replace("/");
    } else if (currentRoute !== undefined && REMOVED_ADMIN_ROUTE_NAMES.includes(currentRoute)) {
      router.replace(adminMode ? "/settings" : "/");
    }
  }, [adminMode, currentRoute, needsOnboarding, onboardingReady, router]);

  const renderTabBar = useCallback(
    (props: BottomTabBarProps) => <CustomTabBar {...props} adminMode={adminMode} />,
    [adminMode]
  );

  if (!onboardingReady || (needsOnboarding && !onboardingVisible)) {
    return (
      <View style={styles.loading}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator color={colors.white} size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <ErrorBoundary>
        <StatusBar barStyle="light-content" />
        <KeyboardProvider navigationBarTranslucent preserveEdgeToEdge statusBarTranslucent>
          <TabsFrame immersiveRouteVisible={immersiveRouteVisible} renderTabBar={renderTabBar} />
        </KeyboardProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  loading: {
    alignItems: "center",
    backgroundColor: colors.maroon,
    flex: 1,
    justifyContent: "center"
  },
  tabBarContainer: {
    position: "absolute",
    bottom: metrics.navigation.floatingTabBarBottom,
    left: TAB_BAR_SIDE_MARGIN,
    right: TAB_BAR_SIDE_MARGIN,
    alignItems: "center"
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.tabBar,
    borderRadius: 36,
    height: metrics.navigation.floatingTabBarHeight,
    paddingHorizontal: TAB_BAR_PADDING,
    alignItems: "center",
    justifyContent: "space-around",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 18
  },
  tabItem: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center"
  },
  tabLabel: {
    color: colors.white,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.3,
    marginTop: 2
  },
  indicator: {
    position: "absolute",
    height: 44,
    borderRadius: 22,
    left: TAB_BAR_PADDING,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10
  }
});
