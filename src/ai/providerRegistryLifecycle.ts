export interface DisposableProviderRegistry {
  dispose(): Promise<void>;
}

export async function disposeProviderRegistry(
  current: DisposableProviderRegistry | null,
  onCleanupError: (error: unknown) => void
): Promise<void> {
  if (!current) return;
  try {
    await current.dispose();
  } catch (error) {
    onCleanupError(error);
  }
}

export async function replaceProviderRegistry<T>(
  current: DisposableProviderRegistry | null,
  createReplacement: () => Promise<T>,
  onCleanupError: (error: unknown) => void
): Promise<T> {
  await disposeProviderRegistry(current, onCleanupError);
  return createReplacement();
}
