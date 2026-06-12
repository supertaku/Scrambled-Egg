import type { ModelOperationState } from "@/ai/localModelManager";

function formatPercent(progress: number | null): string {
  return `${Math.round((progress ?? 0) * 100)}%`;
}

export function messageForModelOperation(
  operation: ModelOperationState | null,
  activeModelName: string | null
): string {
  if (!operation) {
    return activeModelName
      ? "All Haki modes are ready."
      : "Campus Haki is ready. Download a chat model to unlock supportive modes.";
  }
  switch (operation.phase) {
    case "queued":
      return "Your chat download is queued and may continue while you use another app.";
    case "downloading":
      return `I'm downloading the Haki model: ${formatPercent(operation.progress)} complete.`;
    case "paused":
      return operation.resumable
        ? "The download is paused. Tap Resume when you're ready."
        : "This interrupted download cannot be resumed. Discard it and try again.";
    case "verifying":
      return "The download is complete. I'm checking the file before using it.";
    case "validating":
      return "I'm checking whether this download will work on this phone.";
    case "optimizing":
      return "I'm checking the fastest safe way to run this Haki model.";
    case "waiting_for_chat":
      return "I'll use the new Haki model after I finish the current answer.";
    case "activating":
      return "I'm getting this Haki model ready. Campus Haki is still available.";
    case "removing":
      return "I'm removing this chat download.";
    case "completed":
      return operation.error ?? "Ready. Your local AI option is set up.";
    case "canceled":
      return "The change was canceled. Your current setup was not changed.";
    case "failed":
      return operation.error ?? "I could not finish setting up that Haki model. Please try again.";
  }
}
