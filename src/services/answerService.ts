import type { SearchOptions, SearchResponse } from "@/types/search";

import {
  answerSafeLocalChatWithContext,
  responseForUnsafeRequest
} from "./safeLocalChatService";
import { classifyStudentQuestionIntent } from "./questionIntentService";
import {
  buildCapabilityQuestion,
  buildDeterministicCapabilityResponse,
  buildImageGenerationResponse,
  buildQuickScenarioResponse,
  buildSourceMissFallbackResponse,
  buildSafeQuestionFallbackResponse
} from "./chatCapabilityService";
import {
  buildSourceResponseFromDraft,
  retrieveSourceAnswerDraft
} from "./sourceAnswerService";
import { getSelectedAIMode, type SelectedAIMode } from "./modeSelectionService";

function canUseSafeLocalChat(selectedMode: SelectedAIMode): boolean {
  return Boolean(
    selectedMode.mode.capabilities.safeChat &&
      selectedMode.mode.summaryProviderId &&
      selectedMode.summaryProvider?.answerSafeChat
  );
}

function optionsWithIntentScope(
  options: SearchOptions,
  intent: ReturnType<typeof classifyStudentQuestionIntent>
): SearchOptions {
  if (intent.type !== "safe_question" || !intent.sourceScope) {
    return options;
  }

  return {
    ...options,
    scope: {
      ...intent.sourceScope,
      ...(options.scope ?? {})
    }
  };
}

export async function answerStudentQuestion(
  question: string,
  options: SearchOptions = {}
): Promise<SearchResponse> {
  const intent = classifyStudentQuestionIntent(question);

  if (intent.type === "unsafe_request") {
    return responseForUnsafeRequest(question);
  }

  const selectedMode = await getSelectedAIMode();
  const hasSafeLocalChat = canUseSafeLocalChat(selectedMode);
  const scopedOptions = optionsWithIntentScope(options, intent);

  if (intent.capability === "image_generation") {
    return buildImageGenerationResponse(question, selectedMode.mode);
  }

  const quickResponse = buildQuickScenarioResponse(question, intent, selectedMode.mode);
  if (quickResponse) {
    return quickResponse;
  }

  if (!hasSafeLocalChat) {
    if (intent.route === "obvious_general") {
      return buildSafeQuestionFallbackResponse(question, intent.capability, selectedMode.mode, intent.scenario);
    }

    const sourceDraft = await retrieveSourceAnswerDraft(question, scopedOptions, selectedMode);
    if (!sourceDraft.reliable) {
      return buildSourceMissFallbackResponse(question, intent, selectedMode.mode);
    }

    if (intent.capability === "summary" || intent.capability === "instruction") {
      return buildDeterministicCapabilityResponse(question, intent.capability, sourceDraft);
    }

    return buildSourceResponseFromDraft(question, sourceDraft);
  }

  if (intent.route === "obvious_general") {
    const localQuestion = buildCapabilityQuestion(question, intent.capability, intent.scenario, intent.language);
    const response = await answerSafeLocalChatWithContext(localQuestion, {
      conversationContext: options.conversationContext,
      intent,
      onToken: options.onToken,
      originalQuestion: question
    });

    return {
      ...response,
      question,
      responseType: intent.capability === "university_answer" ? response.responseType ?? "safe_local_chat" : intent.capability
    };
  }

  const sourceDraft = await retrieveSourceAnswerDraft(question, scopedOptions, selectedMode);

  if (!sourceDraft.reliable) {
    const localQuestion = buildCapabilityQuestion(question, intent.capability, intent.scenario, intent.language);
    const localAnswer = await answerSafeLocalChatWithContext(localQuestion, {
      conversationContext: options.conversationContext,
      intent,
      onToken: options.onToken,
      originalQuestion: question
    });

    if (localAnswer.reliable) {
      const {
        citationsUsed: _citationsUsed,
        results: _results,
        topResult: _topResult,
        ...localAnswerWithoutSources
      } = localAnswer;

      return {
        ...localAnswerWithoutSources,
        question,
        normalizedQuestion: sourceDraft.normalizedQuestion,
        results: [],
        citationsUsed: [],
        responseType: localAnswer.responseType ?? "safe_local_chat"
      };
    }

    return buildSourceMissFallbackResponse(question, intent, selectedMode.mode);
  }

  const localQuestion = buildCapabilityQuestion(question, intent.capability, intent.scenario, intent.language);
  const localAnswer = await answerSafeLocalChatWithContext(localQuestion, {
    conversationContext: options.conversationContext,
    intent,
    onToken: options.onToken,
    originalQuestion: question,
    sourceDraft
  });
  const responseType =
    intent.capability === "summary" || intent.capability === "instruction"
      ? intent.capability
      : localAnswer.responseType ?? "safe_local_chat";

  if (localAnswer.reliable) {
    return {
      ...localAnswer,
      question,
      normalizedQuestion: sourceDraft.normalizedQuestion,
      responseType
    };
  }

  if (intent.capability === "summary" || intent.capability === "instruction") {
    return buildDeterministicCapabilityResponse(question, intent.capability, sourceDraft);
  }

  return buildSourceResponseFromDraft(question, sourceDraft);
}
