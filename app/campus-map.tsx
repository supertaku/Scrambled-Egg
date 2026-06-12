import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Search, X } from "lucide-react-native";
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
  type ViewStyle
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HakiHdMascot } from "@/mascot";
import {
  CAMPUS_MAP_CANVAS,
  getCampusMapDestination,
  getCampusMapRegion,
  getCampusMapTapDestinations,
  searchCampusMapDestinations,
  type CampusMapDestination,
  type CampusMapRegion
} from "@/data/campusMapDestinations";
import {
  CAMPUS_PLAYER_SPAWN,
  campusMapWalkZones,
  findNearbyCampusDestination,
  getCampusMapGameplayDestination,
  moveCampusPlayer,
  type CampusMapDirection,
  type CampusMapPoint,
  type CampusMapRect
} from "@/data/campusMapGameplay";
import {
  allFeathersCollected,
  campusFeathers,
  findFeatherAt
} from "@/data/campusMapCollectibles";
import { useDebouncedQuery } from "@/hooks/useDebouncedQuery";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { loadCollectedFeathers, saveCollectedFeathers } from "@/services/campusFeatherService";
import { colors } from "@/theme/colors";
import { campusMapStyles as styles } from "@/components/campus-map/campusMapStyles";
import { campusMapPalette } from "@/theme/featurePalettes";
import { hapticSuccess, hapticTap } from "@/utils/haptics";

interface MapFrame {
  height: number;
  left: number;
  top: number;
  width: number;
}

const SPRITE_WIDTH = 36;
const SPRITE_HEIGHT = 36;
const FEATHER_SIZE = 18;
const FEATHER_IMAGE = require("../assets/images/mascot/pixel/haki-feather.png");
const DIRECTION_IMAGE = {
  down: require("../assets/images/map/haki-map-down.png"),
  left: require("../assets/images/map/haki-map-left.png"),
  right: require("../assets/images/map/haki-map-right.png"),
  up: require("../assets/images/map/haki-map-up.png")
} satisfies Record<CampusMapDirection, number>;

function pct(value: number): `${number}%` {
  return `${value}%`;
}

function regionStyle(region: CampusMapRegion): ViewStyle {
  return {
    borderRadius: region.borderRadius,
    height: pct(region.height),
    left: pct(region.left),
    position: "absolute",
    top: pct(region.top),
    width: pct(region.width)
  };
}

function rectStyle(rect: CampusMapRect): ViewStyle {
  return {
    height: pct(rect.height),
    left: pct(rect.left),
    position: "absolute",
    top: pct(rect.top),
    width: pct(rect.width)
  };
}

function fitMapFrame(width: number, height: number): MapFrame {
  if (width <= 0 || height <= 0) {
    return { height: 0, left: 0, top: 0, width: 0 };
  }

  const ratio = CAMPUS_MAP_CANVAS.width / CAMPUS_MAP_CANVAS.height;
  const fittedWidth = Math.min(width, height * ratio);
  const fittedHeight = fittedWidth / ratio;
  return {
    height: fittedHeight,
    left: (width - fittedWidth) / 2,
    top: (height - fittedHeight) / 2,
    width: fittedWidth
  };
}

