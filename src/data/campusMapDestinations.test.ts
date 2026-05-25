import { describe, expect, it } from "vitest";

import {
  getCampusMapDestination,
  getCampusMapRegion,
  searchCampusMapDestinations
} from "@/data/campusMapDestinations";

function firstResult(query: string) {
  const destination = searchCampusMapDestinations(query)[0];
  expect(destination).toBeDefined();
  return destination!;
}

describe("campus map destinations", () => {
  it("finds mapped destinations by student-facing aliases", () => {
    expect(firstResult("Gym").id).toBe("gymnasium");
    expect(firstResult("BAS").id).toBe("basic-arts-sciences");
    expect(firstResult("IT").id).toBe("it-building");
    expect(firstResult("CR").id).toBe("comfort-room");
  });

  it("resolves verified internal destinations to the Admin Building highlight", () => {
    for (const query of ["OSA", "Clinic", "Guidance", "Dental"]) {
      expect(getCampusMapRegion(firstResult(query)).id).toBe("admin-building");
    }
  });

  it("does not create unconfirmed placement results", () => {
    expect(searchCampusMapDestinations("Cashier")).toEqual([]);
    expect(searchCampusMapDestinations("Registrar")).toEqual([]);
  });

  it("offers shortcuts only for destinations backed by existing local content", () => {
    expect(getCampusMapDestination("canteen")?.shortcut?.route).toBe("/canteen");
    expect(getCampusMapDestination("osa")?.shortcut?.query).toBe("Office of the Student Affairs");
    expect(getCampusMapDestination("admin-building")?.shortcut?.route).toBe("/library");
    expect(getCampusMapDestination("it-building")?.shortcut?.query).toBe("I.T. Building");
    expect(getCampusMapDestination("gymnasium")?.shortcut).toBeNull();
    expect(getCampusMapDestination("comfort-room")?.shortcut).toBeNull();
  });
});
