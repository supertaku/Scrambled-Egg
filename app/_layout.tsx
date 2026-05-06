import { useCallback, useEffect, useRef, useState } from "react";
import { Tabs, useRouter, useSegments } from "expo-router";
import { BookOpenText, Building2, FilePlus2, Home, Lightbulb, MessageCircle, Settings, Utensils } from "lucide-react-native";
import { Animated, Dimensions, Pressable, StatusBar, StyleSheet, View } from "react-native";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { HakiTabPopup } from "@/components/HakiTabPopup";
import { getAdminMode, subscribeAdminMode } from "@/services/adminService";
import { getCurrentAIMode } from "@/services/modeSelectionService";
import { colors } from "@/theme/colors";
import { logger } from "@/utils/logger";

const { width } = Dimensions.get("window");
const TAB_BAR_PADDING = 6;
const TAB_BAR_WIDTH = width - 40;
const CONTENT_WIDTH = TAB_BAR_WIDTH - (TAB_BAR_PADDING * 2);
const USER_ROUTE_NAMES = ["index", "organization", "chat", "canteen", "tips"];
const ADMIN_ROUTE_NAMES = ["documents", "add-document", "settings"];
const POPUP_ROUTE_NAMES = ["canteen", "documents", "add-document", "settings"];
const TAB_POPUP_MESSAGES: Record<string, string> = {
  organization: "Checking orgs? Haki can help you find where to start.",
  chat: "Chat is open. Ask me about offices, enrollment, records, or student life.",
  canteen: "Food break? I can point you to canteen notes and nearby options.",
  tips: "Quick tip stop. Haki has bite-sized campus reminders ready.",
  documents: "Admin docs are up. Add or review knowledge sources here.",
  "add-document": "New source time. Drop official guides here when they are ready.",
  settings: "Admin controls are here. Haki will keep the guide mode visible."
};

function TabItem({ focused, Icon, onPress, label }: { focused: boolean; Icon: any; onPress: () => void; label: string }) {
  const scale = useRef(new Animated.Value(focused ? 1.2 : 1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1.2 : 1,
      useNativeDriver: true,
      friction: 8,
      tension: 100,
    }).start();
  }, [focused]);

  return (
    <Pressable onPress={onPress} style={styles.tabItem}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Icon color={focused ? colors.white : "rgba(255,255,255,0.4)"} size={24} strokeWidth={focused ? 2.5 : 2} />
      </Animated.View>
    </Pressable>
  );
}

function CustomTabBar({ state, descriptors, navigation, adminMode }: any) {
  const translateX = useRef(new Animated.Value(0)).current;

  const visibleRoutes = state.routes.filter((route: any) => {
    const { options } = descriptors[route.key];
    
    // Safety check: ensure the route is explicitly allowed in the current mode
    if (adminMode) {
      return ADMIN_ROUTE_NAMES.includes(route.name);
    } else {
      return USER_ROUTE_NAMES.includes(route.name);
    }
  });

  const tabWidth = CONTENT_WIDTH / visibleRoutes.length;
  const activeRoute = state.routes[state.index];
  const activeIndex = visibleRoutes.findIndex((r: any) => r.key === activeRoute.key);

  useEffect(() => {
    if (activeIndex !== -1) {
      Animated.spring(translateX, {
        toValue: activeIndex * tabWidth,
        useNativeDriver: true,
        friction: 8,
        tension: 80,
      }).start();
    }
  }, [activeIndex, tabWidth, adminMode]);

  const showIndicator = activeIndex !== -1;

  return (
    <View style={styles.tabBarContainer}>
      <View style={styles.tabBar}>
        {/* Sliding Indicator */}
        {showIndicator && (
          <Animated.View
            style={[
              styles.indicator,
              {
                width: tabWidth,
                transform: [{ translateX: translateX }],
                backgroundColor: adminMode ? colors.gold : colors.maroon,
                shadowColor: adminMode ? colors.gold : colors.maroon,
              },
            ]}
          />
        )}
        
        {visibleRoutes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const isFocused = activeIndex === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          // Default to Home icon if not specified, though our whitelist should prevent this
          const Icon = options.tabBarIcon && typeof options.tabBarIcon !== "function" 
            ? options.tabBarIcon 
            : Home;

          return (
            <TabItem
              key={route.key}
              focused={isFocused}
              Icon={Icon}
              onPress={onPress}
              label={options.title || route.name}
            />
          );
        })}
      </View>
    </View>
  );
}


