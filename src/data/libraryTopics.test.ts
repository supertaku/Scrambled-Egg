import { describe, expect, it } from "vitest";

import {
  getOfficeFilters,
  getServiceDeskCounters,
  getTopicsByCategory,
  searchTopics,
  serviceDeskCounterForTopic,
  topicMatchesOfficeFilter
} from "@/data/libraryTopics";

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

  it("groups service desk counters into the required student-facing buckets", () => {
    expect(getServiceDeskCounters()).toEqual(["Offices", "Safety", "Campus Guidelines", "Map Directory"]);
    expect(serviceDeskCounterForTopic(searchTopics("Temporary ID Gate Pass")[0]!)).toBe("Offices");
    expect(serviceDeskCounterForTopic(searchTopics("Emergency Response Guide")[0]!)).toBe("Safety");
    expect(serviceDeskCounterForTopic(searchTopics("Sunday")[0]!)).toBe("Campus Guidelines");
    expect(serviceDeskCounterForTopic(searchTopics("Room 101")[0]!)).toBe("Map Directory");
  });

  it("derives office filters from seeded office-affiliated topics", () => {
    const officeTopics = getTopicsByCategory("Offices");
    const labels = getOfficeFilters(officeTopics).map((filter) => filter.label);

    expect(labels).toContain("All");
    expect(labels).toContain("OSA");
    expect(labels).toContain("Medical Clinic");
    expect(labels).toContain("Dental Clinic");
    expect(labels).toContain("Guidance");

    const dental = officeTopics.filter((topic) => topicMatchesOfficeFilter(topic, "Dental Clinic"));
    const medical = officeTopics.filter((topic) => topicMatchesOfficeFilter(topic, "Medical Clinic"));
    expect(dental.some((topic) => /dental/i.test(`${topic.sectionTitle} ${topic.content}`))).toBe(true);
    expect(medical.some((topic) => /medical|consultation|first aid/i.test(`${topic.sectionTitle} ${topic.content}`))).toBe(true);
  });
});
