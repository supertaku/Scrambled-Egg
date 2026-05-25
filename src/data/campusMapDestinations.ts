export const CAMPUS_MAP_CANVAS = {
  height: 1617,
  width: 973
} as const;

export interface CampusMapRegion {
  borderRadius: number;
  height: number;
  id: string;
  left: number;
  top: number;
  width: number;
}

export interface CampusMapLabelPosition {
  left: number;
  top: number;
}

export type CampusMapDestinationType = "building" | "landmark" | "internal";

export interface CampusMapShortcut {
  label: string;
  query: string | null;
  route: "/canteen" | "/library";
}

export interface CampusMapDestination {
  aliases: readonly string[];
  displayName: string;
  id: string;
  label: CampusMapLabelPosition;
  orientation: string;
  permanentLabel: boolean;
  regionId: string;
  shortLabel: string;
  shortcut: CampusMapShortcut | null;
  type: CampusMapDestinationType;
}

const INSIDE_ADMIN =
  "This office is inside the Admin Building. Once there, please check the room entrance signs.";

export const campusMapRegions: readonly CampusMapRegion[] = [
  { id: "main-entrance", left: 78, top: 93, width: 14, height: 7, borderRadius: 10 },
  { id: "admin-building", left: 39, top: 80, width: 27, height: 9, borderRadius: 8 },
  { id: "it-building", left: 15, top: 80, width: 20, height: 9, borderRadius: 5 },
  { id: "tambayan", left: 2, top: 71, width: 10, height: 15, borderRadius: 6 },
  { id: "italian-building", left: 2, top: 35, width: 12, height: 30, borderRadius: 5 },
  { id: "civil-mechanical-building", left: 20, top: 35, width: 15, height: 40, borderRadius: 5 },
  { id: "open-court", left: 40, top: 62, width: 23, height: 14, borderRadius: 4 },
  { id: "multipurpose-hall", left: 39, top: 34, width: 23, height: 10, borderRadius: 7 },
  { id: "canteen", left: 39, top: 44, width: 23, height: 5, borderRadius: 5 },
  { id: "library", left: 44, top: 17, width: 20, height: 11, borderRadius: 6 },
  { id: "dormitory", left: 38, top: 3, width: 25, height: 13, borderRadius: 6 },
  { id: "gymnasium", left: 77, top: 3, width: 15, height: 19, borderRadius: 5 },
  { id: "basic-arts-sciences", left: 68, top: 48, width: 18, height: 29, borderRadius: 7 },
  { id: "comfort-room", left: 93, top: 53, width: 6, height: 8, borderRadius: 4 }
] as const;