export default function CampusMapScreen() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const { clearQuery, debouncedQuery, query, setQuery } = useDebouncedQuery(100);
  const [frame, setFrame] = useState<MapFrame>({ height: 0, left: 0, top: 0, width: 0 });
  const [direction, setDirection] = useState<CampusMapDirection>(CAMPUS_PLAYER_SPAWN.direction);
  const [playerPosition, setPlayerPosition] = useState<CampusMapPoint>(CAMPUS_PLAYER_SPAWN.position);
  const [remoteDestinationId, setRemoteDestinationId] = useState<string | null>(null);
  const [dialogDestinationId, setDialogDestinationId] = useState<string | null>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const [debugVisible, setDebugVisible] = useState(false);
  const [collectedFeathers, setCollectedFeathers] = useState<ReadonlySet<string>>(new Set());
  const [featherCelebration, setFeatherCelebration] = useState(false);
  const movementTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let mounted = true;
    void loadCollectedFeathers().then((collected) => {
      if (mounted) {
        setCollectedFeathers(collected);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Feather Hunt: walking over a feather collects it.
  useEffect(() => {
    const found = findFeatherAt(playerPosition, collectedFeathers);
    if (!found) {
      return;
    }
    const next = new Set(collectedFeathers);
    next.add(found.id);
    setCollectedFeathers(next);
    saveCollectedFeathers(next);
    if (allFeathersCollected(next)) {
      hapticSuccess();
      setFeatherCelebration(true);
    } else {
      hapticTap();
    }
  }, [collectedFeathers, playerPosition]);

  const tapDestinations = useMemo(() => getCampusMapTapDestinations(), []);
  const searchResults = useMemo(() => searchCampusMapDestinations(debouncedQuery), [debouncedQuery]);
  const nearbyDestination = useMemo(() => findNearbyCampusDestination(playerPosition), [playerPosition]);
  const remoteDestination = remoteDestinationId ? getCampusMapDestination(remoteDestinationId) : undefined;
  const promptDestination = remoteDestination ?? nearbyDestination;
  const dialogDestination = dialogDestinationId ? getCampusMapDestination(dialogDestinationId) : undefined;
  const highlightedDestination = dialogDestination ?? promptDestination;

  const handleStageLayout = useCallback((event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout;
    setFrame(fitMapFrame(width, height));
  }, []);

  const stopMovement = useCallback(() => {
    if (movementTimer.current) {
      clearInterval(movementTimer.current);
      movementTimer.current = null;
    }
  }, []);

  const moveOnce = useCallback((nextDirection: CampusMapDirection) => {
    setDirection(nextDirection);
    setRemoteDestinationId(null);
    setPlayerPosition((current) => moveCampusPlayer(current, nextDirection));
  }, []);

  const startMovement = useCallback((nextDirection: CampusMapDirection) => {
    stopMovement();
    moveOnce(nextDirection);
    movementTimer.current = setInterval(() => moveOnce(nextDirection), 135);
  }, [moveOnce, stopMovement]);

  useEffect(() => () => stopMovement(), [stopMovement]);

  const showRemotePrompt = useCallback((destination: CampusMapDestination) => {
    stopMovement();
    setDialogDestinationId(null);
    setRemoteDestinationId(destination.id);
  }, [stopMovement]);

  const openDialogue = useCallback((destination: CampusMapDestination) => {
    stopMovement();
    setDialogDestinationId(destination.id);
  }, [stopMovement]);

  const selectSearchResult = useCallback((destination: CampusMapDestination) => {
    showRemotePrompt(destination);
    setSearchVisible(false);
    clearQuery();
  }, [clearQuery, showRemotePrompt]);

  const openLocalAction = useCallback((destination: CampusMapDestination) => {
    const shortcut = destination.shortcut;
    if (!shortcut) return;
    if (shortcut.route === "/canteen") {
      router.push("/canteen" as never);
      return;
    }
    router.push({
      pathname: "/library" as never,
      params: shortcut.query ? { query: shortcut.query } : {}
    } as never);
  }, [router]);

  const highlightedRegion = highlightedDestination ? getCampusMapRegion(highlightedDestination) : undefined;

  return (
    <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.safeArea}>
      <View style={styles.stage}>
        <View onLayout={handleStageLayout} style={styles.mapViewport}>
        {frame.width > 0 ? (
          <View style={[styles.mapCanvas, frame]}>
            <Image
              accessibilityIgnoresInvertColors
              fadeDuration={0}
              resizeMode="contain"
              source={require("../assets/images/map/tupt-campus-overview-pixel.png")}
              style={styles.mapImage}
            />

            {__DEV__ && debugVisible ? (
              <MapDebugOverlay destinations={tapDestinations} position={playerPosition} />
            ) : null}

            {highlightedRegion ? (
              <MapHighlight reducedMotion={reducedMotion} region={highlightedRegion} />
            ) : null}

            {tapDestinations.map((destination) => (
              <Pressable
                accessibilityLabel={`Inspect ${destination.displayName}`}
                accessibilityRole="button"
                key={destination.id}
                onPress={() => showRemotePrompt(destination)}
                style={regionStyle(getCampusMapRegion(destination))}
              />
            ))}

            {campusFeathers
              .filter((feather) => !collectedFeathers.has(feather.id))
              .map((feather) => (
                <Image
                  accessibilityIgnoresInvertColors
                  key={feather.id}
                  resizeMode="contain"
                  source={FEATHER_IMAGE}
                  style={[
                    styles.feather,
                    { left: pct(feather.position.x), top: pct(feather.position.y) }
                  ]}
                />
              ))}

            <PlayerSprite
              direction={direction}
              position={playerPosition}
            />

            {promptDestination ? (
              <BuildingPrompt
                destination={promptDestination}
                key={promptDestination.id}
                onPress={() => openDialogue(promptDestination)}
                reducedMotion={reducedMotion}
              />
            ) : null}
          </View>
        ) : null}
        </View>

        <Pressable
          accessibilityLabel="Back to Map"
          accessibilityRole="button"
          onPress={() => router.replace("/map" as never)}
          style={styles.backButton}
        >
          <ChevronLeft color={campusMapPalette.inkStrong} size={18} strokeWidth={3} />
          <Text style={styles.backText}>BACK</Text>
        </Pressable>

        <View
          accessibilityLabel={`Feathers collected: ${collectedFeathers.size} of ${campusFeathers.length}`}
          style={styles.featherCounter}
        >
          <Image accessibilityIgnoresInvertColors resizeMode="contain" source={FEATHER_IMAGE} style={styles.featherCounterIcon} />
          <Text style={styles.featherCounterText}>
            {collectedFeathers.size}/{campusFeathers.length}
          </Text>
        </View>

        {featherCelebration ? (
          <View style={styles.featherBanner}>
            <Text style={styles.featherBannerTitle}>FEATHER HUNT COMPLETE!</Text>
            <Text style={styles.featherBannerText}>
              You found all {campusFeathers.length} of Haki's lost feathers while exploring the campus. Nicely done, explorer!
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setFeatherCelebration(false)}
              style={styles.featherBannerButton}
            >
              <Text style={styles.featherBannerButtonText}>HOOT! CONTINUE</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.searchArea}>
          <Pressable
            accessibilityLabel={searchVisible ? "Close destination search" : "Open destination search"}
            accessibilityRole="button"
            onPress={() => {
              setSearchVisible((current) => !current);
              clearQuery();
            }}
            style={styles.searchToggle}
          >
            {searchVisible ? <X color={campusMapPalette.inkStrong} size={19} strokeWidth={3} /> : <Search color={campusMapPalette.inkStrong} size={18} strokeWidth={3} />}
          </Pressable>
          {__DEV__ ? (
            <Pressable
              accessibilityLabel={debugVisible ? "Hide map collision overlay" : "Show map collision overlay"}
              onPress={() => setDebugVisible((visible) => !visible)}
              style={[styles.debugToggle, debugVisible ? styles.debugToggleActive : undefined]}
            >
              <Text style={styles.debugToggleText}>HITBOX</Text>
            </Pressable>
          ) : null}
          {searchVisible ? (
            <View style={styles.searchPanel}>
              <Text style={styles.searchLabel}>DESTINATION</Text>
              <View style={styles.searchInputRow}>
                <TextInput
                  accessibilityLabel="Search campus destination"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setQuery}
                  placeholder="Gym, OSA, Clinic, BAS..."
                  placeholderTextColor={campusMapPalette.placeholder}
                  style={styles.searchInput}
                  value={query}
                />
              </View>
              {debouncedQuery.trim() ? (
                <ScrollView keyboardShouldPersistTaps="handled" style={styles.results}>
                  {searchResults.length ? searchResults.slice(0, 5).map((destination) => (
                    <Pressable
                      accessibilityRole="button"
                      key={destination.id}
                      onPress={() => selectSearchResult(destination)}
                      style={styles.resultButton}
                    >
                      <Text numberOfLines={1} style={styles.resultText}>{destination.displayName}</Text>
                    </Pressable>
                  )) : <Text style={styles.noResults}>That place is not listed on the map yet.</Text>}
                </ScrollView>
              ) : (
                <Text style={styles.searchHint}>Search buildings and offices.</Text>
              )}
            </View>
          ) : null}
        </View>

        <View pointerEvents={dialogDestination ? "none" : "auto"} style={[styles.dpad, dialogDestination ? styles.dimmedControls : undefined]}>
          <DirectionButton direction="up" onPressIn={startMovement} onPressOut={stopMovement}>
            <ChevronUp color={campusMapPalette.ink} size={22} strokeWidth={3} />
          </DirectionButton>
          <View style={styles.dpadMiddle}>
            <DirectionButton direction="left" onPressIn={startMovement} onPressOut={stopMovement}>
              <ChevronLeft color={campusMapPalette.ink} size={22} strokeWidth={3} />
            </DirectionButton>
            <View style={styles.dpadCenter} />
            <DirectionButton direction="right" onPressIn={startMovement} onPressOut={stopMovement}>
              <ChevronRight color={campusMapPalette.ink} size={22} strokeWidth={3} />
            </DirectionButton>
          </View>
          <DirectionButton direction="down" onPressIn={startMovement} onPressOut={stopMovement}>
            <ChevronDown color={campusMapPalette.ink} size={22} strokeWidth={3} />
          </DirectionButton>
        </View>

        {dialogDestination ? (
          <DialogueBox
            destination={dialogDestination}
            onAction={() => openLocalAction(dialogDestination)}
            onClose={() => setDialogDestinationId(null)}
            reducedMotion={reducedMotion}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function PlayerSprite({
  direction,
  position
}: {
  direction: CampusMapDirection;
  position: CampusMapPoint;
}) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.spritePosition,
        {
          left: pct(position.x),
          top: pct(position.y),
          transform: [{ translateX: -SPRITE_WIDTH / 2 }, { translateY: -SPRITE_HEIGHT + 4 }]
        }
      ]}
    >
      <Image
        accessibilityIgnoresInvertColors
        fadeDuration={0}
        resizeMode="contain"
        source={DIRECTION_IMAGE[direction]}
        style={styles.spriteImage}
      />
    </View>
  );
}

