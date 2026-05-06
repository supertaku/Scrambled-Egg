import type { SearchOptions } from "@/types/search";

export type QuestionRoute = "obvious_general" | "source_context";

export type ReplyLanguage = "english" | "tagalog" | "taglish";

export type QuestionScenario =
  | "academic_support"
  | "adversarial"
  | "basic_math"
  | "campus_life"
  | "campus_office"
  | "capability_discovery"
  | "clarification"
  | "coding_help"
  | "conversation_goodbye"
  | "conversation_greeting"
  | "conversation_thanks"
  | "creative_brainstorm"
  | "general_knowledge"
  | "off_topic_silly"
  | "relationship_advice"
  | "student_admin"
  | "study_advice"
  | "summary_or_translation"
  | "unknown_general"
  | "wellbeing_safety";

export type StudentChatCapability =
  | "general_advice"
  | "image_generation"
  | "instruction"
  | "summary"
  | "university_answer";

export type SafetyCategory =
  | "academic_dishonesty"
  | "cyber_abuse"
  | "dangerous_illegal"
  | "harassment"
  | "privacy_invasion"
  | "self_harm"
  | "sexual_exploitation"
  | "violence";

export type SourceScope = NonNullable<SearchOptions["scope"]>;

export type StudentQuestionIntent =
  | {
      capability: StudentChatCapability;
      language: ReplyLanguage;
      route: QuestionRoute;
      scenario: QuestionScenario;
      sourceScope?: SourceScope;
      type: "safe_question";
    }
  | {
      capability: StudentChatCapability;
      category: SafetyCategory;
      language: ReplyLanguage;
      reason: string;
      route: QuestionRoute;
      type: "unsafe_request";
    };
