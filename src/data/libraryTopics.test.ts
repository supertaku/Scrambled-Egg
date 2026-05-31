import { describe, expect, it } from "vitest";

import { getTopicsByCategory, searchTopics } from "@/data/libraryTopics";

describe("library topics", () => {
  it("makes I.T. Building rooms and facilities searchable", () => {
    for (const query of ["Room 101", "MTICS Office", "Room 302", "IT Hall"]) {
      expect(searchTopics(query)[0]?.chunkId).toBe("tup_taguig_it_building_rooms_floor_directory");
    }
  });

  it("hides provisional policy cards from production topic search", () => {
    const insurance = searchTopics("student insurance")[0];
    const parking = searchTopics("motor parking")[0];
    expect(insurance).toBeUndefined();
    expect(parking).toBeUndefined();
    expect(getTopicsByCategory("Offices").some((topic) => topic.verificationStatus === "pending")).toBe(false);
  });
});
