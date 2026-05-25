import { describe, expect, it } from "vitest";

import { orgChartColleges } from "@/data/orgChart";
import {
  calculateFitTransform,
  clampOrgTranslation,
  clampOrgZoom,
  createOrgChartLayout,
  ORG_MAX_ZOOM,
  ORG_NODE_HEIGHT,
  ORG_NODE_WIDTH
} from "./orgChartLayout";

describe("org chart viewport layout", () => {
  it("fits all selected-college nodes and connector endpoints inside a phone viewport", () => {
    const viewport = { width: 360, height: 470 };

    orgChartColleges.forEach((college) => {
      const layout = createOrgChartLayout(college.data);
      const fit = calculateFitTransform(layout, viewport, 16);

      layout.nodes.forEach((node) => {
        expect(fit.x + node.x * fit.scale).toBeGreaterThanOrEqual(15.9);
        expect(fit.y + node.y * fit.scale).toBeGreaterThanOrEqual(15.9);
        expect(fit.x + (node.x + ORG_NODE_WIDTH) * fit.scale).toBeLessThanOrEqual(viewport.width - 15.9);
        expect(fit.y + (node.y + ORG_NODE_HEIGHT) * fit.scale).toBeLessThanOrEqual(viewport.height - 15.9);
      });

      layout.connectors.forEach((line) => {
        [line.x1, line.x2].forEach((x) => {
          expect(fit.x + x * fit.scale).toBeGreaterThanOrEqual(15.9);
          expect(fit.x + x * fit.scale).toBeLessThanOrEqual(viewport.width - 15.9);
        });
      });
    });
  });

  it("recomputes fit for narrower viewports and caps interactive zoom", () => {
    const layout = createOrgChartLayout(orgChartColleges[0]!.data);
    const wide = calculateFitTransform(layout, { width: 430, height: 470 });
    const narrow = calculateFitTransform(layout, { width: 320, height: 470 });

    expect(narrow.scale).toBeLessThan(wide.scale);
    expect(clampOrgZoom(99, narrow.scale)).toBe(ORG_MAX_ZOOM);
    expect(clampOrgZoom(0.001, narrow.scale)).toBe(narrow.scale);
  });

  it("keeps a zoomed canvas reachable after excessive panning", () => {
    const layout = createOrgChartLayout(orgChartColleges[1]!.data);
    const viewport = { width: 360, height: 470 };
    const clamped = clampOrgTranslation({ scale: 1, x: -10000, y: 10000 }, layout, viewport);

    expect(clamped.x).toBeGreaterThan(-layout.canvasWidth);
    expect(clamped.y).toBe((viewport.height - layout.canvasHeight) / 2);
  });
});
