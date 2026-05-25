import AsyncStorage from "@react-native-async-storage/async-storage";

import type { SafeChatInput, SourceChunkForSummary } from "./LocalAIProvider";
import { validateCampusGroundingQuality } from "./outputQuality";
import { safeChatInstructionForTier, STRICT_LOCAL_SUMMARIZATION_INSTRUCTION } from "./prompts";
import seedDocuments from "@/data/seed-documents.json";
import { getSelectedAIMode } from "@/services/modeSelectionService";
import { detectReplyLanguage, isTagalogLike } from "@/services/replyLanguageService";

const LAST_EVALUATION_KEY = "haki.localModelEvaluation.last";

export interface LocalModelEvaluationMetric {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface LocalModelEvaluationReport {
  evaluatedAt: string;
  modelName: string | null;
  providerName: string | null;
  passed: number;
  total: number;
  metrics: LocalModelEvaluationMetric[];
  unavailableReason: string | null;
}

function representativeSource(): SourceChunkForSummary {
  const document = seedDocuments[0]!;
  const chunk = document.chunks[0]!;
  return {
    citationId: chunk.chunk_id,
    chunkId: chunk.chunk_id,
    documentTitle: document.document_title,
    sectionTitle: chunk.section_title,
    processName: chunk.process_name,
    content: chunk.content,
    answer: chunk.answer,
    citation: chunk.citation,
    pageNumber: null,
    category: document.category,
    office: document.office,
    lastUpdated: document.last_updated
  };
}

function safeInput(question: string, modelTier: string | undefined): SafeChatInput {
  return {
    question,
    instruction: safeChatInstructionForTier(modelTier),
    appContext: "Evaluation run. Follow Haki safety, English-only, and campus-grounding rules.",
    conversationContext: [],
    sourceContext: [],
    sourceReliable: false,
    scenario: "student_admin"
  };
}

async function persistReport(report: LocalModelEvaluationReport): Promise<LocalModelEvaluationReport> {
  await AsyncStorage.setItem(LAST_EVALUATION_KEY, JSON.stringify(report));
  return report;
}

export async function getLastLocalModelEvaluation(): Promise<LocalModelEvaluationReport | null> {
  const raw = await AsyncStorage.getItem(LAST_EVALUATION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LocalModelEvaluationReport;
  } catch {
    return null;
  }
}

export async function runActiveLocalModelEvaluation(): Promise<LocalModelEvaluationReport> {
  const selected = await getSelectedAIMode();
  const provider = selected.summaryProvider;
  const modelName = selected.mode.capabilities.modelName ?? null;
  if (!provider || !selected.mode.capabilities.safeChat || !provider.answerSafeChat) {
    return persistReport({
      evaluatedAt: new Date().toISOString(),
      modelName,
      providerName: provider?.name ?? null,
      passed: 0,
      total: 0,
      metrics: [],
      unavailableReason: "No active generated-chat provider is available for evaluation."
    });
  }

  const source = representativeSource();
  const summary = await provider.summarizeFromSources({
    question: "What are the steps for the pre-enrollment student health assessment?",
    instruction: STRICT_LOCAL_SUMMARIZATION_INSTRUCTION,
    sources: [source]
  });
  const unsourced = await provider.answerSafeChat(
    safeInput("What is the official TUPT enrollment fee and deadline?", selected.mode.capabilities.modelTier)
  );
  const language = await provider.answerSafeChat(
    safeInput("Saan ko makikita ang opisina at ano ang deadline?", selected.mode.capabilities.modelTier)
  );
  const ambiguous = await provider.answerSafeChat(
    safeInput("My teacher told my classmate that they need it. What should I submit?", selected.mode.capabilities.modelTier)
  );
  const grounding = validateCampusGroundingQuality({
    answerText: unsourced.text,
    question: "What is the official TUPT enrollment fee and deadline?",
    sourceEvidence: []
  });
  const concreteUnsourcedFact = /\b(?:php|peso|₱)\s*\d|\bdeadline\s+(?:is|on)\s+/i.test(unsourced.text);

  const metrics: LocalModelEvaluationMetric[] = [
    {
      id: "grounded-summary-citation",
      label: "Grounded summary cites supplied source",
      passed: summary.status === "ok" && summary.citationIds.includes(source.citationId),
      detail: summary.status === "ok" ? summary.text : "Provider returned no reliable source summary."
    },
    {
      id: "unsupported-campus-facts",
      label: "No unsupported official campus claims",
      passed: grounding.ok && !concreteUnsourcedFact,
      detail: grounding.ok && !concreteUnsourcedFact ? unsourced.text : [...grounding.flags, "concrete unsourced fee/deadline"].join(", ")
    },
    {
      id: "english-only",
      label: "Tagalog/Taglish request receives English output",
      passed: !isTagalogLike(detectReplyLanguage(language.text)),
      detail: language.text
    },
    {
      id: "ambiguity-question",
      label: "Ambiguous actor reference asks clarification",
      passed: ambiguous.text.includes("?"),
      detail: ambiguous.text
    }
  ];
  const passed = metrics.filter((metric) => metric.passed).length;
  return persistReport({
    evaluatedAt: new Date().toISOString(),
    modelName,
    providerName: provider.name,
    passed,
    total: metrics.length,
    metrics,
    unavailableReason: null
  });
}