export default function RootLayout() {
  const [adminMode, setAdminMode] = useState(false);
  const [popupState, setPopupState] = useState<{ key: number; message: string | null }>({
    key: 0,
    message: null
  });
  const router = useRouter();
  const segments = useSegments();
  const previousTabRef = useRef<string | null>(null);
  const visitedTabsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;
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

  // Separate effect for redirection to avoid resubscribing on segment change
  useEffect(() => {
    const currentRoute = segments[segments.length - 1];
    
    if (!adminMode && currentRoute !== undefined && ADMIN_ROUTE_NAMES.includes(currentRoute)) {
      router.replace("/");
    } else if (adminMode && currentRoute !== undefined && !ADMIN_ROUTE_NAMES.includes(currentRoute) && currentRoute !== "profile") {
      router.replace("/documents");
    }
  }, [adminMode, segments, router]);

  useEffect(() => {
    const currentRoute = segments[segments.length - 1] ?? "index";
    const activeRoutes = adminMode ? ADMIN_ROUTE_NAMES : USER_ROUTE_NAMES;

    if (!activeRoutes.includes(currentRoute)) {
      return;
    }

    const previousRoute = previousTabRef.current;

    if (!previousRoute) {
      previousTabRef.current = currentRoute;
      visitedTabsRef.current.add(currentRoute);
      return;
    }

    if (previousRoute === currentRoute) {
      return;
    }

    previousTabRef.current = currentRoute;

    if (!POPUP_ROUTE_NAMES.includes(currentRoute) || visitedTabsRef.current.has(currentRoute)) {
      return;
    }

    visitedTabsRef.current.add(currentRoute);
    setPopupState((current) => ({
      key: current.key + 1,
      message: TAB_POPUP_MESSAGES[currentRoute] ?? "Haki popped in. Need help around this tab?"
    }));
  }, [adminMode, segments]);

  const handlePopupDismiss = useCallback(() => {
    setPopupState((current) => ({ ...current, message: null }));
  }, []);

  return (
    <ErrorBoundary>
      <StatusBar barStyle="light-content" />
      <View style={styles.root}>
        <Tabs
          tabBar={(props) => <CustomTabBar {...props} adminMode={adminMode} />}
          screenOptions={{
            headerShown: false,
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: "Home",
              tabBarIcon: Home as any,
            }}
          />
          <Tabs.Screen
            name="organization"
            options={{
              title: "Org",
              tabBarIcon: Building2 as any,
            }}
          />
          <Tabs.Screen
            name="chat"
            options={{
              title: "Chat",
              tabBarIcon: MessageCircle as any,
            }}
          />
          <Tabs.Screen
            name="canteen"
            options={{
              title: "Food",
              tabBarIcon: Utensils as any,
            }}
          />
          <Tabs.Screen
            name="canteen-store/[storeId]"
            options={{
              href: null,
            }}
          />
          <Tabs.Screen
            name="tips"
            options={{
              title: "Tips",
              tabBarIcon: Lightbulb as any,
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              href: null,
            }}
          />
          <Tabs.Screen
            name="documents"
            options={{
              href: "/documents",
              title: "Docs",
              tabBarIcon: BookOpenText as any,
            }}
          />
          <Tabs.Screen
            name="add-document"
            options={{
              href: "/add-document",
              title: "Add",
              tabBarIcon: FilePlus2 as any,
            }}
          />
          <Tabs.Screen
            name="settings"
            options={{
              href: "/settings",
              title: "Admin",
              tabBarIcon: Settings as any,
            }}
          />
        </Tabs>
        <HakiTabPopup
          key={popupState.key}
          message={popupState.message}
          onDismiss={handlePopupDismiss}
          visibleKey={popupState.key}
        />
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
    left: 20,
    right: 20,
    alignItems: "center",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "rgba(15, 15, 15, 0.85)",
    borderRadius: 32,
    height: 64,
    width: TAB_BAR_WIDTH,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "space-around",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 15,
  },
  tabItem: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  indicator: {
    position: "absolute",
    height: 48,
    backgroundColor: colors.maroon,
    borderRadius: 24,
    left: TAB_BAR_PADDING,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
