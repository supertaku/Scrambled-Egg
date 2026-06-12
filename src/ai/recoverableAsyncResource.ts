export type AsyncResourceRelease<T> = (resourcePromise: Promise<T>) => Promise<void>;

export class RecoverableAsyncResource<T> {
  private key: string | null = null;
  private resourcePromise: Promise<T> | null = null;

  async get(
    key: string,
    create: () => Promise<T>,
    release: AsyncResourceRelease<T>
  ): Promise<T> {
    if (this.resourcePromise && this.key !== key) {
      await this.invalidate(release);
    }

    if (!this.resourcePromise) {
      const pending = Promise.resolve().then(create);
      this.key = key;
      this.resourcePromise = pending;
      try {
        return await pending;
      } catch (error) {
        if (this.resourcePromise === pending) {
          this.resourcePromise = null;
          this.key = null;
        }
        throw error;
      }
    }

    return this.resourcePromise;
  }

  async invalidate(release: AsyncResourceRelease<T>): Promise<void> {
    const pending = this.resourcePromise;
    this.resourcePromise = null;
    this.key = null;
    if (pending) await release(pending);
  }
}
