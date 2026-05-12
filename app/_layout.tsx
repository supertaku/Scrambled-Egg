import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Tabs, useRouter, useSegments } from "expo-router";
import { Home, Lightbulb, Map, MessageCircle, Utensils, type LucideIcon } from "lucide-react-native";
import {
  Animated,
  AppState,
  Pressable,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  View
} from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { cleanupPartialGgufDownloads } from "@/ai/localModelManager";
import { getAdminMode, subscribeAdminMode } from "@/services/adminService";
import { getCurrentAIMode, releaseLocalAIForMemoryPressure } from "@/services/modeSelectionService";
import { colors } from "@/theme/colors";
import { logger } from "@/utils/logger";

const TAB_BAR_PADDING = 6;
const TAB_BAR_SIDE_MARGIN = 20;

const USER_ROUTE_NAMES = ["index", "map", "chat", "canteen", "tips"] as const;
const ADMIN_ONLY_ROUTE_NAMES = ["settings"];
const REMOVED_ADMIN_ROUTE_NAMES = ["documents", "add-document"];

type UserRouteName = (typeof USER_ROUTE_NAMES)[number];

// Single source of truth: route name -> icon. Replaces the per-Screen
// `tabBarIcon: Home as any` pattern (the type of `tabBarIcon` is a render
// function, not a component, so casting was necessary). Looking the icon up
// by name inside our custom tab bar avoids the cast entirely.
const TAB_ICON_BY_ROUTE: Record<UserRouteName, LucideIcon> = {
  index: Home,
  map: Map,
  chat: MessageCircle,
  canteen: Utensils,
  tips: Lightbulb
};

function isUserRouteName(name: string): name is UserRouteName {
  return (USER_ROUTE_NAMES as readonly string[]).includes(name);
}

interface TabItemProps {
  focused: boolean;
  Icon: LucideIcon;
  onPress: () => void;
}

function TabItem({ focused, Icon, onPress }: TabItemProps) {
  const scale = useRef(new Animated.Value(focused ? 1.2 : 1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1.2 : 1,
      useNativeDriver: true,
      friction: 8,
      tension: 100
    }).start();
  }, [focused, scale]);

  return (
    <Pressable onPress={onPress} style={styles.tabItem}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Icon
          color={focused ? colors.white : "rgba(255,255,255,0.4)"}
          size={24}
          strokeWidth={focused ? 2.5 : 2}
        />
      </Animated.View>
    </Pressable>
  );
}

interface CustomTabBarProps extends BottomTabBarProps {
  adminMode: boolean;
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
  useEffect(() => {
    if (activeIndex !== -1) {
      Animated.spring(translateX, {
        toValue: activeIndex * tabWidth,
        useNativeDriver: true,
        friction: 8,
        tension: 80
      }).start();
    }
  }, [activeIndex, tabWidth, adminMode, translateX]);

  if (visibleRoutes.length === 0) {
    return null;
  }

  const showIndicator = activeIndex !== -1;

  return (
    <View style={styles.tabBarContainer}>
      <View style={[styles.tabBar, { width: tabBarWidth }]}>
        {showIndicator ? (
          <Animated.View
            style={[
              styles.indicator,
              {
                width: tabWidth,
                transform: [{ translateX }],
                backgroundColor: adminMode ? colors.gold : colors.maroon,
                shadowColor: adminMode ? colors.gold : colors.maroon
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

          // Safe because we filtered visibleRoutes by isUserRouteName above.
          const Icon = TAB_ICON_BY_ROUTE[route.name as UserRouteName];

          return (
            <TabItem key={route.key} focused={isFocused} Icon={Icon} onPress={onPress} />
          );
        })}
      </View>
    </View>
  );
}

export default function RootLayout() {
  const [adminMode, setAdminMode] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    let mounted = true;
    cleanupPartialGgufDownloads();
    void getCurrentAIMode().catch((error) => {
      logger.ai.warn("Startup capability detection failed", { error: error instanceof Error ? error.message : String(error) });
    });
    getAdminMode().then((enabled) => {
      if (mounted) {
        setAdminMode(enabled);
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

  useEffect(() => {
    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "inactive" || nextState === "background") {
        releaseLocalAIForMemoryPressure(`AppState changed to ${nextState}.`);
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

  // Separate effect for redirection to avoid resubscribing on segment change
  useEffect(() => {
    const currentRoute = segments[segments.length - 1];

    if (!adminMode && currentRoute !== undefined && ADMIN_ONLY_ROUTE_NAMES.includes(currentRoute)) {
      router.replace("/");
    } else if (currentRoute !== undefined && REMOVED_ADMIN_ROUTE_NAMES.includes(currentRoute)) {
      router.replace(adminMode ? "/settings" : "/");
    }
  }, [adminMode, segments, router]);

  const renderTabBar = useCallback(
    (props: BottomTabBarProps) => <CustomTabBar {...props} adminMode={adminMode} />,
    [adminMode]
  );

  return (
    <ErrorBoundary>
      <StatusBar barStyle="light-content" />
      <View style={styles.root}>
        <Tabs
          tabBar={renderTabBar}
          screenOptions={{
            headerShown: false
          }}
        >
          <Tabs.Screen name="index" options={{ title: "Home" }} />
          <Tabs.Screen name="map" options={{ title: "Map" }} />
          <Tabs.Screen name="chat" options={{ title: "Chat" }} />
          <Tabs.Screen name="canteen" options={{ title: "Food" }} />
          <Tabs.Screen name="canteen-store/[storeId]" options={{ href: null }} />
          <Tabs.Screen name="tips" options={{ title: "Tips" }} />
          <Tabs.Screen name="profile" options={{ href: null }} />
          <Tabs.Screen name="organization" options={{ href: null, title: "Org" }} />
          <Tabs.Screen name="documents" options={{ href: null, title: "Docs" }} />
          <Tabs.Screen name="add-document" options={{ href: null, title: "Add" }} />
          <Tabs.Screen name="settings" options={{ href: null, title: "Admin" }} />
        </Tabs>
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  tabBarContainer: {
    position: "absolute",
    bottom: 30,
    left: TAB_BAR_SIDE_MARGIN,
    right: TAB_BAR_SIDE_MARGIN,
    alignItems: "center"
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "rgba(15, 15, 15, 0.85)",
    borderRadius: 32,
    height: 64,
    paddingHorizontal: TAB_BAR_PADDING,
    alignItems: "center",
    justifyContent: "space-around",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 15
  },
  tabItem: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center"
  },
  indicator: {
    position: "absolute",
    height: 48,
    backgroundColor: colors.maroon,
    borderRadius: 24,
    left: TAB_BAR_PADDING,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8
  }
});
