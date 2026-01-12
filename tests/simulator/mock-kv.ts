/**
 * In-memory mock for @vercel/kv.
 * Replaces Redis KV for testing without external dependencies.
 */

interface ExpireEntry {
  value: unknown;
  expiresAt: number | null;
}

export class MockKV {
  private store = new Map<string, ExpireEntry>();
  private timeouts = new Map<string, NodeJS.Timeout>();

  /**
   * Get a value from the store.
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    // Check if expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Set a value in the store.
   */
  async set(key: string, value: unknown, options?: { ex?: number }): Promise<void> {
    // Clear any existing timeout
    const existingTimeout = this.timeouts.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.timeouts.delete(key);
    }

    const expiresAt = options?.ex ? Date.now() + options.ex * 1000 : null;
    this.store.set(key, { value, expiresAt });

    // Set up auto-cleanup if TTL specified
    if (options?.ex) {
      const timeout = setTimeout(() => {
        this.store.delete(key);
        this.timeouts.delete(key);
      }, options.ex * 1000);
      this.timeouts.set(key, timeout);
    }
  }

  /**
   * Delete a value from the store.
   */
  async del(key: string): Promise<void> {
    this.store.delete(key);
    const timeout = this.timeouts.get(key);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(key);
    }
  }

  /**
   * Set expiration on a key.
   */
  async expire(key: string, seconds: number): Promise<void> {
    const entry = this.store.get(key);
    if (!entry) return;

    // Clear existing timeout
    const existingTimeout = this.timeouts.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    entry.expiresAt = Date.now() + seconds * 1000;

    const timeout = setTimeout(() => {
      this.store.delete(key);
      this.timeouts.delete(key);
    }, seconds * 1000);
    this.timeouts.set(key, timeout);
  }

  /**
   * Check if a key exists.
   */
  async exists(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  /**
   * Get multiple keys.
   */
  async mget<T>(...keys: string[]): Promise<(T | null)[]> {
    const results: (T | null)[] = [];
    for (const key of keys) {
      results.push(await this.get<T>(key));
    }
    return results;
  }

  /**
   * Set multiple keys.
   */
  async mset(data: Record<string, unknown>): Promise<void> {
    for (const [key, value] of Object.entries(data)) {
      await this.set(key, value);
    }
  }

  // ============ Test Helpers ============

  /**
   * Clear all data from the store.
   */
  clear(): void {
    // Clear all timeouts
    for (const timeout of this.timeouts.values()) {
      clearTimeout(timeout);
    }
    this.timeouts.clear();
    this.store.clear();
  }

  /**
   * Get all keys in the store (for debugging).
   */
  keys(): string[] {
    return Array.from(this.store.keys());
  }

  /**
   * Get session data for a specific chat/user.
   */
  getSession(chatId: number, userId: number): unknown | null {
    const key = `attio:session:${chatId}:${userId}`;
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) return null;
    return entry.value;
  }

  /**
   * Get pending instruction for a chat.
   */
  getPending(chatId: number): unknown | null {
    const key = `attio:pending:${chatId}`;
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) return null;
    return entry.value;
  }

  /**
   * Get the raw store for assertions.
   */
  getRawStore(): Map<string, ExpireEntry> {
    return new Map(this.store);
  }

  /**
   * Get count of items in store.
   */
  size(): number {
    return this.store.size;
  }
}

/**
 * Create a mock KV instance for testing.
 */
export function createMockKV(): MockKV {
  return new MockKV();
}

/**
 * Singleton mock KV for tests that need shared state.
 */
let globalMockKV: MockKV | null = null;

export function getGlobalMockKV(): MockKV {
  if (!globalMockKV) {
    globalMockKV = new MockKV();
  }
  return globalMockKV;
}

export function resetGlobalMockKV(): void {
  if (globalMockKV) {
    globalMockKV.clear();
  }
  globalMockKV = null;
}
