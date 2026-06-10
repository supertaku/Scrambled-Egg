import { Circle, Group, Image as SkiaImage, Path, useImage } from "@shopify/react-native-skia";
import { useDerivedValue } from "react-native-reanimated";

import { HAKI_ASSETS } from "./hakiAssets";
import type { HakiActivity, HakiAnimationEvent, HakiDirection } from "./hakiMascotState";
import type { useHakiAnimator } from "./useHakiAnimator";

interface HakiRigProps {
  activity: HakiActivity;
  animator: ReturnType<typeof useHakiAnimator>;
  direction: HakiDirection;
  event?: HakiAnimationEvent | undefined;
  simplified: boolean;
}

export function HakiRig({ activity, animator, direction, event, simplified }: HakiRigProps) {
  const body = useImage(HAKI_ASSETS.body);
  const staticImage = useImage(HAKI_ASSETS.static);
  const head = useImage(HAKI_ASSETS.head);
  const eyeLeftBase = useImage(HAKI_ASSETS.eyeLeftBase);
  const eyeRightBase = useImage(HAKI_ASSETS.eyeRightBase);
  const pupil = useImage(HAKI_ASSETS.pupil);
  const highlight = useImage(HAKI_ASSETS.highlight);
  const eyelid = useImage(HAKI_ASSETS.eyelid);
  const beakLower = useImage(HAKI_ASSETS.beakLower);
  const tongue = useImage(HAKI_ASSETS.tongue);
  const leftUpper = useImage(HAKI_ASSETS.wingLeftUpper);
  const leftFore = useImage(HAKI_ASSETS.wingLeftFore);
  const leftPrimary = useImage(HAKI_ASSETS.wingLeftPrimary);
  const rightUpper = useImage(HAKI_ASSETS.wingRightUpper);
  const rightFore = useImage(HAKI_ASSETS.wingRightFore);
  const rightPrimary = useImage(HAKI_ASSETS.wingRightPrimary);
  const legLeft = useImage(HAKI_ASSETS.legLeft);
  const legRight = useImage(HAKI_ASSETS.legRight);
  const tail = useImage(HAKI_ASSETS.tailFeather);
  const explorerHat = useImage(HAKI_ASSETS.explorerHat);
  const map = useImage(HAKI_ASSETS.map);
  const magnifier = useImage(HAKI_ASSETS.magnifier);
  const satchel = useImage(HAKI_ASSETS.satchel);
  const book = useImage(HAKI_ASSETS.book);
  const document = useImage(HAKI_ASSETS.document);
  const pointer = useImage(HAKI_ASSETS.pointer);
  const packageImage = useImage(HAKI_ASSETS.package);
  const lens = useImage(HAKI_ASSETS.lens);
  const celebration = useImage(HAKI_ASSETS.celebration);

  const directionTransform = direction === "left"
    ? [{ scaleX: -0.94 }, { rotate: -0.04 }]
    : direction === "right"
      ? [{ scaleX: 0.94 }, { rotate: 0.04 }]
      : [{ scaleX: 1 }];
  const leftWingTransform = useDerivedValue(() => [{ rotate: animator.leftWingRotation.value }]);
  const rightWingTransform = useDerivedValue(() => [{ rotate: animator.rightWingRotation.value }]);
  const leftFootTransform = useDerivedValue(() => [{ rotate: animator.leftFootRotation.value }]);
  const rightFootTransform = useDerivedValue(() => [{ rotate: animator.rightFootRotation.value }]);
  const tailTransform = useDerivedValue(() => [{ rotate: animator.tailRotation.value }]);
  const pupilLeftX = useDerivedValue(() => 370 + animator.gazeX.value);
  const pupilRightX = useDerivedValue(() => 601 + animator.gazeX.value);
  const pupilY = useDerivedValue(() => 446 + animator.gazeY.value);
  const lidTransform = useDerivedValue(() => [{ scaleY: Math.max(0.025, animator.blink.value) }]);
  const lowerBeakTransform = useDerivedValue(() => [{ translateY: animator.beakOpen.value * 25 }, { scaleY: 1 + animator.beakOpen.value * 0.18 }]);
  const effectOpacity = useDerivedValue(() => animator.effectProgress.value);
  const backFacing = direction === "back";
  const explorer = activity === "exploring" || activity === "admin";
  const showBook = activity === "onboarding";
  const showModelProps = activity === "modelOperation";
  const showCelebration = activity === "success";

  if (!body || !head || !eyeLeftBase || !eyeRightBase || !pupil || !leftUpper || !leftFore || !leftPrimary || !rightUpper || !rightFore || !rightPrimary || !legLeft || !legRight) {
    return <SkiaImage image={staticImage} x={0} y={0} width={1024} height={1536} />;
  }

  return (
    <Group transform={animator.rootTransform} origin={{ x: 512, y: 790 }}>
      <Group transform={directionTransform} origin={{ x: 512, y: 790 }}>
        {!simplified ? (
          <Group transform={tailTransform} origin={{ x: 512, y: 1110 }}>
            <SkiaImage image={tail} x={408} y={1015} width={120} height={290} />
            <Group transform={[{ rotate: -0.16 }]} origin={{ x: 454, y: 1050 }}><SkiaImage image={tail} x={350} y={1028} width={112} height={270} /></Group>
            <Group transform={[{ rotate: 0.16 }]} origin={{ x: 570, y: 1050 }}><SkiaImage image={tail} x={562} y={1028} width={112} height={270} /></Group>
          </Group>
        ) : null}

        <Group transform={leftFootTransform} origin={{ x: 360, y: 1190 }}>
          <SkiaImage image={legLeft} x={282} y={1155} width={220} height={285} />
        </Group>
        <Group transform={rightFootTransform} origin={{ x: 664, y: 1190 }}>
          <SkiaImage image={legRight} x={522} y={1155} width={220} height={285} />
        </Group>

        <Group transform={animator.torsoTransform} origin={{ x: 512, y: 900 }}>
          <SkiaImage image={body} x={237} y={715} width={550} height={535} />
        </Group>

        <Group transform={leftWingTransform} origin={{ x: 255, y: 760 }}>
          <SkiaImage image={leftUpper} x={104} y={740} width={235} height={190} />
          <Group transform={[{ rotate: -0.02 }]} origin={{ x: 210, y: 900 }}>
            <SkiaImage image={leftFore} x={104} y={885} width={235} height={205} />
            <SkiaImage image={leftPrimary} x={104} y={1040} width={235} height={175} />
          </Group>
        </Group>
        <Group transform={rightWingTransform} origin={{ x: 769, y: 760 }}>
          <SkiaImage image={rightUpper} x={685} y={740} width={235} height={190} />
          <Group transform={[{ rotate: 0.02 }]} origin={{ x: 814, y: 900 }}>
            <SkiaImage image={rightFore} x={685} y={885} width={235} height={205} />
            <SkiaImage image={rightPrimary} x={685} y={1040} width={235} height={175} />
          </Group>
        </Group>

        <Group transform={animator.headTransform} origin={{ x: 512, y: 445 }}>
          {!backFacing ? (
            <>
              <SkiaImage image={pupil} x={pupilLeftX} y={pupilY} width={62} height={100} />
              <SkiaImage image={pupil} x={pupilRightX} y={pupilY} width={62} height={100} />
              <SkiaImage image={eyeLeftBase} x={314} y={376} width={174} height={230} />
              <SkiaImage image={eyeRightBase} x={545} y={376} width={174} height={230} />
              <SkiaImage image={highlight} x={382} y={447} width={22} height={29} />
              <SkiaImage image={highlight} x={613} y={447} width={22} height={29} />
            </>
          ) : null}
          <SkiaImage image={head} x={112} y={90} width={800} height={720} />
          {backFacing ? <Circle cx={512} cy={462} r={265} color="#70757c" opacity={0.78} /> : null}
          {!backFacing ? (
            <>
              <Group transform={lidTransform} origin={{ x: 397, y: 472 }}><SkiaImage image={eyelid} x={315} y={380} width={164} height={104} /></Group>
              <Group transform={lidTransform} origin={{ x: 628, y: 472 }}><SkiaImage image={eyelid} x={546} y={380} width={164} height={104} /></Group>
              <Group transform={lowerBeakTransform} origin={{ x: 512, y: 655 }}>
                <SkiaImage image={tongue} x={474} y={657} width={78} height={48} opacity={animator.beakOpen} />
                <SkiaImage image={beakLower} x={453} y={643} width={118} height={78} opacity={animator.beakOpen} />
              </Group>
            </>
          ) : null}
        </Group>

        {explorer ? (
          <>
            <SkiaImage image={explorerHat} x={262} y={34} width={500} height={255} />
            {!simplified ? <SkiaImage image={satchel} x={610} y={840} width={210} height={218} /> : null}
            {activity === "admin" ? <SkiaImage image={magnifier} x={155} y={645} width={180} height={260} /> : <SkiaImage image={map} x={675} y={780} width={270} height={225} />}
          </>
        ) : null}
        {showBook && !simplified ? <SkiaImage image={book} x={600} y={815} width={300} height={218} /> : null}
        {showBook && !simplified ? <SkiaImage image={pointer} x={250} y={730} width={55} height={260} /> : null}
        {showModelProps ? <SkiaImage image={packageImage} x={655} y={825} width={230} height={212} /> : null}
        {showModelProps && !simplified ? <SkiaImage image={lens} x={165} y={695} width={215} height={215} /> : null}
        {activity === "answering" && !simplified ? <SkiaImage image={document} x={690} y={790} width={190} height={250} /> : null}
        {showCelebration && !simplified ? <SkiaImage image={celebration} x={670} y={175} width={185} height={185} opacity={effectOpacity} /> : null}

        <HakiEffects activity={activity} event={event} opacity={effectOpacity} />
      </Group>
    </Group>
  );
}

