import { describe, expect, it } from "vitest";

import { getTopicsByCategory, searchTopics } from "@/data/libraryTopics";

describe("library topics", () => {
  it("makes I.T. Building rooms and facilities searchable", () => {
    for (const query of ["Room 101", "MTICS Office", "Room 302", "IT Hall"]) {
      expect(searchTopics(query)[0]?.chunkId).toBe("tup_taguig_it_building_rooms_floor_directory");
    }
  });

  it("shows provisional policy cards only as pending Service Desk topics", () => {
    const insurance = searchTopics("student insurance")[0];
    const parking = searchTopics("motor parking")[0];
    expect(insurance?.verificationStatus).toBe("pending");
    expect(insurance?.content).toContain("PHP 25");
    expect(parking?.verificationStatus).toBe("pending");
    expect(getTopicsByCategory("Offices")).toContain(insurance);
    expect(getTopicsByCategory("Offices")).toContain(parking);
  });
});
