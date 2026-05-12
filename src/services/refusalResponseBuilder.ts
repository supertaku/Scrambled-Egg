import { SAFE_LOCAL_CHAT_REFUSAL_MESSAGE } from "@/ai/prompts";
import { normalizeQuery } from "@/retrieval/queryNormalizer";

import type { ReplyLanguage, SafetyCategory } from "./questionIntentService";

interface RefusalContext {
  language?: ReplyLanguage;
  question?: string;
}

function hashText(value: string): number {
  return [...value].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7);
}

function chooseVariant(question: string | undefined, variants: string[]): string {
  const key = normalizeQuery(question ?? "");
  const fallback = variants[0] ?? SAFE_LOCAL_CHAT_REFUSAL_MESSAGE;
  return variants[hashText(key || fallback) % variants.length] ?? fallback;
}

const ENGLISH_REFUSALS: Record<SafetyCategory, string[]> = {
  academic_dishonesty: [
    "I get why you want a shortcut, but I can't help cheat, copy answers, plagiarize, forge documents, or bypass school requirements because that breaks academic rules and can put your record at risk. I can help you make a reviewer, a study plan, or a quick catch-up strategy instead.",
    "I can't walk you through cheating or fake school requirements because that would be unfair to classmates and against academic rules. What I can do is help you review the coverage, summarize allowed material, or build a study plan for the time you have.",
    "I won't help with cheating, copied answers, or forged documents because that can get you in serious academic trouble. Send the subject or topic, and I'll help you prepare honestly with a reviewer or practice questions."
  ],
  cyber_abuse: [
    "I can't help hack accounts, steal passwords, phish, spread malware, or bypass systems because that puts people and school systems at risk. I can help with defensive security basics, password safety, or how to report a suspicious issue.",
    "I can't guide you through breaking into accounts or systems because that crosses into cyber abuse and could harm real people. If this is for learning, I can explain ethical cybersecurity concepts or safe lab practice.",
    "I won't help with credential theft, malware, or exploiting systems. I can still help you secure an account, understand a vulnerability at a high level, or write a responsible security report."
  ],
  dangerous_illegal: [
    "I can't help with illegal activity, fake documents, drugs, theft, or evading authorities because that can break the law and hurt your future. I can help think through safe, legal next steps or the proper office to ask.",
    "I can't give steps for something illegal or dangerous because it could seriously harm people, break the law, or get you in trouble. If there is a real problem behind the request, tell me the situation and I'll help find a safe option.",
    "I won't help make fake documents or dodge official processes because those can violate rules and the law. I can help you prepare the legitimate requirements or write a message asking the right office for help."
  ],
  harassment: [
    "I can't help pressure, threaten, humiliate, manipulate, or take revenge on someone because that can harm them and escalate the conflict. I can help you write a respectful message, cool down the situation, or find the right campus office to report a concern.",
    "I won't help with blackmail, harassment, or manipulation because that puts another person in a bad spot and can make things worse for you too. I can help you handle the conflict directly and respectfully.",
    "I can't help you harass or force someone into doing something. If you're upset, I can help draft a calm message, plan a safer conversation, or figure out whether OSA, Guidance, or a trusted faculty member should be involved."
  ],
  privacy_invasion: [
    "I can't help stalk, track, dox, or get private information about someone because that violates their privacy and safety. I can help you handle distance, boundaries, or a campus concern respectfully.",
    "I won't help you follow someone, read private messages, or find their location without consent because that crosses a privacy and safety line. If you need space from them, I can help plan respectful boundaries.",
    "I can't guide you on spying or tracking a person because it breaks privacy and safety boundaries. A safer move is to keep distance, communicate clearly if needed, and ask Guidance, OSA, or a trusted adult for help if the situation feels unsafe."
  ],
  self_harm: [
    "I can't give self-harm instructions because that could put you or someone else in immediate danger. If this is about you right now, stay with someone you trust and contact emergency services, 911 in the Philippines, campus Guidance, or a trusted person. I can help write a short message asking for support.",
    "I can't help with methods for hurting yourself. Your safety matters more than answering that directly, so please reach out now to emergency help, 911 in the Philippines, Guidance, or someone nearby who can stay with you. I can help you word the message.",
    "I won't explain self-harm methods because that could make an unsafe moment worse. If you're in danger or might act on it, contact emergency services, 911 in the Philippines, or a trusted person immediately. I can stay practical and help you ask for help."
  ],
  sexual_exploitation: [
    "I can't help with sexual exploitation, non-consensual sexual content, or anything sexual involving minors because consent and safety come first. If someone is at risk, contact a trusted authority, Guidance, OSA, or campus security immediately.",
    "I won't help create, share, or pressure anyone for sexual content without consent, especially involving minors. I can help with reporting, safety planning, or a respectful message that sets boundaries.",
    "I can't assist with sexual exploitation or non-consensual content. If this involves a real person at risk, bring it to Guidance, OSA, campus security, or another trusted authority right away."
  ],
  violence: [
    "I can't help with violence, weapons, attacks, or instructions that could harm people because that can seriously injure someone and break the law. I can help you step away, de-escalate, or find safe help.",
    "I won't give steps for hurting someone or making weapons. That crosses a safety line and could put people in danger. If there is a conflict behind this, tell me what's happening and I'll help with a safer next move.",
    "I can't guide violence or weapon-making because real people could get hurt and the law can get involved fast. I can help you report a threat, avoid escalation, or contact a trusted authority."
  ]
};

// Haki replies in English only (see AGENTS.md). We intentionally do NOT keep a
// Taglish refusal table; non-English input still receives an English refusal
// and is redirected toward English in the rest of the pipeline.

export function buildUnsafeRequestMessageForCategory(category: SafetyCategory | null, context?: RefusalContext): string {
  if (!category) return SAFE_LOCAL_CHAT_REFUSAL_MESSAGE;
  return chooseVariant(context?.question, ENGLISH_REFUSALS[category]);
}
