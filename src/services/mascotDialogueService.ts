interface AskMascotLineOptions {
  draftQuestion: boolean;
  error: boolean;
  initializing: boolean;
  idleLine: string;
  loading: boolean;
  reliable: boolean | null;
}

const openingLines = [
  "Uy TUPian, Haki here. Kumusta day mo?",
  "Ready ako. Ask mo lang kung may campus concern ka.",
  "Need help with registrar, clinic, enrollment, or rules? Chat tayo.",
  "Good day, TUPian. Haki reporting for campus guide duty.",
  "How's your day? Sana hindi ka pa lutang.",
  "May campus question ka ba? I'll help if I know it."
];

const thinkingLines = [
  "Wait lang, chine-check ko muna.",
  "One sec, hanapin ko yung safest answer.",
  "Checking muna para hindi tayo sablay."
];

const typingLines = [
  "I-type mo lang yan.",
  "Go lang, TUPian. Mas specific, mas okay.",
  "Drop the question. Haki's listening."
];

function pickRandom(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)] ?? lines[0] ?? "";
}

export function getRandomOpeningMascotLine(): string {
  return pickRandom(openingLines);
}

export function getRandomThinkingMascotLine(): string {
  return pickRandom(thinkingLines);
}

export function getAskMascotLine(options: AskMascotLineOptions): string {
  if (options.error) {
    return "Hmm, may issue ako ngayon. Try ulit natin in a bit.";
  }

  if (options.initializing) {
    return "Give me a sec, inaayos ko pa guide ko.";
  }

  if (options.loading) {
    return getRandomThinkingMascotLine();
  }

  if (options.draftQuestion) {
    return pickRandom(typingLines);
  }

  if (options.reliable === true) {
    return "Gotchu. May sure answer tayo.";
  }

  if (options.reliable === false) {
    return "Real talk, hindi ako sure dito. Ayokong manghula.";
  }

  return options.idleLine;
}
