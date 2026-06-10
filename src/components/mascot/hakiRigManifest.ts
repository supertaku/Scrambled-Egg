export interface HakiRigPart {
  asset: string;
  height: number;
  pivotX: number;
  pivotY: number;
  width: number;
}

export const HAKI_RIG_PARTS: Record<string, HakiRigPart> = {
  head: { asset: "head.png", width: 800, height: 720, pivotX: 400, pivotY: 360 },
  body: { asset: "body.png", width: 550, height: 535, pivotX: 275, pivotY: 180 },
  wingLeftUpper: { asset: "wingLeftUpper.png", width: 235, height: 190, pivotX: 151, pivotY: 20 },
  wingLeftFore: { asset: "wingLeftFore.png", width: 235, height: 205, pivotX: 110, pivotY: 20 },
  wingLeftPrimary: { asset: "wingLeftPrimary.png", width: 235, height: 175, pivotX: 110, pivotY: 20 },
  wingRightUpper: { asset: "wingRightUpper.png", width: 235, height: 190, pivotX: 84, pivotY: 20 },
  wingRightFore: { asset: "wingRightFore.png", width: 235, height: 205, pivotX: 125, pivotY: 20 },
  wingRightPrimary: { asset: "wingRightPrimary.png", width: 235, height: 175, pivotX: 125, pivotY: 20 },
  legLeft: { asset: "legLeft.png", width: 220, height: 285, pivotX: 110, pivotY: 35 },
  legRight: { asset: "legRight.png", width: 220, height: 285, pivotX: 110, pivotY: 35 },
  eyelid: { asset: "eyelid.png", width: 164, height: 104, pivotX: 82, pivotY: 92 },
  tailFeather: { asset: "tailFeather.png", width: 120, height: 290, pivotX: 60, pivotY: 20 }
};
