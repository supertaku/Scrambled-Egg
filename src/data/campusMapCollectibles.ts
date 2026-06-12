import { isCampusMapPositionWalkable, type CampusMapPoint } from "./campusMapGameplay";

/**
 * Feather Hunt: golden feathers scattered along the campus walk paths.
 * Walking over one collects it. Positions sit on verified walk zones
 * (asserted by the unit test) so every feather is reachable.
 */
export interface CampusFeather {
  id: string;
  position: CampusMapPoint;
}

/** Ground-contact pickup distance in map units. */
export const FEATHER_PICKUP_RADIUS = 2.2;

export const campusFeathers: readonly CampusFeather[] = [
  { id: "feather-south-road", position: { x: 30, y: 90 } },
  { id: "feather-entrance", position: { x: 83, y: 93 } },
  { id: "feather-east-road", position: { x: 90, y: 60 } },
  { id: "feather-north-road", position: { x: 45, y: 30 } },
  { id: "feather-west-road", position: { x: 15, y: 55 } },
  { id: "feather-open-court", position: { x: 50, y: 68 } },
  { id: "feather-central-walk", position: { x: 66, y: 45 } },
  { id: "feather-north-buildings", position: { x: 70, y: 15 } }
] as const;

export function isFeatherReachable(feather: CampusFeather): boolean {
  return isCampusMapPositionWalkable(feather.position);
}

/** The feather the player is standing on, if any remains uncollected. */
export function findFeatherAt(
  position: CampusMapPoint,
  collectedIds: ReadonlySet<string>
): CampusFeather | undefined {
  const radiusSquared = FEATHER_PICKUP_RADIUS * FEATHER_PICKUP_RADIUS;
  return campusFeathers.find((feather) => {
    if (collectedIds.has(feather.id)) {
      return false;
    }
    const dx = feather.position.x - position.x;
    const dy = feather.position.y - position.y;
    return dx * dx + dy * dy <= radiusSquared;
  });
}

export function allFeathersCollected(collectedIds: ReadonlySet<string>): boolean {
  return campusFeathers.every((feather) => collectedIds.has(feather.id));
}
