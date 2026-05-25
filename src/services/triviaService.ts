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
    body: "TUP began as the Manila Trade School in 1901.",
    source: "TUP About",
    sourceUrl: "https://tup.edu.ph/page/about"
  },
  {
    title: "PSAT era",
    body: "The Manila Trade School became the Philippine School of Arts and Trades in 1910.",
    source: "TUP About",
    sourceUrl: "https://tup.edu.ph/page/about"
  },
  {
    title: "PCAT era",
    body: "The Philippine School of Arts and Trades became PCAT in 1959.",
    source: "TUP About",
    sourceUrl: "https://tup.edu.ph/page/about"
  },
  {
    title: "University era",
    body: "PCAT became the Technological University of the Philippines on June 11, 1978.",
    source: "TUP About",
    sourceUrl: "https://tup.edu.ph/page/about"
  },
  {
    title: "TUPT origin",
    body: "TUP Taguig began as the Manila Technician Institute in 1977.",
    source: "TUP About",
    sourceUrl: "https://tup.edu.ph/page/about"
  },
  {
    title: "TUPT rename",
    body: "The Manila Technician Institute became TUP Taguig in 1985.",
    source: "TUP About",
    sourceUrl: "https://tup.edu.ph/page/about"
  },
  {
    title: "TUPT focus",
    body: "TUP Taguig focuses on engineering, technology, and technical-vocational education.",
    source: "TUP Taguig",
    sourceUrl: "https://www.tupt.edu.ph/"
  },
  {
    title: "TUPT location",
    body: "TUP Taguig is on East Service Road in Western Bicutan.",
    source: "TUP About",
    sourceUrl: "https://tup.edu.ph/page/about"
  },
  {
    title: "TUP campuses",
    body: "TUP has campuses in Manila, Taguig, Cavite, Visayas, and Quezon.",
    source: "TUP About",
    sourceUrl: "https://tup.edu.ph/page/about"
  },
  {
    title: "TUPT departments",
    body: "The TUP Taguig site lists BASD, CAAD, EAAD, and MAAD.",
    source: "TUP Taguig",
    sourceUrl: "https://www.tupt.edu.ph/"
  },
  {
    title: "Gray hawk ID",
    body: "The gray hawk's scientific name is Buteo plagiatus.",
    source: "Audubon Gray Hawk",
    sourceUrl: "https://www.audubon.org/field-guide/bird/gray-hawk"
  },
  {
    title: "Gray hawk look",
    body: "Adult gray hawks are gray with black-and-white tail bands.",
    source: "Audubon Gray Hawk",
    sourceUrl: "https://www.audubon.org/field-guide/bird/gray-hawk"
  },
  {
    title: "Gray hawk habitat",
    body: "Gray hawks favor wooded lowland streams and brushy areas.",
    source: "Audubon Gray Hawk",
    sourceUrl: "https://www.audubon.org/field-guide/bird/gray-hawk"
  },
  {
    title: "Gray hawk diet",
    body: "Gray hawks eat lizards, snakes, birds, mammals, and insects.",
    source: "Audubon Gray Hawk",
    sourceUrl: "https://www.audubon.org/field-guide/bird/gray-hawk"
  },
  {
    title: "Gray hawk flight",
    body: "Gray hawks often flap-glide, then soar while cruising.",
    source: "Cornell Gray Hawk",
    sourceUrl: "https://www.allaboutbirds.org/guide/Gray_Hawk"
  },
  {
    title: "Gray hawk eggs",
    body: "A gray hawk pair usually lays two to three eggs.",
    source: "Audubon Gray Hawk",
    sourceUrl: "https://www.audubon.org/field-guide/bird/gray-hawk"
  }
];

export function getSeedTriviaItems(): TriviaItem[] {
  return [...triviaItems];
}
