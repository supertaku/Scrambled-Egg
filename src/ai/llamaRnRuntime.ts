type LlamaRnModule = typeof import("llama.rn");

let llamaModulePromise: Promise<LlamaRnModule> | null = null;

export function loadLlamaRn(): Promise<LlamaRnModule> {
  llamaModulePromise ??= import("llama.rn");
  return llamaModulePromise;
}