export const campusMapDestinations: readonly CampusMapDestination[] = [
  {
    id: "main-entrance",
    displayName: "Main Entrance",
    shortLabel: "Entrance",
    aliases: ["gate", "main gate", "entrance"],
    label: { left: 76, top: 94 },
    regionId: "main-entrance",
    orientation: "Southeast edge of the campus map, southeast of the Admin Building.",
    permanentLabel: true,
    shortcut: null,
    type: "landmark"
  },
  {
    id: "admin-building",
    displayName: "Admin Building",
    shortLabel: "Admin",
    aliases: ["administration", "admin", "admin building phase 2"],
    label: { left: 42, top: 82 },
    regionId: "admin-building",
    orientation: "Immediately northwest of the Main Entrance and south of the Open Court.",
    permanentLabel: true,
    shortcut: { label: "View office help", query: "Admin Building", route: "/library" },
    type: "building"
  },
  {
    id: "it-building",
    displayName: "I.T. Building",
    shortLabel: "I.T.",
    aliases: ["it", "it building", "information technology building"],
    label: { left: 16, top: 83 },
    regionId: "it-building",
    orientation: "West of the Admin Building and east of the Tambayan.",
    permanentLabel: false,
    shortcut: { label: "View room directory", query: "I.T. Building", route: "/library" },
    type: "building"
  },
  {
    id: "tambayan",
    displayName: "Tambayan",
    shortLabel: "Tambayan",
    aliases: ["hangout"],
    label: { left: 2, top: 78 },
    regionId: "tambayan",
    orientation: "West of the I.T. Building along the southwest side of campus.",
    permanentLabel: false,
    shortcut: null,
    type: "landmark"
  },
  {
    id: "italian-building",
    displayName: "Italian Building",
    shortLabel: "Italian",
    aliases: ["italian"],
    label: { left: 2, top: 48 },
    regionId: "italian-building",
    orientation: "In the lower-left or southwest campus area, west of the Admin Building.",
    permanentLabel: false,
    shortcut: null,
    type: "building"
  },
  {
    id: "civil-mechanical-building",
    displayName: "Civil-Mechanical Building",
    shortLabel: "Civil-Mechanical",
    aliases: ["civil mechanical", "civil", "mechanical", "cm building"],
    label: { left: 20, top: 54 },
    regionId: "civil-mechanical-building",
    orientation: "West of the Open Court.",
    permanentLabel: false,
    shortcut: null,
    type: "building"
  },
  {
    id: "open-court",
    displayName: "Open Court",
    shortLabel: "Open Court",
    aliases: ["court", "basketball court"],
    label: { left: 43, top: 68 },
    regionId: "open-court",
    orientation: "Central campus landmark, north of the Admin Building.",
    permanentLabel: true,
    shortcut: null,
    type: "landmark"
  },
  {
    id: "multipurpose-hall",
    displayName: "Multipurpose Hall",
    shortLabel: "Hall",
    aliases: ["multi purpose hall", "mp hall"],
    label: { left: 41, top: 41 },
    regionId: "multipurpose-hall",
    orientation: "North of the Open Court and connected to the Canteen area.",
    permanentLabel: false,
    shortcut: null,
    type: "building"
  },
  {
    id: "canteen",
    displayName: "Canteen",
    shortLabel: "Canteen",
    aliases: ["cafeteria", "food"],
    label: { left: 42, top: 45 },
    regionId: "canteen",
    orientation: "North of the Multipurpose Hall in the central compound, south of the Library.",
    permanentLabel: true,
    shortcut: { label: "View food options", query: null, route: "/canteen" },
    type: "building"
  },
  {
    id: "library",
    displayName: "Library",
    shortLabel: "Library",
    aliases: ["books"],
    label: { left: 46, top: 23 },
    regionId: "library",
    orientation: "Across the road north of the Multipurpose Hall and Canteen compound, south of the Dormitory.",
    permanentLabel: true,
    shortcut: null,
    type: "building"
  },
  {
    id: "dormitory",
    displayName: "Dormitory",
    shortLabel: "Dormitory",
    aliases: ["dorm", "residence"],
    label: { left: 41, top: 9 },
    regionId: "dormitory",
    orientation: "North of the Library in the upper campus area.",
    permanentLabel: false,
    shortcut: null,
    type: "building"
  },
  {
    id: "gymnasium",
    displayName: "Gymnasium",
    shortLabel: "Gym",
    aliases: ["gym", "tup gymnasium"],
    label: { left: 79, top: 12 },
    regionId: "gymnasium",
    orientation: "In the northeast or upper-right campus area, east of the Library and Dormitory.",
    permanentLabel: true,
    shortcut: null,
    type: "building"
  },
  {
    id: "basic-arts-sciences",
    displayName: "Basic Arts and Sciences Building",
    shortLabel: "BAS",
    aliases: ["bas", "basic arts", "basic sciences", "basic arts and sciences"],
    label: { left: 69, top: 59 },
    regionId: "basic-arts-sciences",
    orientation: "East of the Open Court in the right-side building compound.",
    permanentLabel: false,
    shortcut: null,
    type: "building"
  },
  {
    id: "comfort-room",
    displayName: "Comfort Room",
    shortLabel: "CR",
    aliases: ["cr", "restroom", "toilet"],
    label: { left: 89, top: 56 },
    regionId: "comfort-room",
    orientation: "At the far right or east edge of the campus map.",
    permanentLabel: false,
    shortcut: null,
    type: "building"
  },
  {
    id: "osa",
    displayName: "Office of Student Affairs (OSA)",
    shortLabel: "OSA",
    aliases: ["osa", "office of student affairs", "student affairs"],
    label: { left: 42, top: 82 },
    regionId: "admin-building",
    orientation: INSIDE_ADMIN,
    permanentLabel: false,
    shortcut: { label: "View office help", query: "Office of the Student Affairs", route: "/library" },
    type: "internal"
  },
  {
    id: "guidance",
    displayName: "Guidance Office",
    shortLabel: "Guidance",
    aliases: ["guidance", "guidance office", "counselling", "counseling"],
    label: { left: 42, top: 82 },
    regionId: "admin-building",
    orientation: INSIDE_ADMIN,
    permanentLabel: false,
    shortcut: { label: "View office help", query: "Guidance", route: "/library" },
    type: "internal"
  },
  {
    id: "clinic",
    displayName: "Clinic / Medical Office",
    shortLabel: "Clinic",
    aliases: ["clinic", "medical office", "medical", "tup-taguig clinic"],
    label: { left: 42, top: 82 },
    regionId: "admin-building",
    orientation: INSIDE_ADMIN,
    permanentLabel: false,
    shortcut: { label: "View office help", query: "Clinic", route: "/library" },
    type: "internal"
  },
  {
    id: "dental-office",
    displayName: "Dental Office",
    shortLabel: "Dental",
    aliases: ["dental", "dentist", "dental clinic"],
    label: { left: 42, top: 82 },
    regionId: "admin-building",
    orientation: INSIDE_ADMIN,
    permanentLabel: false,
    shortcut: { label: "View office help", query: "Dental", route: "/library" },
    type: "internal"
  },
  {
    id: "information",
    displayName: "Information",
    shortLabel: "Information",
    aliases: ["information desk", "information"],
    label: { left: 42, top: 82 },
    regionId: "admin-building",
    orientation: INSIDE_ADMIN,
    permanentLabel: false,
    shortcut: null,
    type: "internal"
  }
] as const;

