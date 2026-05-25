import {
  getCampusMapDestination,
  getCampusMapRegion,
  getCampusMapTapDestinations,
  type CampusMapDestination
} from "@/data/campusMapDestinations";

export type CampusMapDirection = "down" | "left" | "right" | "up";

export interface CampusMapPoint {
  x: number;
  y: number;
}

export interface CampusMapRect {
  height: number;
  id: string;
  left: number;
  top: number;
  width: number;
}

export interface CampusMapGameplayDestination {
  destinationId: string;
  interactionZones: readonly CampusMapRect[];
  promptAnchor: CampusMapPoint;
  verifiedDetails: readonly string[];
}

export const NO_VERIFIED_ROOM_LISTING =
  "Room and office details for this building are not available yet.";

export const CAMPUS_PLAYER_SPAWN = {
  direction: "up" as CampusMapDirection,
  destinationId: "main-entrance",
  // Coordinates are Haki's ground-contact point, not his full visible sprite bounds.
  position: { x: 82, y: 96 } as CampusMapPoint
} as const;

export const CAMPUS_MAP_STEP = 1.25;

export const campusMapWalkZones: readonly CampusMapRect[] = [
  { id: "entrance-approach", left: 79, top: 91, width: 7, height: 9 },
  { id: "south-road", left: 0, top: 87, width: 86, height: 7 },
  { id: "east-road", left: 81, top: 26, width: 13, height: 68 },
  { id: "north-road", left: 12, top: 26, width: 82, height: 8 },
  { id: "west-road", left: 12, top: 26, width: 9, height: 64 },
  { id: "central-west-walk", left: 34, top: 32, width: 7, height: 57 },
  { id: "central-east-walk", left: 63, top: 31, width: 19, height: 58 },
  { id: "central-axis", left: 37, top: 29, width: 31, height: 60 },
  { id: "it-to-admin-front-path", left: 14, top: 89, width: 54, height: 5 },
  { id: "civil-court-hall-passage", left: 35, top: 32, width: 4, height: 46 },
  { id: "open-court", left: 39, top: 61, width: 25, height: 16 },
  { id: "north-buildings-path", left: 55, top: 8, width: 29, height: 21 }
] as const;

const ADMIN_DETAILS = [
  "You can find these offices here: Office of Student Affairs (OSA), Guidance Office, Clinic / Medical Office, Dental Office, and Information."
] as const;

const IT_BUILDING_DETAILS = [
  "Building for BSIT students.",
  "1st floor: Room 101, Room 102, Room 103, Audit Office, and comfort room.",
  "2nd floor: Room 201, Room 202, Room 203, IT Faculty, Conference Room, MTICS Office, and comfort room.",
  "3rd floor: Room 301 (Computer Lab), Room 302 (Computer Lab), and IT Library.",
  "4th floor: IT Hall."
] as const;

const gameplayDestinations: readonly CampusMapGameplayDestination[] = [
  {
    destinationId: "main-entrance",
    interactionZones: [{ id: "main-entrance-access", left: 78, top: 92, width: 9, height: 8 }],
    promptAnchor: { x: 59, y: 90 },
    verifiedDetails: [NO_VERIFIED_ROOM_LISTING]
  },
  {
    destinationId: "admin-building",
    interactionZones: [
      { id: "admin-north-access", left: 38, top: 76, width: 30, height: 5 },
      { id: "admin-south-access", left: 38, top: 88, width: 30, height: 5 }
    ],
    promptAnchor: { x: 39, y: 76 },
    verifiedDetails: ADMIN_DETAILS
  },
  {
    destinationId: "it-building",
    interactionZones: [{ id: "it-south-access", left: 14, top: 88, width: 22, height: 5 }],
    promptAnchor: { x: 14, y: 77 },
    verifiedDetails: IT_BUILDING_DETAILS
  },
  {
    destinationId: "tambayan",
    interactionZones: [{ id: "tambayan-east-access", left: 10, top: 72, width: 5, height: 15 }],
    promptAnchor: { x: 4, y: 68 },
    verifiedDetails: [NO_VERIFIED_ROOM_LISTING]
  },
  {
    destinationId: "italian-building",
    interactionZones: [{ id: "italian-east-access", left: 12, top: 35, width: 8, height: 30 }],
    promptAnchor: { x: 4, y: 32 },
    verifiedDetails: [NO_VERIFIED_ROOM_LISTING]
  },
  {
    destinationId: "civil-mechanical-building",
    interactionZones: [{ id: "civil-east-access", left: 34, top: 34, width: 7, height: 42 }],
    promptAnchor: { x: 16, y: 31 },
    verifiedDetails: [NO_VERIFIED_ROOM_LISTING]
  },
  {
    destinationId: "open-court",
    interactionZones: [{ id: "court-floor", left: 39, top: 61, width: 25, height: 16 }],
    promptAnchor: { x: 40, y: 59 },
    verifiedDetails: [NO_VERIFIED_ROOM_LISTING]
  },
  {
    destinationId: "multipurpose-hall",
    interactionZones: [
      { id: "hall-west-access", left: 34, top: 34, width: 5, height: 14 },
      { id: "hall-east-access", left: 62, top: 34, width: 7, height: 10 }
    ],
    promptAnchor: { x: 38, y: 31 },
    verifiedDetails: [NO_VERIFIED_ROOM_LISTING]
  },
  {
    destinationId: "canteen",
    interactionZones: [
      { id: "canteen-south-access", left: 39, top: 49, width: 23, height: 5 },
      { id: "canteen-east-access", left: 62, top: 43, width: 7, height: 10 }
    ],
    promptAnchor: { x: 42, y: 42 },
    verifiedDetails: [NO_VERIFIED_ROOM_LISTING]
  },
  {
    destinationId: "library",
    interactionZones: [{ id: "library-south-access", left: 42, top: 26, width: 24, height: 7 }],
    promptAnchor: { x: 43, y: 14 },
    verifiedDetails: [NO_VERIFIED_ROOM_LISTING]
  },
  {
    destinationId: "dormitory",
    interactionZones: [{ id: "dormitory-south-access", left: 38, top: 14, width: 27, height: 6 }],
    promptAnchor: { x: 38, y: 8 },
    verifiedDetails: [NO_VERIFIED_ROOM_LISTING]
  },
  {
    destinationId: "gymnasium",
    interactionZones: [
      { id: "gym-west-access", left: 72, top: 4, width: 6, height: 20 },
      { id: "gym-south-access", left: 76, top: 21, width: 18, height: 6 }
    ],
    promptAnchor: { x: 59, y: 8 },
    verifiedDetails: [NO_VERIFIED_ROOM_LISTING]
  },
  {
    destinationId: "basic-arts-sciences",
    interactionZones: [{ id: "bas-west-access", left: 63, top: 48, width: 7, height: 30 }],
    promptAnchor: { x: 50, y: 45 },
    verifiedDetails: [NO_VERIFIED_ROOM_LISTING]
  },
  {
    destinationId: "comfort-room",
    interactionZones: [{ id: "comfort-room-west-access", left: 87, top: 52, width: 7, height: 11 }],
    promptAnchor: { x: 59, y: 49 },
    verifiedDetails: [NO_VERIFIED_ROOM_LISTING]
  }
] as const;

