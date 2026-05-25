import { describe, expect, it } from "vitest";

import {
  CAMPUS_PLAYER_SPAWN,
  findNearbyCampusDestination,
  getCampusMapGameplayDestination,
  isCampusMapPositionWalkable,
  moveCampusPlayer
} from "@/data/campusMapGameplay";

function walkSteps(
  start: { x: number; y: number },
  direction: "down" | "left" | "right" | "up",
  count: number
) {
  let position = start;
  for (let index = 0; index < count; index += 1) {
    position = moveCampusPlayer(position, direction);
  }
  return position;
}

describe("campus map gameplay", () => {
  it("starts the student at the walkable Main Entrance interaction area", () => {
    expect(CAMPUS_PLAYER_SPAWN.destinationId).toBe("main-entrance");
    expect(isCampusMapPositionWalkable(CAMPUS_PLAYER_SPAWN.position)).toBe(true);
    expect(findNearbyCampusDestination(CAMPUS_PLAYER_SPAWN.position)?.id).toBe("main-entrance");
  });

  it("permits outdoor traversal and prevents entry into buildings or map bounds", () => {
    expect(isCampusMapPositionWalkable({ x: 50, y: 69 })).toBe(true);
    expect(isCampusMapPositionWalkable({ x: 51, y: 84 })).toBe(false);
    expect(isCampusMapPositionWalkable({ x: 50, y: 46 })).toBe(false);
    expect(isCampusMapPositionWalkable({ x: 50, y: 51 })).toBe(true);
    expect(isCampusMapPositionWalkable({ x: -1, y: 90 })).toBe(false);
    expect(moveCampusPlayer(CAMPUS_PLAYER_SPAWN.position, "up")).not.toEqual(CAMPUS_PLAYER_SPAWN.position);
    expect(moveCampusPlayer({ x: 51, y: 79 }, "down")).toEqual({ x: 51, y: 79 });
  });

  it("selects the nearest building interaction prompt from approach paths", () => {
    expect(findNearbyCampusDestination({ x: 48, y: 30 })?.id).toBe("library");
    expect(findNearbyCampusDestination({ x: 67, y: 65 })?.id).toBe("basic-arts-sciences");
  });

  it("lets the player walk along the fronts of the IT and Admin buildings", () => {
    expect(walkSteps({ x: 18.25, y: 91.25 }, "right", 28)).toEqual({ x: 53.25, y: 91.25 });
  });

  it("keeps a passage open between Civil/Mechanical, the court, and Multipurpose Hall", () => {
    expect(walkSteps({ x: 37.5, y: 76.25 }, "up", 27)).toEqual({ x: 37.5, y: 42.5 });
  });

  it("keeps the narrow passage between Civil-Mechanical and I.T. traversable by Haki's foot anchor", () => {
    expect(walkSteps({ x: 36.25, y: 91.25 }, "up", 13)).toEqual({ x: 36.25, y: 75 });
  });

  it("defines approach geometry for each visible map destination", () => {
    for (const destinationId of [
      "main-entrance",
      "admin-building",
      "it-building",
      "tambayan",
      "italian-building",
      "civil-mechanical-building",
      "open-court",
      "multipurpose-hall",
      "canteen",
      "library",
      "dormitory",
      "gymnasium",
      "basic-arts-sciences",
      "comfort-room"
    ]) {
      expect(getCampusMapGameplayDestination(destinationId)?.interactionZones.length).toBeGreaterThan(0);
    }
  });

  it("reuses Admin geometry and verified orientation for internal destinations", () => {
    const admin = getCampusMapGameplayDestination("admin-building");
    const clinic = getCampusMapGameplayDestination("clinic");
    expect(clinic?.promptAnchor).toEqual(admin?.promptAnchor);
    expect(clinic?.verifiedDetails[0]).toContain("inside the Admin Building");
    expect(admin?.verifiedDetails[0]).toContain("Office of Student Affairs");
  });

  it("shows the verified I.T. Building floor directory", () => {
    const itBuilding = getCampusMapGameplayDestination("it-building");
    expect(itBuilding?.verifiedDetails).toContain("Building for BSIT students.");
    expect(itBuilding?.verifiedDetails.join(" ")).toContain("MTICS Office");
    expect(itBuilding?.verifiedDetails.join(" ")).toContain("Room 302 (Computer Lab)");
    expect(itBuilding?.verifiedDetails.join(" ")).toContain("comfort room");
  });
});