const regionMap = new Map(campusMapRegions.map((region) => [region.id, region]));
const destinationMap = new Map(campusMapDestinations.map((destination) => [destination.id, destination]));

function normalizeTerm(term: string): string {
  return term.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function destinationTerms(destination: CampusMapDestination): string[] {
  return [destination.displayName, destination.shortLabel, ...destination.aliases].map(normalizeTerm);
}

export function getCampusMapDestination(id: string): CampusMapDestination | undefined {
  return destinationMap.get(id);
}

export function getCampusMapRegion(destination: CampusMapDestination): CampusMapRegion {
  const region = regionMap.get(destination.regionId);
  if (!region) {
    throw new Error(`Missing campus map region: ${destination.regionId}`);
  }
  return region;
}

export function getCampusMapTapDestinations(): CampusMapDestination[] {
  return campusMapDestinations.filter((destination) => destination.type !== "internal");
}

export function searchCampusMapDestinations(query: string): CampusMapDestination[] {
  const normalizedQuery = normalizeTerm(query);
  if (!normalizedQuery) return [];

  return campusMapDestinations
    .map((destination, index) => {
      const terms = destinationTerms(destination);
      const exactMatch = terms.some((term) => term === normalizedQuery);
      const prefixMatch = terms.some((term) => term.startsWith(normalizedQuery));
      const includesMatch = terms.some((term) => term.includes(normalizedQuery));
      if (!includesMatch) return null;
      return {
        destination,
        index,
        score: exactMatch ? 0 : prefixMatch ? 1 : 2
      };
    })
    .filter((match): match is { destination: CampusMapDestination; index: number; score: number } => match !== null)
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .map((match) => match.destination);
}