const blockedDestinationIds = new Set(
  getCampusMapTapDestinations()
    .filter((destination) => destination.id !== "main-entrance" && destination.id !== "open-court")
    .map((destination) => destination.id)
);

const gameplayById = new Map(gameplayDestinations.map((destination) => [destination.destinationId, destination]));

function containsPoint(rect: CampusMapRect, point: CampusMapPoint): boolean {
  return (
    point.x >= rect.left &&
    point.x <= rect.left + rect.width &&
    point.y >= rect.top &&
    point.y <= rect.top + rect.height
  );
}

function insideDestinationRegion(destination: CampusMapDestination, point: CampusMapPoint): boolean {
  const region = getCampusMapRegion(destination);
  return (
    point.x >= region.left &&
    point.x <= region.left + region.width &&
    point.y >= region.top &&
    point.y <= region.top + region.height
  );
}

function distanceSquared(left: CampusMapPoint, right: CampusMapPoint): number {
  const xDistance = left.x - right.x;
  const yDistance = left.y - right.y;
  return xDistance * xDistance + yDistance * yDistance;
}

export function isCampusMapPositionWalkable(position: CampusMapPoint): boolean {
  // Test the foot anchor only so feathers can overlap scenery beside narrow paths.
  if (position.x < 0 || position.x > 100 || position.y < 0 || position.y > 100) {
    return false;
  }

  if (!campusMapWalkZones.some((zone) => containsPoint(zone, position))) {
    return false;
  }

  return !getCampusMapTapDestinations().some(
    (destination) => blockedDestinationIds.has(destination.id) && insideDestinationRegion(destination, position)
  );
}

export function moveCampusPlayer(position: CampusMapPoint, direction: CampusMapDirection): CampusMapPoint {
  const movement = {
    down: { x: 0, y: CAMPUS_MAP_STEP },
    left: { x: -CAMPUS_MAP_STEP, y: 0 },
    right: { x: CAMPUS_MAP_STEP, y: 0 },
    up: { x: 0, y: -CAMPUS_MAP_STEP }
  }[direction];
  const candidate = {
    x: Math.round((position.x + movement.x) * 100) / 100,
    y: Math.round((position.y + movement.y) * 100) / 100
  };

  return isCampusMapPositionWalkable(candidate) ? candidate : position;
}

export function getCampusMapGameplayDestination(destinationId: string): CampusMapGameplayDestination | undefined {
  const destination = getCampusMapDestination(destinationId);
  if (!destination) return undefined;

  if (destination.type === "internal") {
    const admin = gameplayById.get("admin-building");
    if (!admin) return undefined;
    return {
      destinationId,
      interactionZones: admin.interactionZones,
      promptAnchor: admin.promptAnchor,
      verifiedDetails: [destination.orientation]
    };
  }

  return gameplayById.get(destinationId);
}

export function findNearbyCampusDestination(position: CampusMapPoint): CampusMapDestination | undefined {
  return gameplayDestinations
    .filter((gameplay) => gameplay.interactionZones.some((zone) => containsPoint(zone, position)))
    .sort((left, right) => distanceSquared(left.promptAnchor, position) - distanceSquared(right.promptAnchor, position))
    .map((gameplay) => getCampusMapDestination(gameplay.destinationId))
    .find((destination): destination is CampusMapDestination => destination !== undefined);
}
