import { SAFE_LOCAL_CHAT_REFUSAL_MESSAGE } from "@/ai/prompts";
import { normalizeQuery } from "@/retrieval/queryNormalizer";

import { detectReplyLanguage, isTagalogLike } from "./replyLanguageService";
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

function languageForContext(context?: RefusalContext): ReplyLanguage {
  return context?.language ?? detectReplyLanguage(context?.question ?? "");
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
    "I can't give self-harm instructions because that could put you or someone else in immediate danger. If this is about you right now, stay with someone you trust, contact emergency services, campus Guidance, or a trusted person. I can help write a short message asking for support.",
    "I can't help with methods for hurting yourself. Your safety matters more than answering that directly, so please reach out now to emergency help, Guidance, or someone nearby who can stay with you. I can help you word the message.",
    "I won't explain self-harm methods because that could make an unsafe moment worse. If you're in danger or might act on it, contact emergency services or a trusted person immediately. I can stay practical and help you ask for help."
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

const TAGLISH_REFUSALS: Record<SafetyCategory, string[]> = {
  academic_dishonesty: [
    "Gets ko na gusto mong makalusot, pero hindi ako tutulong sa cheating, pangongopya, plagiarism, fake documents, or pag-bypass ng school rules. Delikado yan sa academic record mo. Pwede kitang tulungan gumawa ng reviewer, study plan, or quick catch-up strategy instead.",
    "Hindi kita matutulungan mandaya or gumawa ng fake school requirement kasi against academic rules yun and unfair din sa classmates. Pero pwede kitang tulungan i-review ang coverage, gumawa ng practice questions, or magplano sa natitirang oras.",
    "Pass ako sa cheating, copied answers, or forged documents kasi pwede kang ma-serious trouble academically. Send mo subject or topic, then tutulungan kitang mag-prepare nang honest with reviewer or sample questions."
  ],
  cyber_abuse: [
    "Hindi ako tutulong sa hacking, password stealing, phishing, malware, or bypassing systems kasi may real people and school systems na pwedeng ma-risk. Pwede kitang tulungan sa defensive security basics or paano mag-report ng suspicious issue.",
    "Hindi kita gagabayan sa pagpasok sa account or system ng iba. Cyber abuse na yun. Kung learning goal ito, pwede kong i-explain ang ethical cybersecurity concepts or safe lab practice.",
    "Pass ako sa credential theft, malware, or exploiting systems. Pwede pa rin kitang tulungan mag-secure ng account, maintindihan ang vulnerability at high level, or gumawa ng responsible report."
  ],
  dangerous_illegal: [
    "Hindi ako tutulong sa illegal activity, fake documents, drugs, theft, or pag-iwas sa authorities kasi pwede kang ma-law or school trouble. Pwede kitang tulungan humanap ng safe and legal next step.",
    "Hindi ako magbibigay ng steps para sa illegal or dangerous na bagay. Kung may totoong problema sa likod nito, sabihin mo yung situation and tutulungan kitang humanap ng safe option.",
    "Hindi ako tutulong gumawa ng fake documents or umiwas sa official process. Pwede kitang tulungan ihanda ang legit requirements or gumawa ng message sa tamang office."
  ],
  harassment: [
    "Hindi ako tutulong mang-pressure, manakot, manghiya, mag-manipulate, or gumanti sa ibang tao kasi pwedeng makasakit and lumala ang conflict. Pwede kitang tulungan gumawa ng respectful message or planong pang-de-escalate.",
    "Pass ako sa blackmail, harassment, or manipulation kasi nilalagay mo yung tao sa bad spot and pwede ring bumalik sayo. Pwede kitang tulungan harapin yung conflict nang diretso pero respectful.",
    "Hindi kita tutulungan pilitin or i-harass ang isang tao. Kung galit ka, pwede kitang tulungan gumawa ng calm message, safer conversation plan, or alamin kung dapat na bang lumapit sa OSA, Guidance, or trusted faculty."
  ],
  privacy_invasion: [
    "Hindi ako tutulong mag-stalk, mag-track, mag-dox, or kumuha ng private info ng tao kasi privacy and safety nila yun. Pwede kitang tulungan mag-set ng boundaries or dumistansya respectfully.",
    "Hindi kita tutulungan sundan ang tao, basahin private messages, or hanapin location niya without consent. Privacy and safety line yun. Kung kailangan mo ng space, tutulungan kitang gumawa ng respectful boundary plan.",
    "Pass ako sa spying or tracking ng person. Mas safe: keep distance, communicate clearly kung kailangan, and lumapit sa Guidance, OSA, or trusted adult kung unsafe na yung situation."
  ],
  self_harm: [
    "Hindi ako magbibigay ng self-harm instructions kasi immediate danger yun. Kung ikaw ito ngayon, stay with someone you trust and contact emergency services, campus Guidance, or a trusted person. Pwede kitang tulungan gumawa ng short message asking for support.",
    "Hindi kita tutulungan sa paraan ng pananakit sa sarili. Mas importante safety mo ngayon, so please reach out sa emergency help, Guidance, or taong malapit sayo na pwedeng samahan ka. Tutulungan kitang i-word yung message.",
    "Hindi ko ie-explain ang self-harm methods kasi pwedeng lumala ang unsafe moment. Kung in danger ka or baka gawin mo, contact emergency services or a trusted person immediately. Pwede kitang tulungan humingi ng help."
  ],
  sexual_exploitation: [
    "Hindi ako tutulong sa sexual exploitation, non-consensual sexual content, or anything sexual involving minors. Consent and safety first. Kung may taong at risk, contact Guidance, OSA, campus security, or trusted authority agad.",
    "Pass ako sa paggawa, pag-share, or pag-pressure for sexual content without consent, lalo na kung minors. Pwede kitang tulungan sa reporting, safety plan, or respectful boundary message.",
    "Hindi ako makakatulong sa sexual exploitation or non-consensual content. Kung real person ito na at risk, dalhin agad sa Guidance, OSA, campus security, or trusted authority."
  ],
  violence: [
    "Hindi ako tutulong sa violence, weapons, attacks, or instructions na pwedeng makasakit ng tao. Delikado yan and may legal consequences. Pwede kitang tulungan mag-step back, mag-de-escalate, or humanap ng safe help.",
    "Hindi ako magbibigay ng steps para manakit or gumawa ng weapon. Safety line yun. Kung conflict ang dahilan, sabihin mo anong nangyari and tutulungan kitang pumili ng safer next move.",
    "Hindi kita gagabayan sa violence or weapon-making kasi real people can get hurt and mabilis lumala legally. Pwede kitang tulungan mag-report ng threat, umiwas sa escalation, or contact trusted authority."
  ]
};

export function buildUnsafeRequestMessageForCategory(category: SafetyCategory | null, context?: RefusalContext): string {
  if (!category) return SAFE_LOCAL_CHAT_REFUSAL_MESSAGE;

  const language = languageForContext(context);
  const variants = isTagalogLike(language) ? TAGLISH_REFUSALS[category] : ENGLISH_REFUSALS[category];
  return chooseVariant(context?.question, variants);
}
