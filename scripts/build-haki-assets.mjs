import { access, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const sourceDir = join(process.cwd(), "assets/source/mascot/haki-v3/layers");
const outputDir = join(process.cwd(), "assets/images/mascot/haki-v3");
const identitySheetPath = join(process.cwd(), "assets/source/mascot/haki-v3/haki-v3-identity-sheet.png");

const palette = {
  charcoal: "#30343b",
  dark: "#1d2026",
  feather: "#70757c",
  featherLight: "#a7aaad",
  cheek: "#d7d6d0",
  white: "#f7f4ec",
  maroon: "#7a0019",
  gold: "#d9a62e",
  amber: "#d89212",
  orange: "#d77812"
};

function documentSvg(width, height, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="feather" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${palette.featherLight}"/><stop offset="1" stop-color="${palette.charcoal}"/></linearGradient>
    <linearGradient id="darkFeather" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${palette.feather}"/><stop offset="1" stop-color="${palette.dark}"/></linearGradient>
    <linearGradient id="amber" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ffc331"/><stop offset="1" stop-color="#b96300"/></linearGradient>
    <linearGradient id="shirt" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ffffff"/><stop offset="1" stop-color="#ddd9cf"/></linearGradient>
  </defs>${body}</svg>`;
}

const layers = {
  body: [420, 520, `<ellipse cx="210" cy="254" rx="181" ry="231" fill="url(#feather)" stroke="${palette.dark}" stroke-width="16"/>
    <path d="M54 171Q210 96 366 171L348 364Q210 423 72 364Z" fill="url(#shirt)" stroke="${palette.dark}" stroke-width="14"/>
    <path d="M78 175L210 247L342 175" fill="none" stroke="${palette.maroon}" stroke-width="28"/>
    <path d="M86 177L210 237L334 177" fill="none" stroke="${palette.gold}" stroke-width="9"/>
    <path d="M80 396q34 54 65 0q34 62 67 0q34 58 66 0q34 53 62 0" fill="none" stroke="#575c63" stroke-width="24" stroke-linecap="round"/>`],
  head: [600, 540, `<ellipse cx="300" cy="270" rx="278" ry="247" fill="url(#feather)" stroke="${palette.dark}" stroke-width="18"/>
    <path d="M50 329Q105 278 166 302Q118 342 67 362Q130 350 188 368Q126 404 76 404" fill="${palette.cheek}" opacity=".94"/>
    <path d="M550 329Q495 278 434 302Q482 342 533 362Q470 350 412 368Q474 404 524 404" fill="${palette.cheek}" opacity=".94"/>
    <ellipse cx="300" cy="397" rx="126" ry="72" fill="${palette.cheek}" opacity=".7"/>`],
  cheek: [190, 145, `<path d="M8 70Q65 8 170 20Q127 52 183 62Q125 80 173 102Q100 104 62 136Q57 108 8 70Z" fill="${palette.cheek}" stroke="#777a7d" stroke-width="8"/>`],
  crest: [210, 170, `<path d="M100 159Q39 100 31 25Q92 43 111 111Q94 47 128 8Q160 69 138 126Q158 68 194 48Q190 125 127 163Z" fill="url(#darkFeather)" stroke="${palette.dark}" stroke-width="10" stroke-linejoin="round"/>`],
  eyeWhite: [150, 190, `<ellipse cx="75" cy="95" rx="63" ry="84" fill="#fffdf7" stroke="${palette.dark}" stroke-width="12"/>`],
  iris: [96, 132, `<ellipse cx="48" cy="66" rx="42" ry="59" fill="url(#amber)" stroke="#6a3500" stroke-width="8"/>`],
  pupil: [54, 94, `<ellipse cx="27" cy="47" rx="24" ry="43" fill="#090a0c"/>`],
  highlight: [34, 44, `<ellipse cx="17" cy="22" rx="14" ry="19" fill="#fff"/>`],
  eyelid: [164, 104, `<path d="M8 91Q82 2 156 91Q83 61 8 91Z" fill="url(#feather)" stroke="${palette.dark}" stroke-width="9" stroke-linejoin="round"/>`],
  beakUpper: [150, 115, `<path d="M12 61Q76 5 139 58Q111 91 74 106Q37 91 12 61Z" fill="url(#darkFeather)" stroke="${palette.dark}" stroke-width="10"/>`],
  beakLower: [118, 78, `<path d="M10 13Q58 54 108 13Q93 70 58 71Q23 68 10 13Z" fill="#24272c" stroke="${palette.dark}" stroke-width="8"/>`],
  tongue: [78, 48, `<path d="M9 8Q39 27 69 8Q61 43 39 43Q17 43 9 8Z" fill="#c55756" stroke="#6e2b31" stroke-width="5"/>`],
  wingUpper: [180, 250, `<path d="M159 17Q52 26 22 111Q4 162 53 231Q106 181 119 129Q132 76 159 17Z" fill="url(#feather)" stroke="${palette.dark}" stroke-width="13"/>
    <path d="M50 86Q104 54 139 49M39 137Q90 102 123 92M43 184Q81 150 108 139" fill="none" stroke="#9b9ea2" stroke-width="12" stroke-linecap="round"/>`],
  wingFore: [170, 250, `<path d="M142 12Q68 39 35 95Q4 148 30 235Q92 188 120 127Q143 77 142 12Z" fill="url(#darkFeather)" stroke="${palette.dark}" stroke-width="13"/>
    <path d="M44 105Q89 76 125 61M36 157Q80 127 112 105M42 203Q74 176 96 151" fill="none" stroke="#6e7279" stroke-width="11" stroke-linecap="round"/>`],
  wingPrimary: [155, 270, `<path d="M123 9Q63 44 38 99Q8 162 25 256Q67 222 82 171Q86 224 113 245Q133 184 116 135Q146 174 149 210Q169 129 123 9Z" fill="url(#darkFeather)" stroke="${palette.dark}" stroke-width="12" stroke-linejoin="round"/>`],
  thigh: [120, 140, `<ellipse cx="60" cy="70" rx="52" ry="61" fill="url(#feather)" stroke="${palette.dark}" stroke-width="10"/>`],
  leg: [70, 155, `<path d="M22 8Q34 78 17 141M48 8Q39 79 54 141" fill="none" stroke="${palette.orange}" stroke-width="22" stroke-linecap="round"/>
    <path d="M18 43h36M17 75h37M16 108h39" stroke="#a84d08" stroke-width="6"/>`],
  foot: [190, 100, `<path d="M88 17Q73 61 25 82M92 22Q96 65 91 87M99 22Q128 58 161 78M102 21Q154 38 179 59" fill="none" stroke="${palette.orange}" stroke-width="22" stroke-linecap="round"/>
    <path d="M18 86l18-13M83 92l16-9M154 84l16-13M173 64l12-12" stroke="${palette.dark}" stroke-width="10" stroke-linecap="round"/>`],
  tailFeather: [120, 290, `<path d="M60 8Q8 79 18 189Q23 248 60 281Q99 246 103 188Q110 78 60 8Z" fill="url(#darkFeather)" stroke="${palette.dark}" stroke-width="12"/>
    <path d="M60 35V244" stroke="#73777e" stroke-width="8" stroke-linecap="round"/>`],
  explorerHat: [500, 255, `<ellipse cx="250" cy="200" rx="228" ry="43" fill="${palette.maroon}" stroke="${palette.dark}" stroke-width="14"/>
    <path d="M96 188Q104 29 250 20Q397 28 405 188Z" fill="#8f2038" stroke="${palette.dark}" stroke-width="14"/>
    <path d="M100 143Q252 181 401 143" fill="none" stroke="${palette.gold}" stroke-width="22"/>`],
  map: [300, 250, `<path d="M17 35L101 10L197 38L283 14V219L197 241L101 214L17 239Z" fill="#e8c985" stroke="#6f5128" stroke-width="10"/>
    <path d="M101 10v204M197 38v203M49 76q56 45 92 16q50-40 108 52M61 176q78-33 151 8" fill="none" stroke="#9c7040" stroke-width="8"/>`],
  magnifier: [210, 300, `<circle cx="92" cy="92" r="73" fill="#bfe7e1" fill-opacity=".55" stroke="${palette.gold}" stroke-width="18"/>
    <path d="M145 150L196 284" stroke="#3d2d24" stroke-width="31" stroke-linecap="round"/>`],
  satchel: [260, 270, `<path d="M42 79Q130 23 218 79L238 236Q129 273 22 236Z" fill="#8b3b2f" stroke="#432018" stroke-width="12"/>
    <path d="M44 88Q130 164 216 88M85 45Q130 0 175 45" fill="none" stroke="${palette.gold}" stroke-width="12"/>
    <rect x="105" y="132" width="50" height="38" rx="8" fill="${palette.gold}"/>`],
  book: [310, 225, `<path d="M15 30Q89 5 153 47V213Q83 177 15 203ZM295 30Q221 5 157 47V213Q227 177 295 203Z" fill="#f9f1d4" stroke="${palette.maroon}" stroke-width="11"/>
    <path d="M154 48v164" stroke="${palette.gold}" stroke-width="8"/>`],
  document: [220, 290, `<rect x="10" y="10" width="200" height="270" rx="18" fill="#fffdf7" stroke="${palette.maroon}" stroke-width="11"/>
    <path d="M45 72h132M45 116h132M45 160h102M45 204h120" stroke="#9a9ba0" stroke-width="12" stroke-linecap="round"/>`],
  pointer: [70, 330, `<path d="M35 315L35 30" stroke="#704825" stroke-width="18" stroke-linecap="round"/><circle cx="35" cy="24" r="20" fill="${palette.gold}"/>`],
  package: [250, 230, `<path d="M18 66L125 13L232 66V202L125 220L18 202Z" fill="#d9a62e" stroke="#6d4b16" stroke-width="12"/>
    <path d="M18 66L125 119L232 66M125 119v101M76 38l108 54" fill="none" stroke="#fff1b7" stroke-width="10"/>`],
  lens: [250, 250, `<circle cx="106" cy="105" r="84" fill="#c5eeed" fill-opacity=".35" stroke="${palette.maroon}" stroke-width="16"/><path d="M169 170l66 66" stroke="${palette.maroon}" stroke-width="27" stroke-linecap="round"/>`],
  celebration: [230, 230, `<path d="M115 8l29 69l75 7l-57 49l17 74l-64-39l-64 39l17-74L11 84l75-7Z" fill="${palette.gold}" stroke="${palette.maroon}" stroke-width="12"/>`],
  feather: [130, 250, `<path d="M113 14Q29 56 18 166Q12 219 47 240Q91 214 109 160Q128 95 113 14Z" fill="url(#feather)" stroke="${palette.dark}" stroke-width="10"/>
    <path d="M103 34Q71 130 34 225M77 94L36 84M63 132L23 128M55 164L23 167M84 75l28 20M72 113l35 17M61 151l31 18" fill="none" stroke="#d2d2cf" stroke-width="7" stroke-linecap="round"/>`]
};

async function writeLayer(name, [width, height, body]) {
  const svg = documentSvg(width, height, body);
  await writeFile(join(sourceDir, `${name}.svg`), svg);
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true }).toFile(join(outputDir, `${name}.png`));
}

async function chromaKeyFrontReference() {
  await access(identitySheetPath);
  const { data, info } = await sharp(identitySheetPath)
    .extract({ left: 35, top: 8, width: 355, height: 585 })
    .resize(820, 1350, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index] ?? 0;
    const green = data[index + 1] ?? 0;
    const blue = data[index + 2] ?? 0;
    const keyStrength = green - Math.max(red, blue);
    if (green > 90 && keyStrength > 8) {
      const alpha = Math.max(0, Math.min(255, 255 - (keyStrength - 8) * 8));
      data[index + 3] = alpha;
      if (alpha > 0) {
        data[index + 1] = Math.max(red, blue);
      }
    }
  }

  const cutout = sharp(data, { raw: info });
  const cutoutBuffer = await cutout.png({ compressionLevel: 9 }).toBuffer();
  await writeFile(join(sourceDir, "haki-front-cutout.png"), cutoutBuffer);
  return cutoutBuffer;
}

async function extractRigPart(source, name, region, maskSvg) {
  let part = sharp(source).extract(region);
  if (maskSvg) {
    part = part.composite([{ input: Buffer.from(maskSvg), blend: "dest-in" }]);
  }
  await part.png({ compressionLevel: 9 }).toFile(join(outputDir, `${name}.png`));
}

async function buildGeneratedRig() {
  const front = await chromaKeyFrontReference();
  const ellipseMask = (width, height, cx, cy, rx, ry, extra = "") => documentSvg(width, height, `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff"/>${extra}`);

  await extractRigPart(
    front,
    "head",
    { left: 10, top: 0, width: 800, height: 720 },
    documentSvg(800, 720, `<mask id="headMask"><rect width="800" height="720" fill="#000"/><ellipse cx="400" cy="348" rx="385" ry="342" fill="#fff"/><rect x="300" y="0" width="210" height="180" rx="70" fill="#fff"/><ellipse cx="289" cy="401" rx="87" ry="115" fill="#000"/><ellipse cx="520" cy="401" rx="87" ry="115" fill="#000"/></mask><rect width="800" height="720" fill="#fff" mask="url(#headMask)"/>`)
  );
  await extractRigPart(
    front,
    "body",
    { left: 135, top: 625, width: 550, height: 535 },
    ellipseMask(550, 535, 275, 260, 258, 260)
  );

  const leftWing = { left: 2, top: 650, width: 235, height: 475 };
  const rightWing = { left: 583, top: 650, width: 235, height: 475 };
  await extractRigPart(front, "wingLeftUpper", { ...leftWing, height: 190 }, null);
  await extractRigPart(front, "wingLeftFore", { left: leftWing.left, top: leftWing.top + 145, width: leftWing.width, height: 205 }, null);
  await extractRigPart(front, "wingLeftPrimary", { left: leftWing.left, top: leftWing.top + 300, width: leftWing.width, height: 175 }, null);
  await extractRigPart(front, "wingRightUpper", { ...rightWing, height: 190 }, null);
  await extractRigPart(front, "wingRightFore", { left: rightWing.left, top: rightWing.top + 145, width: rightWing.width, height: 205 }, null);
  await extractRigPart(front, "wingRightPrimary", { left: rightWing.left, top: rightWing.top + 300, width: rightWing.width, height: 175 }, null);
  await extractRigPart(front, "legLeft", { left: 180, top: 1065, width: 220, height: 285 }, null);
  await extractRigPart(front, "legRight", { left: 420, top: 1065, width: 220, height: 285 }, null);
  const eyeMask = documentSvg(174, 230, `<mask id="eyeMask"><rect width="174" height="230" fill="#fff"/><ellipse cx="87" cy="120" rx="46" ry="61" fill="#000"/></mask><rect width="174" height="230" fill="#fff" mask="url(#eyeMask)"/>`);
  await extractRigPart(front, "eyeLeftBase", { left: 212, top: 286, width: 174, height: 230 }, eyeMask);
  await extractRigPart(front, "eyeRightBase", { left: 443, top: 286, width: 174, height: 230 }, eyeMask);

  const staticPath = join(outputDir, "haki-static.png");
  await sharp(front)
    .resize(900, 1380, { fit: "contain" })
    .extend({ top: 78, bottom: 78, left: 62, right: 62, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(1024, 1536, { fit: "contain" })
    .png({ compressionLevel: 9 })
    .toFile(staticPath);
  await sharp(front).extract({ left: 90, top: 45, width: 640, height: 640 }).resize(512, 512).png({ compressionLevel: 9 }).toFile(join(outputDir, "haki-portrait.png"));
  await sharp(front)
    .extract({ left: 90, top: 45, width: 640, height: 640 })
    .resize(760, 760, { fit: "contain" })
    .extend({ top: 132, bottom: 132, left: 132, right: 132, background: palette.maroon })
    .flatten({ background: palette.maroon })
    .resize(1024, 1024)
    .png({ compressionLevel: 9 })
    .toFile(join(process.cwd(), "assets/images/grayhawk.png"));
}

async function buildRigPreview() {
  const placement = async (name, left, top, width, height) => ({
    input: await sharp(join(outputDir, `${name}.png`)).resize(width, height, { fit: "fill" }).toBuffer(),
    left,
    top
  });
  const composites = await Promise.all([
    placement("tailFeather", 408, 1015, 120, 290),
    placement("legLeft", 282, 1155, 220, 285),
    placement("legRight", 522, 1155, 220, 285),
    placement("body", 237, 715, 550, 535),
    placement("wingLeftUpper", 104, 740, 235, 190),
    placement("wingLeftFore", 104, 885, 235, 205),
    placement("wingLeftPrimary", 104, 1040, 235, 175),
    placement("wingRightUpper", 685, 740, 235, 190),
    placement("wingRightFore", 685, 885, 235, 205),
    placement("wingRightPrimary", 685, 1040, 235, 175),
    placement("pupil", 370, 446, 62, 100),
    placement("pupil", 601, 446, 62, 100),
    placement("eyeLeftBase", 314, 376, 174, 230),
    placement("eyeRightBase", 545, 376, 174, 230),
    placement("highlight", 382, 447, 22, 29),
    placement("highlight", 613, 447, 22, 29),
    placement("head", 112, 90, 800, 720)
  ]);
  await sharp({ create: { width: 1024, height: 1536, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(join(sourceDir, "haki-rig-neutral-preview.png"));
}

function fullCharacterSvg() {
  return documentSvg(1024, 1536, `
    <g transform="translate(382 1060) rotate(-8)">${layers.tailFeather[2]}</g>
    <g transform="translate(454 1070)">${layers.tailFeather[2]}</g>
    <g transform="translate(526 1060) rotate(8)">${layers.tailFeather[2]}</g>
    <g transform="translate(302 836)">${layers.body[2]}</g>
    <g transform="translate(218 770) rotate(10)">${layers.wingUpper[2]}</g>
    <g transform="translate(153 880) rotate(15)">${layers.wingFore[2]}</g>
    <g transform="translate(118 1010) rotate(18)">${layers.wingPrimary[2]}</g>
    <g transform="translate(626 770) scale(-1 1) translate(-180 0)">${layers.wingUpper[2]}</g>
    <g transform="translate(735 880) scale(-1 1) translate(-170 0)">${layers.wingFore[2]}</g>
    <g transform="translate(803 1010) scale(-1 1) translate(-155 0)">${layers.wingPrimary[2]}</g>
    <g transform="translate(205 260)">${layers.head[2]}</g>
    <g transform="translate(407 150)">${layers.crest[2]}</g>
    <g transform="translate(322 457)">${layers.eyeWhite[2]}</g>
    <g transform="translate(552 457)">${layers.eyeWhite[2]}</g>
    <g transform="translate(349 488)">${layers.iris[2]}</g>
    <g transform="translate(579 488)">${layers.iris[2]}</g>
    <g transform="translate(370 507)">${layers.pupil[2]}</g>
    <g transform="translate(600 507)">${layers.pupil[2]}</g>
    <g transform="translate(374 505)">${layers.highlight[2]}</g>
    <g transform="translate(604 505)">${layers.highlight[2]}</g>
    <g transform="translate(437 644)">${layers.beakUpper[2]}</g>
    <g transform="translate(453 720)">${layers.beakLower[2]}</g>
    <g transform="translate(350 1280)">${layers.leg[2]}</g>
    <g transform="translate(570 1280)">${layers.leg[2]}</g>
    <g transform="translate(285 1405)">${layers.foot[2]}</g>
    <g transform="translate(505 1405)">${layers.foot[2]}</g>`);
}

async function buildStaticAssets() {
  const staticSvg = fullCharacterSvg();
  const staticPath = join(outputDir, "haki-static.png");
  await writeFile(join(sourceDir, "haki-static.svg"), staticSvg);
  await sharp(Buffer.from(staticSvg)).png({ compressionLevel: 9 }).toFile(staticPath);
  await sharp(staticPath).extract({ left: 205, top: 215, width: 620, height: 620 }).resize(512, 512).png({ compressionLevel: 9 }).toFile(join(outputDir, "haki-portrait.png"));
  await sharp(staticPath).resize(740, 1110, { fit: "contain" }).extend({ top: 0, bottom: 0, left: 142, right: 142, background: palette.maroon }).flatten({ background: palette.maroon }).resize(1024, 1024, { fit: "cover" }).png({ compressionLevel: 9 }).toFile(join(process.cwd(), "assets/images/grayhawk.png"));
}

async function validate() {
  const files = (await readdir(outputDir)).filter((file) => file.endsWith(".png"));
  const required = [...Object.keys(layers).map((name) => `${name}.png`), "haki-static.png", "haki-portrait.png"];
  for (const name of required) {
    if (!files.includes(name)) throw new Error(`Missing Haki asset: ${name}`);
  }

  let total = 0;
  for (const file of files) {
    const path = join(outputDir, file);
    const [metadata, fileStat] = await Promise.all([sharp(path).metadata(), stat(path)]);
    total += fileStat.size;
    if (!metadata.hasAlpha) throw new Error(`${file} must contain alpha`);
    if ((metadata.width ?? 0) > 2048 || (metadata.height ?? 0) > 2048) throw new Error(`${file} exceeds 2048px`);
  }
  if (total > 15 * 1024 * 1024) throw new Error(`Haki runtime artwork exceeds 15 MB: ${total}`);
  console.log(`Built ${files.length} Haki v3 PNGs (${(total / 1024 / 1024).toFixed(2)} MB).`);
}

await mkdir(sourceDir, { recursive: true });
await mkdir(outputDir, { recursive: true });
await Promise.all(Object.entries(layers).map(([name, layer]) => writeLayer(name, layer)));
await buildStaticAssets();
await buildGeneratedRig();
await buildRigPreview();
await validate();
