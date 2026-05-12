export type TriviaSource =
  | "TUP About"
  | "TUP Taguig"
  | "Audubon Gray Hawk"
  | "Cornell Gray Hawk";

export type TriviaItem = {
  title: string;
  body: string;
  source: TriviaSource;
  sourceUrl: string;
};

const triviaItems: readonly TriviaItem[] = [
  {
    title: "TUP roots",
    body: "Nagsimula ito as Manila Trade School in 1901.",
    source: "TUP About",
    sourceUrl: "https://tup.edu.ph/page/about"
  },
  {
    title: "PSAT era",
    body: "Manila Trade School became Philippine School of Arts and Trades in 1910.",
    source: "TUP About",
    sourceUrl: "https://tup.edu.ph/page/about"
  },
  {
    title: "PCAT era",
    body: "PSAT became Philippine College of Arts and Trades in 1959.",
    source: "TUP About",
    sourceUrl: "https://tup.edu.ph/page/about"
  },
  {
    title: "University era",
    body: "PCAT became TUP noong June 11, 1978.",
    source: "TUP About",
    sourceUrl: "https://tup.edu.ph/page/about"
  },
  {
    title: "TUPT origin",
    body: "Started as Manila Technician Institute noong 1977.",
    source: "TUP About",
    sourceUrl: "https://tup.edu.ph/page/about"
  },
  {
    title: "TUPT rename",
    body: "MTI became TUP Taguig noong 1985.",
    source: "TUP About",
    sourceUrl: "https://tup.edu.ph/page/about"
  },
  {
    title: "TUPT focus",
    body: "Focused siya sa engineering, technology, and technical-vocational education.",
    source: "TUP Taguig",
    sourceUrl: "https://www.tupt.edu.ph/"
  },
  {
    title: "TUPT location",
    body: "Nasa East Service Road, Western Bicutan ang campus.",
    source: "TUP About",
    sourceUrl: "https://tup.edu.ph/page/about"
  },
  {
    title: "TUP campuses",
    body: "May Manila, Taguig, Cavite, Visayas, and Quezon campuses.",
    source: "TUP About",
    sourceUrl: "https://tup.edu.ph/page/about"
  },
  {
    title: "TUPT departments",
    body: "BASD, CAAD, EAAD, and MAAD appear on the TUPT site.",
    source: "TUP Taguig",
    sourceUrl: "https://www.tupt.edu.ph/"
  },
  {
    title: "Gray hawk ID",
    body: "Its scientific name is Buteo plagiatus.",
    source: "Audubon Gray Hawk",
    sourceUrl: "https://www.audubon.org/field-guide/bird/gray-hawk"
  },
  {
    title: "Gray hawk look",
    body: "Adults are gray with black-and-white tail bands.",
    source: "Audubon Gray Hawk",
    sourceUrl: "https://www.audubon.org/field-guide/bird/gray-hawk"
  },
  {
    title: "Gray hawk habitat",
    body: "They like wooded lowland streams and brushy areas.",
    source: "Audubon Gray Hawk",
    sourceUrl: "https://www.audubon.org/field-guide/bird/gray-hawk"
  },
  {
    title: "Gray hawk diet",
    body: "Mahilig sila sa lizards, snakes, birds, mammals, and insects.",
    source: "Audubon Gray Hawk",
    sourceUrl: "https://www.audubon.org/field-guide/bird/gray-hawk"
  },
  {
    title: "Gray hawk flight",
    body: "Often flap-glide sila, then soar kapag cruising.",
    source: "Cornell Gray Hawk",
    sourceUrl: "https://www.allaboutbirds.org/guide/Gray_Hawk"
  },
  {
    title: "Gray hawk eggs",
    body: "A pair usually lays two to three eggs.",
    source: "Audubon Gray Hawk",
    sourceUrl: "https://www.audubon.org/field-guide/bird/gray-hawk"
  }
];

export function getSeedTriviaItems(): TriviaItem[] {
  return [...triviaItems];
}
