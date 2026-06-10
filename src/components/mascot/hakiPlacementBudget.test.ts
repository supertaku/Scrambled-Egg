import { describe, expect, it } from "vitest";

import { placementBudgetFor } from "./hakiPlacementBudget";

describe("Haki placement budgets", () => {
  it("keeps repeated avatars static and map Haki simplified", () => {
    expect(placementBudgetFor("chatAvatar")).toMatchObject({ detail: "static", animate: false });
    expect(placementBudgetFor("mapPlayer")).toMatchObject({ detail: "map", animate: true });
    expect(placementBudgetFor("header")).toMatchObject({ detail: "full", animate: true, showMoodBadge: true });
  });
});
