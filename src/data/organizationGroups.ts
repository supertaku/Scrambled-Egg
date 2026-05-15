/**
 * @file organizationGroups.ts
 * @description List of offices and academic groups used for routing campus concerns.
 *
 * HOW TO REPLACE WITH REAL DATA
 * ─────────────────────────────
 * 1. Keep the `OrgGroup` interface to ensure compatibility with the Organization screen.
 * 2. Replace the `organizationGroups` array with verified campus office data.
 * 3. `nodes` array defines the hierarchy levels shown in the preview list.
 *
 * REQUIRED FIELDS
 *   key         – unique slug for the group
 *   name        – full name of the office/department
 *   description – short summary of what they handle
 *   nodes       – array of strings representing the typical routing path (top-down)
 */

export interface OrgGroup {
  key: string;
  name: string;
  description: string;
  nodes: string[];
}

export const organizationGroups: OrgGroup[] = [
  {
    key: "campus-director",
    name: "Campus Director",
    description: "Top campus leadership and final escalation path for campus-wide concerns.",
    nodes: ["Campus Director", "Executive Support Staff", "Campus-wide Coordination"]
  },
  {
    key: "academic-affairs",
    name: "Assistant Director for Academic Affairs",
    description: "Academic coordination, faculty concerns, and instruction-related routing.",
    nodes: ["Assistant Director for Academic Affairs", "Program and College Coordination", "Academic Records Routing"]
  },
  {
    key: "engineering",
    name: "College of Engineering",
    description: "Academic unit for engineering programs, advising, and college-level processing.",
    nodes: ["College Dean or Officer-in-Charge", "Department Chairs", "Program Advisers", "Students"]
  },
  {
    key: "engineering-technology",
    name: "College of Engineering Technology",
    description: "Academic unit for technology programs, lab coordination, and advising.",
    nodes: ["College Dean or Officer-in-Charge", "Program Chairs", "Laboratory Coordinators", "Students"]
  },
  {
    key: "education-sciences",
    name: "College of Education and Sciences",
    description: "Academic unit for education and sciences programs, advising, and student support.",
    nodes: ["College Dean or Officer-in-Charge", "Program Chairs", "Faculty Advisers", "Students"]
  },
  {
    key: "registrar",
    name: "Registrar",
    description: "Handles enrollment records, document requests, COR concerns, and academic records routing.",
    nodes: ["Registrar Head", "Records Verification", "Document Releasing", "Students"]
  },
  {
    key: "accounting",
    name: "Accounting",
    description: "Handles payment validation, financial clearance, and accounting-related student concerns.",
    nodes: ["Accounting Head", "Assessment and Validation", "Clearance Checking", "Students"]
  },
  {
    key: "clinic",
    name: "Clinic",
    description: "Handles first aid, clinic assistance, health records, and campus medical support.",
    nodes: ["Clinic Personnel", "Medical Assistance Desk", "Emergency Referral", "Students"]
  },
  {
    key: "guidance",
    name: "Guidance",
    description: "Handles counseling, student wellness support, and guidance-related referrals.",
    nodes: ["Guidance Counselor", "Counseling Intake", "Student Follow-up", "Students"]
  },
  {
    key: "student-affairs",
    name: "Office of Student Affairs",
    description: "Handles student conduct, activities, organizations, and student support routing.",
    nodes: ["OSA Head", "Student Activities", "Conduct and Discipline", "Students"]
  },
  {
    key: "library",
    name: "Library",
    description: "Handles library services, resource access, borrowing guidance, and research support.",
    nodes: ["Library Head", "Circulation Desk", "Reference Support", "Students"]
  }
];
