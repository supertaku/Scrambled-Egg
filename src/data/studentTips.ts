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
  },
  {
    id: "student-tip-13",
    author: "Project teammate",
    category: "Printing",
    content: "Export your document as a PDF and check each page before printing so shifted margins or missing images do not surprise you."
  },
  {
    id: "student-tip-14",
    author: "Thesis buddy",
    category: "Printing",
    content: "Print one sample page first when formatting matters, then correct alignment before producing the full set."
  },
  {
    id: "student-tip-15",
    author: "Class secretary",
    category: "Printing",
    content: "Keep both a color and grayscale-ready version of slides when color is not essential to understanding the output."
  },
  {
    id: "student-tip-16",
    author: "Senior student",
    category: "Printing",
    content: "Ask classmates whether several handouts can be organized together before making separate last-minute print runs."
  },
  {
    id: "student-tip-17",
    author: "Organization member",
    category: "Documents",
    content: "Scan signed documents in good light and confirm that signatures, dates, and page edges are readable before submitting."
  },
  {
    id: "student-tip-18",
    author: "Class rep",
    category: "Documents",
    content: "Keep an untouched original file and a separate submission copy whenever a form must be filled in or annotated."
  },
  {
    id: "student-tip-19",
    author: "Working student",
    category: "Documents",
    content: "Write a short checklist of attachments before sending an email so the main document is not sent alone by mistake."
  },
  {
    id: "student-tip-20",
    author: "Graduate assistant",
    category: "Documents",
    content: "Use clear subject lines that include your concern and identifying course context when contacting an office or instructor."
  },
  {
    id: "student-tip-21",
    author: "Blockmate",
    category: "Enrollment",
    content: "List your target subjects and possible schedule conflicts before asking for help so the conversation stays focused."
  },
  {
    id: "student-tip-22",
    author: "Returning student",
    category: "Enrollment",
    content: "Review names, subject codes, and section details on any saved record before leaving the transaction flow."
  },
  {
    id: "student-tip-23",
    author: "Student adviser peer",
    category: "Enrollment",
    content: "Keep a dated note of advice you received and the next step you were asked to complete."
  },
  {
    id: "student-tip-24",
    author: "Irregular student",
    category: "Enrollment",
    content: "When an enrollment question changes, bring the earlier context again rather than assuming the next helper saw it."
  },
  {
    id: "student-tip-25",
    author: "Commuter student",
    category: "Routine",
    content: "Pack essentials the night before a long campus day: ID, charger, water, pen, and the files needed for errands."
  },
  {
    id: "student-tip-26",
    author: "Morning classmate",
    category: "Routine",
    content: "Set one reminder for departure and another for the item you must bring, not only the time of class."
  },
  {
    id: "student-tip-27",
    author: "Lab student",
    category: "Routine",
    content: "Before leaving a room, check your desk, charging outlet, and shared equipment area for belongings."
  },
  {
    id: "student-tip-28",
    author: "Campus volunteer",
    category: "Routine",
    content: "Keep a small digital note for questions to ask on your next campus visit instead of relying on memory."
  },
  {
    id: "student-tip-29",
    author: "Peer tutor",
    category: "Study",
    content: "Turn a long topic into three questions you should be able to answer without opening your notes."
  },
  {
    id: "student-tip-30",
    author: "Lab buddy",
    category: "Study",
    content: "Record failed attempts along with successful ones; knowing why a method failed makes review more useful."
  },
  {
    id: "student-tip-31",
    author: "Study group member",
    category: "Study",
    content: "Agree on one review goal before a group session so the meeting does not become unfocused conversation."
  },
  {
    id: "student-tip-32",
    author: "Senior student",
    category: "Study",
    content: "Use short review blocks with a specific output, such as one solved problem or one summarized page."
  },
  {
    id: "student-tip-33",
    author: "Graduating student",
    category: "Clearance",
    content: "Keep a simple table of requirements, submission status, and questions that still need confirmation."
  },
  {
    id: "student-tip-34",
    author: "Alumni volunteer",
    category: "Clearance",
    content: "Photograph or scan receipts and acknowledgement slips immediately so they do not disappear between visits."
  },
  {
    id: "student-tip-35",
    author: "Class officer",
    category: "Clearance",
    content: "Before submitting several documents, arrange them in the same order as your checklist for quicker checking."
  },
  {
    id: "student-tip-36",
    author: "Senior student",
    category: "Clearance",
    content: "Verify changing clearance instructions through the responsible office instead of relying solely on old group messages."
  },
  {
    id: "student-tip-37",
    author: "Budget student",
    category: "Food",
    content: "Bring a refillable water bottle on long days so small purchases do not quietly consume your daily budget."
  },
  {
    id: "student-tip-38",
    author: "Commuter student",
    category: "Food",
    content: "Plan a snack for long gaps between classes, especially when you need steady focus for labs or reviews."
  },
  {
    id: "student-tip-39",
    author: "Blockmate",
    category: "Food",
    content: "Clean your table after eating and keep drinks away from notebooks, borrowed devices, and laboratory outputs."
  },
  {
    id: "student-tip-40",
    author: "Working student",
    category: "Food",
    content: "Track a week of meal spending before changing your budget; actual patterns are easier to improve than guesses."
  },
  {
    id: "student-tip-41",
    author: "Scholarship applicant",
    category: "Files",
    content: "Separate school files by term and subject so older requirements do not get mixed with current submissions."
  },
  {
    id: "student-tip-42",
    author: "Group leader",
    category: "Files",
    content: "Put version numbers or dates in collaborative filenames when more than one person may edit the output."
  },
  {
    id: "student-tip-43",
    author: "Research partner",
    category: "Files",
    content: "Back up final submissions in a second location before deleting drafts or clearing phone storage."
  },
  {
    id: "student-tip-44",
    author: "Lab buddy",
    category: "Files",
    content: "Keep photos of handwritten work upright and cropped so they remain readable when reviewed later."
  },
  {
    id: "student-tip-45",
    author: "Working student",
    category: "Time",
    content: "Group errands that require the same files or nearby destinations into one planned campus trip."
  },
  {
    id: "student-tip-46",
    author: "Class rep",
    category: "Time",
    content: "Add preparation time to deadlines, not only submission time, when printing or signatures may be needed."
  },
  {
    id: "student-tip-47",
    author: "Commuter student",
    category: "Time",
    content: "Leave buffer time before an important appointment so delays do not force rushed decisions."
  },
  {
    id: "student-tip-48",
    author: "Peer tutor",
    category: "Time",
    content: "Use a daily top-three list when several school tasks compete for attention."
  },
  {
    id: "student-tip-49",
    author: "Peer tutor",
    category: "Review",
    content: "Write your own sample questions after reading, then answer them later without checking the material."
  },
  {
    id: "student-tip-50",
    author: "Study buddy",
    category: "Review",
    content: "Compare your solution steps with a classmate's and discuss where your approaches differ."
  },
  {
    id: "student-tip-51",
    author: "Lab student",
    category: "Review",
    content: "Spend extra review time on mistakes you repeat rather than only rereading topics you already know."
  },
  {
    id: "student-tip-52",
    author: "Senior student",
    category: "Review",
    content: "End each review session with a short summary you could explain aloud in under a minute."
  },
  {
    id: "student-tip-53",
    author: "Group leader",
    category: "Teamwork",
    content: "Set a file owner for the final output so multiple last-minute versions do not compete."
  },
  {
    id: "student-tip-54",
    author: "Project teammate",
    category: "Teamwork",
    content: "Raise blockers early and describe what help is needed instead of waiting until the submission day."
  },
  {
    id: "student-tip-55",
    author: "Organization member",
    category: "Teamwork",
    content: "Confirm meeting decisions in a brief message so absent teammates can follow the agreed direction."
  },
  {
    id: "student-tip-56",
    author: "Class officer",
    category: "Teamwork",
    content: "Divide shared work by deliverable rather than vague roles so progress can be checked fairly."
  },
  {
    id: "student-tip-57",
    author: "Freshie",
    category: "Campus Life",
    content: "Save a short note of places you learn during your first visits so navigation becomes easier over time."
  },
  {
    id: "student-tip-58",
    author: "Campus volunteer",
    category: "Campus Life",
    content: "Be mindful of shared spaces by keeping walkways clear and returning moved chairs after use."
  },
  {
    id: "student-tip-59",
    author: "Organization member",
    category: "Campus Life",
    content: "Ask for the official channel before acting on announcements forwarded only through group chats."
  },
  {
    id: "student-tip-60",
    author: "Senior student",
    category: "Campus Life",
    content: "Introduce yourself politely when asking for directions or help; clear questions usually get clearer answers."
  }
];
