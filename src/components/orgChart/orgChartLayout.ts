import type { OrgNode } from "@/data/orgChart";

export const ORG_NODE_WIDTH = 190;
export const ORG_NODE_HEIGHT = 64;
export const ORG_HORIZONTAL_GAP = 24;
export const ORG_VERTICAL_GAP = 36;
export const ORG_CANVAS_PADDING = 20;
export const ORG_MIN_ZOOM = 0.24;
export const ORG_MAX_ZOOM = 2.4;

export interface OrgLayoutNode {
  node: OrgNode;
  x: number;
  y: number;
}

export interface OrgConnector {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface OrgChartLayout {
  canvasHeight: number;
  canvasWidth: number;
  connectors: OrgConnector[];
  nodes: OrgLayoutNode[];
}

export interface OrgViewport {
  height: number;
  width: number;
}

export interface OrgTransform {
  scale: number;
  x: number;
  y: number;
}

interface SubtreeLayout {
  height: number;
  nodes: OrgLayoutNode[];
  width: number;
}

function layoutSubtree(node: OrgNode, offsetX: number, offsetY: number): SubtreeLayout {
  const children = node.children ?? [];
  if (children.length === 0) {
    return {
      height: ORG_NODE_HEIGHT,
      nodes: [{ node, x: offsetX, y: offsetY }],
      width: ORG_NODE_WIDTH
    };
  }

  const childLayouts = children.map((child) => layoutSubtree(child, 0, 0));
  const childrenWidth = childLayouts.reduce(
    (total, childLayout, index) => total + childLayout.width + (index === 0 ? 0 : ORG_HORIZONTAL_GAP),
    0
  );
  const width = Math.max(ORG_NODE_WIDTH, childrenWidth);
  const rootX = offsetX + (width - ORG_NODE_WIDTH) / 2;
  const nodes: OrgLayoutNode[] = [{ node, x: rootX, y: offsetY }];
  let childX = offsetX + (width - childrenWidth) / 2;

  childLayouts.forEach((childLayout) => {
    childLayout.nodes.forEach((childNode) => {
      nodes.push({
        node: childNode.node,
        x: childX + childNode.x,
        y: offsetY + ORG_NODE_HEIGHT + ORG_VERTICAL_GAP + childNode.y
      });
    });
    childX += childLayout.width + ORG_HORIZONTAL_GAP;
  });

  return {
    height: ORG_NODE_HEIGHT + ORG_VERTICAL_GAP + Math.max(...childLayouts.map((layout) => layout.height)),
    nodes,
    width
  };
}

function buildConnectors(root: OrgNode, nodes: OrgLayoutNode[]): OrgConnector[] {
  const byId = new Map(nodes.map((layoutNode) => [layoutNode.node.id, layoutNode]));
  const connectors: OrgConnector[] = [];

  function visit(node: OrgNode): void {
    const parent = byId.get(node.id);
    if (!parent) {
      return;
    }

    (node.children ?? []).forEach((child) => {
      const childLayout = byId.get(child.id);
      if (childLayout) {
        connectors.push({
          x1: parent.x + ORG_NODE_WIDTH / 2,
          y1: parent.y + ORG_NODE_HEIGHT,
          x2: childLayout.x + ORG_NODE_WIDTH / 2,
          y2: childLayout.y
        });
      }
      visit(child);
    });
  }

  visit(root);
  return connectors;
}

export function createOrgChartLayout(root: OrgNode): OrgChartLayout {
  const subtree = layoutSubtree(root, ORG_CANVAS_PADDING, ORG_CANVAS_PADDING);
  const canvasWidth = subtree.width + ORG_CANVAS_PADDING * 2;
  const canvasHeight = subtree.height + ORG_CANVAS_PADDING * 2;

  return {
    canvasHeight,
    canvasWidth,
    connectors: buildConnectors(root, subtree.nodes),
    nodes: subtree.nodes
  };
}

export function calculateFitTransform(
  layout: OrgChartLayout,
  viewport: OrgViewport,
  padding = 16
): OrgTransform {
  if (viewport.width <= 0 || viewport.height <= 0) {
    return { scale: 1, x: 0, y: 0 };
  }

  const availableWidth = Math.max(1, viewport.width - padding * 2);
  const availableHeight = Math.max(1, viewport.height - padding * 2);
  const scale = Math.min(1, availableWidth / layout.canvasWidth, availableHeight / layout.canvasHeight);

  return {
    scale,
    x: (viewport.width - layout.canvasWidth * scale) / 2,
    y: (viewport.height - layout.canvasHeight * scale) / 2
  };
}

export function clampOrgZoom(scale: number, minimumScale = ORG_MIN_ZOOM): number {
  return Math.min(ORG_MAX_ZOOM, Math.max(minimumScale, scale));
}

function clampAxis(position: number, contentSize: number, viewportSize: number, margin: number): number {
  if (contentSize <= viewportSize - margin * 2) {
    return (viewportSize - contentSize) / 2;
  }

  return Math.max(viewportSize - contentSize - margin, Math.min(margin, position));
}

export function clampOrgTranslation(
  transform: OrgTransform,
  layout: OrgChartLayout,
  viewport: OrgViewport,
  margin = 30
): OrgTransform {
  return {
    scale: transform.scale,
    x: clampAxis(transform.x, layout.canvasWidth * transform.scale, viewport.width, margin),
    y: clampAxis(transform.y, layout.canvasHeight * transform.scale, viewport.height, margin)
  };
}
