export interface DisposableProviderRegistry {
  dispose(): Promise<void>;
}

export async function replaceProviderRegistry<T>(
  current: DisposableProviderRegistry | null,
  createReplacement: () => Promise<T>,
  onCleanupError: (error: unknown) => void
): Promise<T> {
  if (current) {
    try {
      await current.dispose();
    } catch (error) {
      onCleanupError(error);
    }
  }
  return createReplacement();
}
