import { pruneChatContext } from "@/ai/tokenBudget";
import type { ChatContextTurn } from "@/types/search";
import type { ChatMessage } from "@/types/chat";

export function buildConversationContext(messages: ChatMessage[]): ChatContextTurn[] {
  const turns: ChatContextTurn[] = messages
    .filter((message) => message.id !== "opening" && message.text.trim().length > 0)
    .map((message) => ({
      sender: message.sender === "user" ? "user" : "haki",
      text: message.text.trim()
    }));
  return pruneChatContext(turns);
}

export function mergeChatContext(...groups: ChatContextTurn[][]): ChatContextTurn[] {
  return pruneChatContext(groups.flat());
}
