/**
 * @file orgChart.ts
 * @description Realistic mock org chart data for TUP-Taguig colleges.
 *
 * HOW TO REPLACE WITH REAL DATA
 * ─────────────────────────────
 * 1. Keep the `OrgNode` interface — the OrgChart screen depends on this recursive shape.
 * 2. Replace the `collegeEngineering`, `collegeEngineeringTechnology`, and
 *    `collegeEducationSciences` objects with real data.
 * 3. Each node can have optional `children` which allows the tree to grow indefinitely.
 * 4. Update the `orgChartColleges` array if more colleges or academic units are added.
 */

export interface OrgNode {
  id: string;
  name: string;
  title: string;
  children?: OrgNode[];
}

export const collegeEngineering: OrgNode = {
  id: "ce-dean",
  name: "Engr. Roberto M. Santos",
  title: "Dean, College of Engineering",
  children: [
    {
      id: "ce-dept-civil",
      name: "Engr. Maria Teresa L. Reyes",
      title: "Department Chair, Civil Engineering",
      children: [
        { id: "ce-civil-f1", name: "Engr. Jose P. Dela Cruz", title: "Instructor I" },
        { id: "ce-civil-f2", name: "Engr. Lorna C. Aquino", title: "Instructor II" },
        { id: "ce-civil-f3", name: "Engr. Raymond S. Gutierrez", title: "Faculty" }
      ]
    },
    {
      id: "ce-dept-ee",
      name: "Engr. Rodolfo A. Villanueva",
      title: "Department Chair, Electrical Engineering",
      children: [
        { id: "ce-ee-f1", name: "Engr. Angelica D. Cruz", title: "Instructor I" },
        { id: "ce-ee-f2", name: "Engr. Marco F. Soriano", title: "Instructor II" },
        { id: "ce-ee-f3", name: "Engr. Patricia N. Bautista", title: "Faculty" }
      ]
    },
    {
      id: "ce-dept-me",
      name: "Engr. Ferdinand C. Navarro",
      title: "Department Chair, Mechanical Engineering",
      children: [
        { id: "ce-me-f1", name: "Engr. Cristina M. Lopez", title: "Instructor I" },
        { id: "ce-me-f2", name: "Engr. Andres B. Ramos", title: "Instructor II" },
        { id: "ce-me-f3", name: "Engr. Theresa V. Mendoza", title: "Faculty" }
      ]
    },
    {
      id: "ce-dept-ie",
      name: "Engr. Josefina R. Torres",
      title: "Department Chair, Industrial Engineering",
      children: [
        { id: "ce-ie-f1", name: "Engr. Dante L. Abad", title: "Instructor I" },
        { id: "ce-ie-f2", name: "Engr. Gloria P. Manalo", title: "Faculty" }
      ]
    }
  ]
};

export const collegeEngineeringTechnology: OrgNode = {
  id: "cet-dean",
  name: "Engr. Antonio D. Flores",
  title: "Dean, College of Engineering Technology",
  children: [
    {
      id: "cet-dept-eet",
      name: "Engr. Nora S. Cabrera",
      title: "Department Chair, Electrical Engineering Technology",
      children: [
        { id: "cet-eet-f1", name: "Engr. Hernando C. Ramos", title: "Instructor I" },
        { id: "cet-eet-f2", name: "Engr. Rosario M. Velarde", title: "Instructor II" }
      ]
    },
    {
      id: "cet-dept-met",
      name: "Engr. Alfredo V. Pascual",
      title: "Department Chair, Mechanical Engineering Technology",
      children: [
        { id: "cet-met-f1", name: "Engr. Luz B. Gonzales", title: "Instructor I" },
        { id: "cet-met-f2", name: "Engr. Raul G. Catalan", title: "Instructor II" },
        { id: "cet-met-f3", name: "Engr. Marites A. Ocampo", title: "Faculty" }
      ]
    },
    {
      id: "cet-dept-at",
      name: "Engr. Vicente M. Padilla",
      title: "Department Chair, Automotive Technology",
      children: [
        { id: "cet-at-f1", name: "Engr. Conrado J. Enriquez", title: "Instructor I" },
        { id: "cet-at-f2", name: "Engr. Wilhelmina C. Marcos", title: "Faculty" }
      ]
    },
    {
      id: "cet-dept-ct",
      name: "Engr. Rosemarie L. Lim",
      title: "Department Chair, Computer Technology",
      children: [
        { id: "cet-ct-f1", name: "Engr. Esteban P. Rivera", title: "Instructor I" },
        { id: "cet-ct-f2", name: "Engr. Dolores C. Santos", title: "Instructor II" },
        { id: "cet-ct-f3", name: "Engr. Virgilio D. Reyes", title: "Faculty" }
      ]
    }
  ]
};

export const collegeEducationSciences: OrgNode = {
  id: "ces-dean",
  name: "Dr. Remedios C. Dela Rosa",
  title: "Dean, College of Education and Sciences",
  children: [
    {
      id: "ces-dept-math",
      name: "Dr. Erlinda M. Santos",
      title: "Department Chair, Mathematics",
      children: [
        { id: "ces-math-f1", name: "Mr. Camilo L. Fernandez", title: "Instructor I" },
        { id: "ces-math-f2", name: "Ms. Violeta A. Cruz", title: "Instructor II" },
        { id: "ces-math-f3", name: "Mr. Aurelio P. Bautista", title: "Faculty" }
      ]
    },
    {
      id: "ces-dept-english",
      name: "Dr. Celerina V. Navarro",
      title: "Department Chair, English",
      children: [
        { id: "ces-eng-f1", name: "Ms. Trinidad C. Flores", title: "Instructor I" },
        { id: "ces-eng-f2", name: "Mr. Narciso R. Sarmiento", title: "Faculty" }
      ]
    },
    {
      id: "ces-dept-science",
      name: "Dr. Nestor B. Aquino",
      title: "Department Chair, Natural Sciences",
      children: [
        { id: "ces-sci-f1", name: "Mr. Cirilo C. Mendez", title: "Instructor I" },
        { id: "ces-sci-f2", name: "Ms. Felisa P. Perez", title: "Instructor II" },
        { id: "ces-sci-f3", name: "Mr. Isidro N. Reyes", title: "Faculty" }
      ]
    },
    {
      id: "ces-dept-pe",
      name: "Mr. Alfredo T. Salas",
      title: "Department Chair, Physical Education",
      children: [
        { id: "ces-pe-f1", name: "Mr. Rodolfo C. Mateo", title: "Instructor I" },
        { id: "ces-pe-f2", name: "Ms. Crisanta A. Dela Cruz", title: "Faculty" }
      ]
    },
    {
      id: "ces-dept-nstp",
      name: "Capt. Armando J. Castillo",
      title: "NSTP Coordinator",
      children: [
        { id: "ces-nstp-f1", name: "Ms. Pacita V. Guevara", title: "Instructor I" }
      ]
    }
  ]
};

export const orgChartColleges = [
  { key: "ce", label: "College of Engineering", short: "CE", data: collegeEngineering },
  { key: "cet", label: "College of Engineering Technology", short: "CET", data: collegeEngineeringTechnology },
  { key: "ces", label: "College of Education & Sciences", short: "CES", data: collegeEducationSciences }
] as const;