function MapDebugOverlay({
  destinations,
  position
}: {
  destinations: CampusMapDestination[];
  position: CampusMapPoint;
}) {
  return (
    <View pointerEvents="none" style={styles.debugLayer}>
      {campusMapWalkZones.map((zone) => (
        <View key={zone.id} style={[styles.debugWalkZone, rectStyle(zone)]} />
      ))}
      {destinations.map((destination) => (
        <View key={destination.id} style={[styles.debugBuildingRegion, regionStyle(getCampusMapRegion(destination))]} />
      ))}
      {destinations.flatMap((destination) => (
        getCampusMapGameplayDestination(destination.id)?.interactionZones.map((zone) => (
          <View key={`${destination.id}-${zone.id}`} style={[styles.debugInteractionZone, rectStyle(zone)]} />
        )) ?? []
      ))}
      <View style={[styles.debugFootPoint, { left: pct(position.x), top: pct(position.y) }]} />
    </View>
  );
}

function MapHighlight({ reducedMotion, region }: { reducedMotion: boolean; region: CampusMapRegion }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      pulse.setValue(0.35);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { duration: 620, toValue: 1, useNativeDriver: true }),
        Animated.timing(pulse, { duration: 620, toValue: 0, useNativeDriver: true })
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, reducedMotion]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.highlight,
        regionStyle(region),
        {
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] })
        }
      ]}
    />
  );
}

