import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Search, X } from "lucide-react-native";
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
  type ViewStyle
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HakiMascot } from "@/components/mascot/HakiMascot";
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
import { useDebouncedQuery } from "@/hooks/useDebouncedQuery";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useHakiBond } from "@/components/mascot/useHakiBond";
import { colors } from "@/theme/colors";

interface MapFrame {
  height: number;
  left: number;
  top: number;
  width: number;
}

const SPRITE_WIDTH = 36;
const SPRITE_HEIGHT = 36;
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
  const { recordBondEvent } = useHakiBond();
  const { clearQuery, debouncedQuery, query, setQuery } = useDebouncedQuery(100);
  const [frame, setFrame] = useState<MapFrame>({ height: 0, left: 0, top: 0, width: 0 });
  const [direction, setDirection] = useState<CampusMapDirection>(CAMPUS_PLAYER_SPAWN.direction);
  const [playerPosition, setPlayerPosition] = useState<CampusMapPoint>(CAMPUS_PLAYER_SPAWN.position);
  const [remoteDestinationId, setRemoteDestinationId] = useState<string | null>(null);
  const [dialogDestinationId, setDialogDestinationId] = useState<string | null>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const [debugVisible, setDebugVisible] = useState(false);
  const movementTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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
    recordBondEvent("mapDiscovery");
  }, [recordBondEvent, stopMovement]);

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
          <ChevronLeft color="#3B2022" size={18} strokeWidth={3} />
          <Text style={styles.backText}>BACK</Text>
        </Pressable>

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
            {searchVisible ? <X color="#3B2022" size={19} strokeWidth={3} /> : <Search color="#3B2022" size={18} strokeWidth={3} />}
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
                  placeholderTextColor="#766D60"
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
            <ChevronUp color="#35252A" size={22} strokeWidth={3} />
          </DirectionButton>
          <View style={styles.dpadMiddle}>
            <DirectionButton direction="left" onPressIn={startMovement} onPressOut={stopMovement}>
              <ChevronLeft color="#35252A" size={22} strokeWidth={3} />
            </DirectionButton>
            <View style={styles.dpadCenter} />
            <DirectionButton direction="right" onPressIn={startMovement} onPressOut={stopMovement}>
              <ChevronRight color="#35252A" size={22} strokeWidth={3} />
            </DirectionButton>
          </View>
          <DirectionButton direction="down" onPressIn={startMovement} onPressOut={stopMovement}>
            <ChevronDown color="#35252A" size={22} strokeWidth={3} />
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
  const hakiDirection = direction === "down" ? "front" : direction === "up" ? "back" : direction;
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
      <HakiMascot activity="walking" direction={hakiDirection} placement="mapPlayer" size={44} />
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
        <ChevronRight color="#FCE9A5" size={13} strokeWidth={3} />
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
          <HakiMascot activity="exploring" placement="mapDialogue" reducedMotion={reducedMotion} size={94} />
        </View>
        <View style={styles.dialogueHeader}>
          <View style={styles.dialogueTitleArea}>
            <Text style={styles.dialogueMarker}>{destination.type === "internal" ? "INSIDE ADMIN" : "LOCATION"}</Text>
            <Text selectable style={styles.dialogueTitle}>{destination.displayName}</Text>
          </View>
          <Pressable accessibilityLabel="Close building information" onPress={onClose} style={styles.dialogueClose}>
            <X color="#35252A" size={17} strokeWidth={3} />
          </Pressable>
        </View>
        <Text selectable style={styles.dialogueText}>{destination.orientation}</Text>
        {details.map((detail) => (
          <Text selectable key={detail} style={styles.detailText}>{detail}</Text>
        ))}
        {destination.shortcut ? (
          <Pressable accessibilityRole="button" onPress={onAction} style={styles.dialogueAction}>
            <Text style={styles.dialogueActionText}>{destination.shortcut.label}</Text>
            <ChevronRight color="#FEF1B5" size={17} strokeWidth={3} />
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

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "#17151C",
    flex: 1
  },
  stage: {
    backgroundColor: "#17151C",
    flex: 1,
    overflow: "hidden"
  },
  mapViewport: {
    bottom: 8,
    left: 0,
    position: "absolute",
    right: 0,
    top: 58
  },
  mapCanvas: {
    borderColor: "#2B2625",
    borderWidth: 2,
    overflow: "hidden",
    position: "absolute"
  },
  mapImage: {
    height: "100%",
    width: "100%"
  },
  backButton: {
    alignItems: "center",
    backgroundColor: "#FFDA77",
    borderBottomColor: "#4B2825",
    borderBottomWidth: 4,
    borderColor: "#F8EDB5",
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderTopWidth: 3,
    flexDirection: "row",
    gap: 3,
    left: 10,
    paddingHorizontal: 9,
    paddingVertical: 8,
    position: "absolute",
    top: 9,
    zIndex: 20
  },
  backText: {
    color: "#3B2022",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.7
  },
  searchArea: {
    alignItems: "flex-end",
    position: "absolute",
    right: 10,
    top: 9,
    zIndex: 20
  },
  searchToggle: {
    alignItems: "center",
    backgroundColor: "#FFDA77",
    borderBottomColor: "#4B2825",
    borderBottomWidth: 4,
    borderColor: "#F8EDB5",
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderTopWidth: 3,
    height: 42,
    justifyContent: "center",
    width: 44
  },
  debugToggle: {
    alignItems: "center",
    backgroundColor: "#2C2830",
    borderColor: "#FFDA77",
    borderWidth: 1,
    marginTop: 6,
    paddingHorizontal: 7,
    paddingVertical: 5
  },
  debugToggleActive: {
    backgroundColor: "#6B292B"
  },
  debugToggleText: {
    color: "#FFDA77",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.7
  },
  searchPanel: {
    backgroundColor: "#FFF3BF",
    borderColor: "#3B2022",
    borderWidth: 3,
    gap: 7,
    marginTop: 6,
    padding: 8,
    width: 236
  },
  searchLabel: {
    color: "#6B292B",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1
  },
  searchInputRow: {
    backgroundColor: "#FFFBE4",
    borderColor: "#735050",
    borderWidth: 2,
    paddingHorizontal: 7
  },
  searchInput: {
    color: "#35252A",
    fontSize: 12,
    fontWeight: "700",
    paddingVertical: 8
  },
  results: {
    maxHeight: 155
  },
  resultButton: {
    backgroundColor: "#F7DF91",
    borderColor: "#7B3937",
    borderWidth: 1,
    marginBottom: 4,
    paddingHorizontal: 8,
    paddingVertical: 8
  },
  resultText: {
    color: "#35252A",
    fontSize: 11,
    fontWeight: "800"
  },
  noResults: {
    color: "#654E48",
    fontSize: 11,
    fontWeight: "700",
    paddingVertical: 5
  },
  searchHint: {
    color: "#654E48",
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 14
  },
  highlight: {
    backgroundColor: "rgba(255, 215, 91, 0.26)",
    borderColor: "#FFD85E",
    borderWidth: 3,
    shadowColor: "#FFD85E",
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 5
  },
  debugLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4
  },
  debugWalkZone: {
    backgroundColor: "rgba(29, 160, 75, 0.17)",
    borderColor: "rgba(29, 160, 75, 0.72)",
    borderWidth: 1
  },
  debugBuildingRegion: {
    backgroundColor: "rgba(204, 32, 46, 0.22)",
    borderColor: "rgba(224, 59, 69, 0.85)",
    borderWidth: 1
  },
  debugInteractionZone: {
    backgroundColor: "rgba(255, 215, 91, 0.24)",
    borderColor: "#FFD85E",
    borderWidth: 1
  },
  debugFootPoint: {
    backgroundColor: "#50C8FF",
    borderColor: "#0D2337",
    borderRadius: 4,
    borderWidth: 1,
    height: 7,
    marginLeft: -3,
    marginTop: -3,
    position: "absolute",
    width: 7
  },
  spritePosition: {
    height: SPRITE_HEIGHT,
    position: "absolute",
    width: SPRITE_WIDTH,
    zIndex: 6
  },
  spriteImage: {
    height: "100%",
    width: "100%"
  },
  promptPosition: {
    maxWidth: 185,
    position: "absolute",
    zIndex: 12
  },
  promptButton: {
    alignItems: "center",
    backgroundColor: "#6D1930",
    borderColor: "#FCE9A5",
    borderWidth: 2,
    flexDirection: "row",
    gap: 5,
    maxWidth: 185,
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  promptText: {
    color: "#FFF3C7",
    flexShrink: 1,
    fontSize: 10,
    fontWeight: "900"
  },
  dpad: {
    alignItems: "center",
    backgroundColor: "rgba(30, 22, 28, 0.7)",
    borderColor: "rgba(255, 226, 140, 0.75)",
    borderWidth: 2,
    bottom: 13,
    left: 12,
    padding: 7,
    position: "absolute",
    zIndex: 18
  },
  dpadMiddle: {
    flexDirection: "row"
  },
  dpadCenter: {
    backgroundColor: "#4B3538",
    height: 38,
    width: 38
  },
  directionButton: {
    alignItems: "center",
    backgroundColor: "#F6D26F",
    borderColor: "#533234",
    borderWidth: 2,
    height: 38,
    justifyContent: "center",
    width: 38
  },
  directionButtonPressed: {
    backgroundColor: "#D7AE47"
  },
  dimmedControls: {
    opacity: 0.32
  },
  dialogue: {
    bottom: 12,
    left: 10,
    position: "absolute",
    right: 10,
    zIndex: 30
  },
  dialogueInner: {
    backgroundColor: "#FFF3BF",
    borderColor: "#3B2022",
    borderWidth: 4,
    gap: 8,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.38,
    shadowRadius: 0
  },
  dialogueMascot: {
    position: "absolute",
    right: 35,
    top: -72,
    zIndex: 4
  },
  dialogueHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10
  },
  dialogueTitleArea: {
    flex: 1,
    gap: 2
  },
  dialogueMarker: {
    color: "#7A0019",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1
  },
  dialogueTitle: {
    color: "#35252A",
    fontSize: 16,
    fontWeight: "900"
  },
  dialogueClose: {
    alignItems: "center",
    backgroundColor: "#F6D26F",
    borderColor: "#533234",
    borderWidth: 2,
    height: 30,
    justifyContent: "center",
    width: 30
  },
  dialogueText: {
    color: "#493E39",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18
  },
  detailText: {
    color: "#493E39",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 17
  },
  dialogueAction: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#6D1930",
    borderColor: "#C89E47",
    borderWidth: 2,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 9
  },
  dialogueActionText: {
    color: "#FEF1B5",
    fontSize: 11,
    fontWeight: "900"
  }
});
