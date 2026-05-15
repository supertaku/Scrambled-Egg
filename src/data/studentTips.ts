/**
 * @file studentTips.ts
 * @description Student tip entries displayed on the Tips screen.
 *
 * HOW TO REPLACE WITH REAL DATA
 * ─────────────────────────────
 * 1. Keep the `StudentTip` interface — only add optional fields if needed.
 * 2. Replace the `studentTips` array below with data fetched from your API
 *    or a JSON file, following the same shape.
 * 3. If tips are dynamic (fetched at runtime), change the export to an
 *    async function and update the Tips screen to await it.
 * 4. The `CATEGORY_COLORS` map in `tips.tsx` drives the accent color for
 *    each `category` string — add a new key there for any new category.
 *
 * REQUIRED FIELDS
 *   id        – unique string (slug or UUID)
 *   author    – display label e.g. "Senior student", "Class rep"
 *   category  – must match a key in CATEGORY_COLORS or will fall back to maroon
 *   content   – the tip text shown on the card
 *
 * OPTIONAL FIELDS
 *   verifiedBy  – name/title of person who verified the tip
 *   sourceUrl   – URL to an official source
 *   createdAt   – ISO date string for sorting
 */

export interface StudentTip {
  id: string;
  author: string;
  category: string;
  content: string;
  verifiedBy?: string;
  sourceUrl?: string;
  createdAt?: string;
}

export const studentTips: StudentTip[] = [
  {
    id: "student-tip-1",
    author: "Senior student",
    category: "Printing",
    content:
      "Before printing a thick handout, ask around the photocopy stalls near the canteen first. Some students check the left-side canteen area because prices can be friendlier there."
  },
  {
    id: "student-tip-2",
    author: "Class rep",
    category: "Documents",
    content:
      "Keep screenshots of your COR, receipts, and student number in one phone album. It saves time when an office asks for proof and your files are buried in chat."
  },
  {
    id: "student-tip-3",
    author: "Irregular student",
    category: "Enrollment",
    content:
      "When asking about subjects, write your program, year level, section, subject code, and reason first. Advisers can help faster when they do not need to guess your context."
  },
  {
    id: "student-tip-4",
    author: "Commuter student",
    category: "Routine",
    content:
      "Bring a pen even if you think everything is online. Forms, logbooks, and quick signatures still appear when you least expect them."
  },
  {
    id: "student-tip-5",
    author: "Lab buddy",
    category: "Study",
    content:
      "After every lab, take a photo of your output and write one line about what worked. It helps when you need to defend or repeat the steps later."
  },
  {
    id: "student-tip-6",
    author: "Graduating student",
    category: "Clearance",
    content:
      "Do not wait for everyone to rush clearance. Ask early, list each missing item, then finish one requirement per campus visit."
  },
  {
    id: "student-tip-7",
    author: "Budget student",
    category: "Food",
    content:
      "If you are trying to save, compare canteen snacks before buying a full meal. Some days a rice meal is worth it, other days a drink plus bread is enough between classes."
  },
  {
    id: "student-tip-8",
    author: "Scholarship applicant",
    category: "Files",
    content:
      "Name files like LASTNAME_COR_2026.pdf before sending. When a requirement gets returned, you can find and resend the right file quickly."
  },
  {
    id: "student-tip-9",
    author: "Working student",
    category: "Time",
    content:
      "Put office errands beside class breaks in your weekly checklist. It is easier to visit an office after a nearby class than to make a separate trip."
  },
  {
    id: "student-tip-10",
    author: "Peer tutor",
    category: "Review",
    content:
      "Practice solving first, then reread the lesson. If you can explain the step to a classmate without looking, you probably understand it."
  },
  {
    id: "student-tip-11",
    author: "Group leader",
    category: "Teamwork",
    content:
      "For group tasks, send the owner, deadline, and exact output format in one message. Screenshots of agreements prevent confusion later."
  },
  {
    id: "student-tip-12",
    author: "Freshie",
    category: "Campus Life",
    content:
      "If you are lost, ask a guard, class officer, or nearby office politely. Students usually know shortcuts, but offices know the official direction."
  }
];