function HakiEffects({ activity, event, opacity }: { activity: HakiActivity; event?: HakiAnimationEvent | undefined; opacity: ReturnType<typeof useDerivedValue<number>> }) {
  if (activity === "sleepy") {
    return (
      <Group color="#7a0019" style="stroke" strokeWidth={16} strokeCap="round">
        <Path path="M720 310 L800 310 L730 390 L820 390" />
        <Path path="M790 220 L850 220 L800 280 L865 280" opacity={0.72} />
      </Group>
    );
  }
  if (activity === "groggy" || event === "groggy") {
    return (
      <Group opacity={opacity} color="#d9a62e">
        <Path path="M250 245l18 43l47 4l-36 31l11 46l-40-24l-40 24l11-46l-36-31l47-4z" />
        <Path path="M760 210l14 33l36 3l-28 24l9 36l-31-19l-31 19l9-36l-28-24l36-3z" />
      </Group>
    );
  }
  if (event === "pet") {
    return (
      <Group opacity={opacity} color="#a30d39">
        <Path path="M220 310C170 255 90 330 220 430C350 330 270 255 220 310Z" />
        <Path path="M785 365C750 325 690 380 785 455C880 380 820 325 785 365Z" opacity={0.75} />
      </Group>
    );
  }
  if (activity === "success" || event === "tripleTap") {
    return (
      <Group opacity={opacity} color="#d9a62e">
        <Circle cx={170} cy={370} r={24} />
        <Circle cx={850} cy={420} r={20} />
        <Circle cx={205} cy={620} r={15} />
        <Circle cx={835} cy={650} r={14} />
      </Group>
    );
  }
  return null;
}
