import { canteenStores } from "@/data/canteenStores";
import { normalizeQuery } from "@/retrieval/queryNormalizer";
import type { DeviceAIMode } from "@/ai/DeviceAIMode";
import type { SearchResponse } from "@/types/search";
import type { StudentQuestionIntent } from "./studentChatTypes";

const CANTEEN_FOOD_PATTERN =
  /\b(canteen|cafeteria|food|foods|meal|meals|menu|lunch|snack|snacks|drink|drinks|eat|buy|ulam|rice meal|siomai|silog|pancit|sandwich|coffee|gulaman)\b/i;
const FOOD_LOOKUP_PATTERN =
  /\b(what|which|list|show|available|serve|sell|have|has|price|cost|how much|where can i eat|what can i eat|menu)\b/i;

function formatPrice(price: number): string {
  return `PHP ${price}`;
}

function foodMatchesQuery(foodName: string, normalizedQuestion: string): boolean {
  const normalizedFood = normalizeQuery(foodName);
  if (normalizedQuestion.includes(normalizedFood)) return true;

  const foodTokens = normalizedFood.split(" ").filter((token) => token.length >= 4);
  return foodTokens.length > 0 && foodTokens.every((token) => normalizedQuestion.includes(token));
}

function storeMatchesQuery(storeName: string, normalizedQuestion: string): boolean {
  const normalizedStore = normalizeQuery(storeName);
  if (normalizedQuestion.includes(normalizedStore)) return true;

  const storeTokens = normalizedStore.split(" ").filter((token) => token.length >= 5);
  return storeTokens.length > 0 && storeTokens.every((token) => normalizedQuestion.includes(token));
}

function matchingFoodLines(normalizedQuestion: string): string[] {
  const lines: string[] = [];

  for (const store of canteenStores) {
    const storeMatched = storeMatchesQuery(store.name, normalizedQuestion);
    for (const food of store.foods) {
      if (storeMatched || foodMatchesQuery(food.name, normalizedQuestion)) {
        lines.push(`${food.name} - ${formatPrice(food.price)} at ${store.name}. ${food.description}`);
      }
    }
  }

  return lines.slice(0, 5);
}

function storeMenuLines(): string[] {
  return canteenStores.map((store) => {
    const foods = store.foods.map((food) => `${food.name} (${formatPrice(food.price)})`).join(", ");
    return `${store.name}: ${foods}.`;
  });
}

export function buildCanteenFoodResponse(
  question: string,
  intent: StudentQuestionIntent,
  mode: DeviceAIMode
): SearchResponse | null {
  if (intent.type !== "safe_question") return null;
  if (!CANTEEN_FOOD_PATTERN.test(question)) return null;

  const normalizedQuestion = normalizeQuery(question);
  const asksFoodLookup = FOOD_LOOKUP_PATTERN.test(question) || intent.scenario === "campus_life";
  if (!asksFoodLookup) return null;

  const matches = matchingFoodLines(normalizedQuestion);
  const lines = matches.length > 0 ? matches : storeMenuLines();
  const answerText = [
    "From Haki's local canteen guide, you can check these options. Treat prices and availability as convenience info, not official policy:",
    "",
    ...lines.map((line, index) => `${index + 1}. ${line}`),
    "",
    "Confirm the current price and availability at the stall before buying."
  ].join("\n");

  return {
    question,
    requestedChatRole: "haki",
    answerBasis: "safety_or_app_guidance",
    normalizedQuestion,
    responseType: "general_advice",
    results: [],
    confidence: "low",
    reliable: false,
    answerText,
    citationsUsed: [],
    provenance: "No reliable saved source found",
    activeMode: mode
  };
}
