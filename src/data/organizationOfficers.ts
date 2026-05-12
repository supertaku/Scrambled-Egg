export interface OrganizationOfficer {
  id: string;
  organization: string;
  role: string;
  name: string;
  yearLevel: string;
  contactNote: string;
}

export const ORGANIZATION_OFFICERS_MOCK_NOTICE =
  "Placeholder data for testing only. Replace this with verified officer data from Haki's admin.";

export const mockOrganizationOfficers: OrganizationOfficer[] = [
  {
    id: "mock-usc-president",
    organization: "University Student Council",
    role: "President",
    name: "Ari Reyes",
    yearLevel: "4th year",
    contactNote: "Ask through the official student council channel once verified."
  },
  {
    id: "mock-usc-vp",
    organization: "University Student Council",
    role: "Vice President",
    name: "Mika Santos",
    yearLevel: "3rd year",
    contactNote: "Route council concerns through the verified page or adviser."
  },
  {
    id: "mock-usc-secretary",
    organization: "University Student Council",
    role: "Secretary",
    name: "Theo Cruz",
    yearLevel: "3rd year",
    contactNote: "Prepare your concern in writing before asking for routing help."
  },
  {
    id: "mock-engineering-president",
    organization: "Engineering Student Organization",
    role: "President",
    name: "Jamie Dela Cruz",
    yearLevel: "4th year",
    contactNote: "Use the official org channel for engineering event questions."
  },
  {
    id: "mock-engineering-treasurer",
    organization: "Engineering Student Organization",
    role: "Treasurer",
    name: "Nico Garcia",
    yearLevel: "2nd year",
    contactNote: "Verify any payment or fee concern with the adviser before acting."
  },
  {
    id: "mock-tech-president",
    organization: "Technology Student League",
    role: "President",
    name: "Sam Villanueva",
    yearLevel: "4th year",
    contactNote: "Ask through the verified org channel once real data is added."
  },
  {
    id: "mock-tech-auditor",
    organization: "Technology Student League",
    role: "Auditor",
    name: "Rae Mendoza",
    yearLevel: "3rd year",
    contactNote: "Use this mock entry only for UI and chat flow testing."
  }
];