function BuildingPrompt({
  destination,
  onPress,
  reducedMotion
}: {
  destination: CampusMapDestination;
  onPress: () => void;
  reducedMotion: boolean;
}) {
  const gameplay = getCampusMapGameplayDestination(destination.id);
  const appear = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) {
      appear.setValue(1);
      return;
    }
    Animated.spring(appear, { friction: 7, tension: 145, toValue: 1, useNativeDriver: true }).start();
  }, [appear, reducedMotion]);

  if (!gameplay) return null;

  return (
    <Animated.View
      style={[
        styles.promptPosition,
        {
          left: pct(gameplay.promptAnchor.x),
          opacity: appear,
          top: pct(gameplay.promptAnchor.y),
          transform: [
            { translateX: -10 },
            { translateY: -36 },
            { scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }
          ]
        }
      ]}
    >
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.promptButton}>
        <Text numberOfLines={1} style={styles.promptText}>{destination.displayName}</Text>
        <ChevronRight color={campusMapPalette.paleGold} size={13} strokeWidth={3} />
      </Pressable>
    </Animated.View>
  );
}

function DialogueBox({
  destination,
  onAction,
  onClose,
  reducedMotion
}: {
  destination: CampusMapDestination;
  onAction: () => void;
  onClose: () => void;
  reducedMotion: boolean;
}) {
  const appear = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const gameplay = getCampusMapGameplayDestination(destination.id);
  const details = gameplay?.verifiedDetails.filter((detail) => detail !== destination.orientation) ?? [];

  useEffect(() => {
    if (reducedMotion) {
      appear.setValue(1);
      return;
    }
    Animated.spring(appear, { friction: 9, tension: 100, toValue: 1, useNativeDriver: true }).start();
  }, [appear, reducedMotion]);

  return (
    <Animated.View
      style={[
        styles.dialogue,
        {
          opacity: appear,
          transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }]
        }
      ]}
    >
      <View style={styles.dialogueInner}>
        <View pointerEvents="none" style={styles.dialogueMascot}>
          <HakiHdMascot animated={!reducedMotion} height={94} status="idea" width={67} />
        </View>
        <View style={styles.dialogueHeader}>
          <View style={styles.dialogueTitleArea}>
            <Text style={styles.dialogueMarker}>{destination.type === "internal" ? "INSIDE ADMIN" : "LOCATION"}</Text>
            <Text selectable style={styles.dialogueTitle}>{destination.displayName}</Text>
          </View>
          <Pressable accessibilityLabel="Close building information" onPress={onClose} style={styles.dialogueClose}>
            <X color={campusMapPalette.ink} size={17} strokeWidth={3} />
          </Pressable>
        </View>
        <Text selectable style={styles.dialogueText}>{destination.orientation}</Text>
        {details.map((detail) => (
          <Text selectable key={detail} style={styles.detailText}>{detail}</Text>
        ))}
        {destination.shortcut ? (
          <Pressable accessibilityRole="button" onPress={onAction} style={styles.dialogueAction}>
            <Text style={styles.dialogueActionText}>{destination.shortcut.label}</Text>
            <ChevronRight color={campusMapPalette.paleGoldBright} size={17} strokeWidth={3} />
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

function DirectionButton({
  children,
  direction,
  onPressIn,
  onPressOut
}: {
  children: React.ReactNode;
  direction: CampusMapDirection;
  onPressIn: (direction: CampusMapDirection) => void;
  onPressOut: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`Walk ${direction}`}
      accessibilityRole="button"
      onPressIn={() => onPressIn(direction)}
      onPressOut={onPressOut}
      style={({ pressed }) => [styles.directionButton, pressed ? styles.directionButtonPressed : undefined]}
    >
      {children}
    </Pressable>
  );
}
